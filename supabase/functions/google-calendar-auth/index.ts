import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
import { corsHeaders, getAuthenticatedUser, unauthorized } from "../_shared/auth.ts";


const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googleClientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!;
const googleClientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authedUser = await getAuthenticatedUser(req);
    if (!authedUser) return unauthorized();
    const userId = authedUser.id;

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { action, code, redirectUri } = await req.json();

    console.log('Google Calendar Auth request:', { action, userId, hasCode: !!code });

    if (action === 'getAuthUrl') {
      console.log('📍 Redirect URI received from frontend:', redirectUri);
      console.log('🔑 Using Client ID:', googleClientId.substring(0, 20) + '...');
      
      // Generate OAuth URL for user to authorize
      const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ].join(' ');

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.append('client_id', googleClientId);
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('scope', scopes);
      authUrl.searchParams.append('access_type', 'offline');
      authUrl.searchParams.append('prompt', 'consent');
      authUrl.searchParams.append('state', userId); // Pass user ID in state

      console.log('🔗 Full auth URL being generated:', authUrl.toString());
      console.log('⚠️  VERIFY THIS REDIRECT URI IN GOOGLE CLOUD CONSOLE ⚠️');

      return new Response(JSON.stringify({ 
        authUrl: authUrl.toString(),
        success: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'exchangeCode') {
      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Failed to exchange code for token: ${errorText}`);
      }

      const tokens = await tokenResponse.json();
      
      // Get user's Google Calendar info
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      });

      const userInfo = await userInfoResponse.json();

      // Store tokens in database (you might want to create a user_tokens table)
      // For now, we'll store it in the doctors table
      const { error: updateError } = await supabase
        .from('doctors')
        .update({
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token,
          google_token_expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
          google_email: userInfo.email,
        })
        .eq('auth_user_id', userId);

      if (updateError) {
        console.error('Failed to store tokens:', updateError);
        throw new Error(`Failed to store tokens: ${updateError.message}`);
      }

      console.log('Successfully stored Google Calendar tokens for user:', userId);

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Google Calendar connected successfully!',
        userEmail: userInfo.email
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'refreshToken') {
      // Get user's current refresh token
      const { data: doctor, error: doctorError } = await supabase
        .from('doctors')
        .select('google_refresh_token')
        .eq('auth_user_id', userId)
        .single();

      if (doctorError || !doctor?.google_refresh_token) {
        throw new Error('No refresh token found. Please re-authorize Google Calendar access.');
      }

      // Refresh the access token
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          refresh_token: doctor.google_refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        throw new Error(`Failed to refresh token: ${errorText}`);
      }

      const tokens = await refreshResponse.json();

      // Update stored token
      const { error: updateError } = await supabase
        .from('doctors')
        .update({
          google_access_token: tokens.access_token,
          google_token_expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
        })
        .eq('auth_user_id', userId);

      if (updateError) {
        throw new Error(`Failed to update token: ${updateError.message}`);
      }

      return new Response(JSON.stringify({ 
        success: true,
        access_token: tokens.access_token
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action specified');

  } catch (error) {
    console.error('Error in google-calendar-auth function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});