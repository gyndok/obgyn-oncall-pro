import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { userId } = await req.json();

    console.log('Creating test calendar event for user:', userId);

    // Get user's Google access token
    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('google_access_token, google_email')
      .eq('auth_user_id', userId)
      .single();

    if (doctorError || !doctor?.google_access_token) {
      throw new Error('Google Calendar not connected. Please connect your Google Calendar first.');
    }

    // Staffing calendar ID
    const staffingCalendarId = 'odn75bvuc02onjrb0ai9oskbc4@group.calendar.google.com';

    // Create a test event for September 4th at 2 PM in Central Time
    // Explicitly setting the date to avoid timezone confusion
    const testEvent = {
      summary: 'Test Event - OB/GYN Staffing',
      description: 'This is a test event to verify Google Calendar integration is working.',
      start: {
        dateTime: '2025-09-04T14:00:00',
        timeZone: 'America/Chicago'
      },
      end: {
        dateTime: '2025-09-04T15:00:00',
        timeZone: 'America/Chicago'
      },
      colorId: '10' // Green color for test events
    };

    console.log('Creating event:', testEvent);

    // Create the event in Google Calendar
    const eventResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(staffingCalendarId)}/events`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${doctor.google_access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testEvent),
      }
    );

    if (!eventResponse.ok) {
      const errorText = await eventResponse.text();
      console.error('Google Calendar API error:', errorText);
      throw new Error(`Failed to create calendar event: ${eventResponse.status} ${errorText}`);
    }

    const createdEvent = await eventResponse.json();
    console.log('Successfully created test event:', createdEvent.id);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Test event created successfully!',
      eventId: createdEvent.id,
      eventLink: createdEvent.htmlLink,
      calendar: 'Staffing Calendar',
      eventTime: `September 4th at 2:00 PM CT`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in test-calendar-event function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});