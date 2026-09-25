export const EMAIL_FROM =
  Deno.env.get("EMAIL_FROM") ?? "Call Schedule <schedule@geffreyklein.com>";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Returns an escaped https URL, or "#" if the URL isn't https. */
export function safeHttpsUrl(value: unknown): string {
  try {
    const u = new URL(String(value));
    return u.protocol === "https:" ? escapeHtml(u.toString()) : "#";
  } catch {
    return "#";
  }
}
