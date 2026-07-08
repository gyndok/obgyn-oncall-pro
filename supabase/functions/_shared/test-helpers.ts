// Shared helpers for lightweight edge-function auth-gate tests.
// These tests hit the deployed functions and verify the security contract
// (rejects missing/invalid tokens, rejects malformed bodies) without needing
// seeded test accounts.

import "https://deno.land/std@0.224.0/dotenv/load.ts";

export const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
export const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set in .env",
  );
}

export function functionUrl(name: string): string {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

export interface CallOptions {
  method?: string;
  token?: string | null; // null = no Authorization header
  body?: unknown;
  headers?: Record<string, string>;
}

// Call a deployed edge function and return status + parsed body.
// Always consumes the response body to avoid Deno resource leaks.
export async function callFunction(
  name: string,
  opts: CallOptions = {},
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    ...(opts.headers ?? {}),
  };
  if (opts.token !== null) {
    headers["Authorization"] = `Bearer ${opts.token ?? SUPABASE_ANON_KEY}`;
  }

  const res = await fetch(functionUrl(name), {
    method: opts.method ?? "POST",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // leave as text
  }
  return { status: res.status, body };
}
