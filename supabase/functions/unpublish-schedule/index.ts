import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
import { corsHeaders, getAuthenticatedUser, isAdmin, unauthorized, forbidden } from "../_shared/auth.ts";


const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authedUser = await getAuthenticatedUser(req);
    if (!authedUser) return unauthorized();
    if (!isAdmin(authedUser)) return forbidden();
    const userId = authedUser.id;

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { blockId } = await req.json();

    console.log('Unpublishing schedule for block:', blockId, 'user:', userId);

    // Get user's Google access token
    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('google_access_token, google_email')
      .eq('auth_user_id', userId)
      .maybeSingle();

    if (doctorError || !doctor?.google_access_token) {
      throw new Error('Google Calendar not connected. Please connect your Google Calendar first.');
    }

    // Get all published events for this block
    const { data: publishedEvents, error: eventsError } = await supabase
      .from('calendar_publishes')
      .select('*')
      .eq('block_id', blockId);

    if (eventsError) {
      throw new Error(`Failed to fetch published events: ${eventsError.message}`);
    }

    if (!publishedEvents || publishedEvents.length === 0) {
      console.log('No published events found for this block');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'No published events found to unpublish',
        eventsDeleted: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${publishedEvents.length} published events to delete`);

    let deletedCount = 0;
    let failedCount = 0;
    const errors = [];

    // Delete each event from Google Calendar
    for (const event of publishedEvents) {
      try {
        console.log(`Deleting event ${event.google_event_id} from calendar ${event.google_calendar_id}`);
        
        const deleteResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(event.google_calendar_id)}/events/${encodeURIComponent(event.google_event_id)}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${doctor.google_access_token}`,
            },
          }
        );

        if (deleteResponse.ok || deleteResponse.status === 404) {
          // 404 means event was already deleted, which is fine
          deletedCount++;
          console.log(`Successfully deleted event ${event.google_event_id}`);
        } else {
          const errorText = await deleteResponse.text();
          console.error(`Failed to delete event ${event.google_event_id}:`, errorText);
          failedCount++;
          errors.push(`Event ${event.google_event_id}: ${deleteResponse.status}`);
        }
      } catch (error) {
        console.error(`Error deleting event ${event.google_event_id}:`, error);
        failedCount++;
        errors.push(`Event ${event.google_event_id}: ${error.message}`);
      }
    }

    // Remove all records from calendar_publishes table
    const { error: deleteRecordsError } = await supabase
      .from('calendar_publishes')
      .delete()
      .eq('block_id', blockId);

    if (deleteRecordsError) {
      console.error('Failed to delete calendar publish records:', deleteRecordsError);
      errors.push(`Failed to clean up tracking records: ${deleteRecordsError.message}`);
    }

    // Update block status to 'closed'
    const { error: updateBlockError } = await supabase
      .from('blocks')
      .update({ status: 'closed' })
      .eq('id', blockId);

    if (updateBlockError) {
      console.error('Failed to update block status:', updateBlockError);
      errors.push(`Failed to update block status: ${updateBlockError.message}`);
    }

    console.log(`Unpublish complete: ${deletedCount} deleted, ${failedCount} failed`);

    const success = failedCount === 0 && !deleteRecordsError && !updateBlockError;
    
    return new Response(JSON.stringify({ 
      success: success,
      message: success 
        ? `Successfully unpublished schedule! Removed ${deletedCount} events from Google Calendar.`
        : `Partially completed: ${deletedCount} events deleted, ${failedCount} failed. ${errors.join('; ')}`,
      eventsDeleted: deletedCount,
      eventsFailed: failedCount,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in unpublish-schedule function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});