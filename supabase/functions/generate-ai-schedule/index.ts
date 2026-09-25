import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";
import { corsHeaders, getAuthenticatedUser, isAdmin, unauthorized, forbidden } from "../_shared/auth.ts";

type Provider = "deepseek" | "lovable";

interface ScheduleRequest {
  provider?: Provider;
  prompt: string;
  doctors: Array<{ id: string; name: string }>;
  vars?: Record<string, string>;
}

const PROVIDERS: Record<Provider, { url: string; model: string; secret: string; label: string }> = {
  deepseek: { url: "https://api.deepseek.com/chat/completions", model: "deepseek-chat", secret: "DEEPSEEK_API_KEY", label: "DeepSeek" },
  lovable: { url: "https://ai.gateway.lovable.dev/v1/chat/completions", model: "google/gemini-2.5-flash", secret: "LOVABLE_API_KEY", label: "Lovable AI" },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const normalizeLastName = (name: string) => {
  const cleaned = String(name ?? "").replace(/^\s*dr\.?\s+/i, "").trim().toLowerCase();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return (parts[parts.length - 1] ?? "").replace(/[^a-z'-]/g, "");
};

function extractJson(text: string): any {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("AI response did not contain JSON");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authedUser = await getAuthenticatedUser(req);
    if (!authedUser) return unauthorized();
    if (!(await isAdmin(authedUser))) return forbidden();

    const { provider = "lovable", prompt, doctors, vars = {} }: ScheduleRequest = await req.json();
    const cfg = PROVIDERS[provider];
    if (!cfg) return json({ error: `Unknown provider "${provider}"` }, 400);
    if (!prompt || !Array.isArray(doctors) || doctors.length === 0) {
      return json({ error: "prompt and doctors are required" }, 400);
    }
    const apiKey = Deno.env.get(cfg.secret);
    if (!apiKey) return json({ error: `${cfg.label} is not set up: the ${cfg.secret} secret is missing.` }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: settings, error: settingsError } = await supabase
      .from("system_settings").select("value").eq("key", "ai_scheduling_prompt").maybeSingle();
    if (settingsError) throw new Error("Failed to load the AI scheduling prompt");

    let systemPrompt = settings?.value ?? "";
    for (const [k, v] of Object.entries(vars)) {
      systemPrompt = systemPrompt.split(`{{${k}}}`).join(String(v));
    }
    systemPrompt +=
      '\n\nOUTPUT: Respond with JSON only, exactly this shape: {"schedule":[{"date":"YYYY-MM-DD","doctor_name":"<last name>"}]}. One entry per day.';

    const body: Record<string, unknown> = {
      model: cfg.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      max_tokens: 8000,
      response_format: { type: "json_object" },
    };

    const response = await fetch(cfg.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${cfg.label} error`, response.status, errorText);
      if (response.status === 429) return json({ error: "Rate limit exceeded. Please try again in a moment." }, 429);
      if (response.status === 402) return json({ error: "AI credits exhausted. Please add credits." }, 402);
      return json({ error: `${cfg.label} error ${response.status}` }, 502);
    }

    const aiResponse = await response.json();
    const content = aiResponse?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") throw new Error("AI returned an empty response");

    const parsed = extractJson(content);
    if (!Array.isArray(parsed?.schedule)) throw new Error('AI response is missing the "schedule" list');

    const byLast = new Map<string, { id: string; name: string }[]>();
    for (const d of doctors) {
      const k = normalizeLastName(d.name);
      byLast.set(k, [...(byLast.get(k) ?? []), d]);
    }

    const errors: string[] = [];
    const assignments = parsed.schedule.map((item: any) => {
      const date = String(item?.date ?? "").slice(0, 10);
      const rawName = String(item?.doctor_name ?? "").trim();
      const matches = rawName ? byLast.get(normalizeLastName(rawName)) ?? [] : [];
      if (!rawName) errors.push(`${date || "?"}: empty doctor name`);
      else if (matches.length !== 1) errors.push(`${date || "?"}: unknown doctor "${rawName}"`);
      return { date, doctor_name: rawName, doctor_id: matches.length === 1 ? matches[0].id : null };
    });

    if (errors.length) {
      return json({ error: `AI schedule has problems: ${errors.slice(0, 5).join("; ")}${errors.length > 5 ? "…" : ""}` }, 422);
    }

    return json({ assignments, provider: cfg.label });
  } catch (error: any) {
    console.error("generate-ai-schedule failed:", error);
    return json({ error: error.message ?? "Failed to generate schedule" }, 500);
  }
});
