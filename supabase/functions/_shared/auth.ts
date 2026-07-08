import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface AuthedUser {
  id: string;
  email?: string;
}

// Resolve the caller from the request's Authorization bearer token.
// Because the gateway is set to verify_jwt = true, the token is already
// validated; we call getUser only to learn WHO the caller is, so we never
// trust a user id passed in the request body.
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

// Look up the caller's role in the database. Uses the service-role client
// so RLS doesn't hide the row; the caller is already authenticated at this
// point via getAuthenticatedUser.
export async function isAdmin(user: AuthedUser | null): Promise<boolean> {
  if (!user) return false;
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data, error } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();
  if (error) {
    console.error('isAdmin lookup failed:', error);
    return false;
  }
  return !!data;
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
