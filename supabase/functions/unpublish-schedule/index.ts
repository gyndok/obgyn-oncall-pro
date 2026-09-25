import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
import { corsHeaders, getAuthenticatedUser, isAdmin, unauthorized, forbidden } from "../_shared/auth.ts";
import { getValidAccessToken, removeBlockEvents } from "../_shared/google.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authedUser = await getAuthenticatedUser(req);
    if (!authedUser) return unauthorized();
    if (!(await isAdmin(authedUser))) return forbidden();

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { blockId, countOnly } = await req.json().catch(() => ({}));
    if (typeof blockId !== 'string' || !blockId) return json({ success: false, error: 'blockId is required' }, 400);

    if (countOnly) {
      const { count } = await supabase
        .from('calendar_publishes').select('id', { count: 'exact', head: true }).eq('block_id', blockId);
      return json({ success: true, count: count ?? 0 });
    }

    const token = await getValidAccessToken(supabase, authedUser.id);
    const { deleted, failed } = await removeBlockEvents(supabase, token, blockId);

    if (failed > 0) {
      return json({
        success: false,
        eventsDeleted: deleted,
        eventsFailed: failed,
        error: `${failed} event(s) could not be removed. The block is still marked published; try again.`,
      });
    }

    const { error: updErr } = await supabase
      .from('blocks').update({ status: 'closed', published_at: null }).eq('id', blockId);
    if (updErr) throw new Error(`Failed to update block status: ${updErr.message}`);

    return json({
      success: true,
      eventsDeleted: deleted,
      message: `Unpublished. Removed ${deleted} event(s) from Google Calendar.`,
    });
  } catch (error) {
    console.error('Error in unpublish-schedule:', error);
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
