import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

// Single source of truth for who is an administrator. Keep in sync with the
// RLS policies and the frontend admin check (src/lib/admin.ts).
export const ADMIN_EMAIL = 'gyndok@yahoo.com';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface AuthedUser {
  id: string;
  email?: string;
}

// Resolve the caller from the request's Authorization bearer token. Returns
// null when no valid user can be resolved. Because the gateway is set to
// verify_jwt = true, the token is already validated; we call getUser only to
// learn WHO the caller is, so we never trust a user id from the request body.
export async function getAuthenticatedUser(req: Request): Promise<AuthedUser | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

export function isAdmin(user: AuthedUser | null): boolean {
  return !!user?.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function unauthorized(message = 'Authentication required'): Response {
  return jsonResponse({ error: message, success: false }, 401);
}

export function forbidden(message = 'Administrator access required'): Response {
  return jsonResponse({ error: message, success: false }, 403);
}
