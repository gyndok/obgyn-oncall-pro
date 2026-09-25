import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
import { corsHeaders, getAuthenticatedUser, unauthorized } from "../_shared/auth.ts";
import { getValidAccessToken } from "../_shared/google.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googleClientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!;
const googleClientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!;

// Redirect URIs are never taken blindly from the client.
const FIXED_REDIRECT = Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI');
const ALLOWED_HOSTS = [
  'obgyn-oncall-pro.lovable.app',
  'id-preview--9656ff46-4791-4d59-942e-c90df87821f1.lovable.app',
  'localhost',
];

function resolveRedirect(clientValue: unknown): string {
  if (FIXED_REDIRECT) return FIXED_REDIRECT;
  try {
    const u = new URL(String(clientValue));
    if (ALLOWED_HOSTS.includes(u.hostname) && (u.protocol === 'https:' || u.hostname === 'localhost')) {
      return `${u.origin}${u.pathname}`;
    }
  } catch { /* fallthrough */ }
  throw new Error('Redirect URI not allowed');
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authedUser = await getAuthenticatedUser(req);
    if (!authedUser) return unauthorized();
    const userId = authedUser.id;

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { action, code, redirectUri, state } = await req.json().catch(() => ({}));

    const { data: doctor } = await supabase
      .from('doctors').select('id').eq('auth_user_id', userId).maybeSingle();
    if (!doctor) return json({ success: false, error: 'No doctor record linked to this account.' }, 400);

    if (action === 'getAuthUrl') {
      if (typeof state !== 'string' || state.length < 16) return json({ success: false, error: 'state required' }, 400);
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.append('client_id', googleClientId);
      authUrl.searchParams.append('redirect_uri', resolveRedirect(redirectUri));
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email');
      authUrl.searchParams.append('access_type', 'offline');
      authUrl.searchParams.append('prompt', 'consent');
      authUrl.searchParams.append('state', state);
      return json({ success: true, authUrl: authUrl.toString() });
    }

    if (action === 'exchangeCode') {
      if (typeof code !== 'string' || !code) return json({ success: false, error: 'code required' }, 400);
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: resolveRedirect(redirectUri),
        }),
      });
      if (!tokenResponse.ok) throw new Error(`Failed to exchange code [${tokenResponse.status}]: ${await tokenResponse.text()}`);
      const tokens = await tokenResponse.json();

      const userInfo = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }).then((r) => r.json()).catch(() => ({}));

      const { data: existing } = await supabase
        .from('google_credentials').select('refresh_token').eq('doctor_id', doctor.id).maybeSingle();

      const { error: credErr } = await supabase.from('google_credentials').upsert({
        doctor_id: doctor.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? existing?.refresh_token ?? null,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (credErr) throw new Error(`Failed to store tokens: ${credErr.message}`);

      await supabase.from('doctors').update({ google_email: userInfo.email ?? 'connected' }).eq('id', doctor.id);
      return json({ success: true, userEmail: userInfo.email ?? null });
    }

    if (action === 'refreshToken') {
      await getValidAccessToken(supabase, userId);
      return json({ success: true });
    }

    if (action === 'disconnect') {
      const { data: cred } = await supabase
        .from('google_credentials').select('access_token, refresh_token').eq('doctor_id', doctor.id).maybeSingle();
      const tok = cred?.refresh_token ?? cred?.access_token;
      if (tok) {
        await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: tok }),
        }).catch((e) => console.error('Revoke failed:', e));
      }
      await supabase.from('google_credentials').delete().eq('doctor_id', doctor.id);
      await supabase.from('doctors').update({ google_email: null }).eq('id', doctor.id);
      return json({ success: true });
    }

    return json({ success: false, error: 'Invalid action' }, 400);
  } catch (error) {
    console.error('Error in google-calendar-auth:', error);
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
