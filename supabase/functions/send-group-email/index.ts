import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";
import { Resend } from "npm:resend@2.0.0";
import { corsHeaders, getAuthenticatedUser, isAdmin, unauthorized, forbidden, jsonResponse } from "../_shared/auth.ts";
import { EMAIL_FROM, escapeHtml } from "../_shared/email.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

function toHtml(text: string): string {
  const linked = (s: string) =>
    escapeHtml(s).replace(/(https:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${linked(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return unauthorized();
    if (!(await isAdmin(user))) return forbidden();

    const payload = await req.json().catch(() => null);
    const subject = typeof payload?.subject === "string" ? payload.subject.trim() : "";
    const body = typeof payload?.body === "string" ? payload.body.trim() : "";
    const doctorIds: string[] | undefined = Array.isArray(payload?.doctorIds)
      ? payload.doctorIds.filter((x: unknown) => typeof x === "string")
      : undefined;
    if (!subject || subject.length > 200) return jsonResponse({ error: "Subject is required (max 200 characters)." }, 400);
    if (!body || body.length > 20000) return jsonResponse({ error: "Message is required (max 20,000 characters)." }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let q = supabase.from("doctors").select("id, name, email").eq("active", true);
    if (doctorIds && doctorIds.length) q = q.in("id", doctorIds);
    const { data: doctors, error } = await q.order("name");
    if (error) throw error;

    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:600px">${toHtml(body)}</div>`;
    const sent: string[] = [];
    const failed: { name: string; error: string }[] = [];
    for (const d of doctors ?? []) {
      if (!d.email) { failed.push({ name: d.name, error: "No email on file" }); continue; }
      const { error: sendError } = await resend.emails.send({ from: EMAIL_FROM, to: [d.email], subject, html, text: body });
      if (sendError) failed.push({ name: d.name, error: sendError.message });
      else sent.push(d.name);
      await new Promise((r) => setTimeout(r, 600)); // stay under Resend rate limit
    }
    return jsonResponse({ sent, failed });
  } catch (e) {
    console.error("send-group-email error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
