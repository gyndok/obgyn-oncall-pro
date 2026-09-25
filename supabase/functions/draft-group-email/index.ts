import { corsHeaders, getAuthenticatedUser, isAdmin, unauthorized, forbidden, jsonResponse } from "../_shared/auth.ts";

const MODEL = "openai/gpt-6-astra";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return unauthorized();
    if (!(await isAdmin(user))) return forbidden();

    const body = await req.json().catch(() => null);
    const instructions = typeof body?.instructions === "string" ? body.instructions.trim() : "";
    if (!instructions || instructions.length > 4000) {
      return jsonResponse({ error: "Describe what the email should say (up to 4000 characters)." }, 400);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return jsonResponse({ error: "Lovable AI is not configured." }, 500);

    const system = `You write short, friendly, professional emails from Dr. Klein (the call-schedule administrator) to the OB/GYN doctors in his on-call group. The portal is at https://obgyn-oncall-pro.lovable.app. Write plain text only (no markdown, no HTML). Sign off as "Dr. Klein". Respond ONLY with JSON: {"subject": string, "body": string}.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      signal: req.signal,
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        input: [
          { role: "system", content: system },
          { role: "user", content: instructions },
        ],
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      let message = "AI request failed.";
      try { message = JSON.parse(text)?.error?.message ?? JSON.parse(text)?.message ?? message; } catch { /* ignore */ }
      if (res.status === 402) message = "Out of AI credits.";
      if (res.status === 429) message = "AI is busy right now — try again in a minute.";
      // Upstream auth errors shouldn't look like the admin's own sign-in failing
      const status = res.status === 401 || res.status === 403 ? 502 : res.status;
      return jsonResponse({ error: message }, status);
    }

    // Consume SSE, accumulate output text
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let output = "";
    let streamError: string | null = null;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const evt = JSON.parse(data);
          if (evt.type === "response.output_text.delta") output += evt.delta ?? "";
          else if (evt.type === "error" || evt.type === "response.failed") {
            streamError = evt.error?.message ?? evt.response?.error?.message ?? "AI request failed.";
          }
        } catch { /* partial */ }
      }
    }
    if (streamError) return jsonResponse({ error: streamError }, 502);

    const match = output.match(/\{[\s\S]*\}/);
    if (!match) return jsonResponse({ error: "The AI didn't return a draft. Try rewording your request." }, 502);
    let parsed: { subject?: unknown; body?: unknown };
    try { parsed = JSON.parse(match[0]); } catch {
      return jsonResponse({ error: "The AI returned an unreadable draft." }, 502);
    }
    if (typeof parsed.subject !== "string" || typeof parsed.body !== "string") {
      return jsonResponse({ error: "The AI returned an incomplete draft." }, 502);
    }
    return jsonResponse({ subject: parsed.subject, body: parsed.body });
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499, headers: corsHeaders });
    console.error("draft-group-email error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
