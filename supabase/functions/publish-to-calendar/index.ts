import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Calendar IDs
const ON_CALL_CALENDAR_ID = 'q6u72r1ummu006qishq90i7iek@group.calendar.google.com';
const STAFFING_CALENDAR_ID = 'odn75bvuc02onjrb0ai9oskbc4@group.calendar.google.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { blockId, calendarId = ON_CALL_CALENDAR_ID, userId } = await req.json();

    // Get user's Google access token
    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('google_access_token, google_refresh_token, google_token_expires_at, name')
      .eq('auth_user_id', userId)
      .single();

    if (doctorError || !doctor?.google_access_token) {
      throw new Error('Google Calendar not connected. Please authorize Google Calendar access first.');
    }

    // Check if token is expired and refresh if needed
    let accessToken = doctor.google_access_token;
    const tokenExpiry = new Date(doctor.google_token_expires_at);
    
    if (tokenExpiry <= new Date()) {
      // Token is expired, try to refresh
      if (!doctor.google_refresh_token) {
        throw new Error('Google Calendar token expired. Please re-authorize access.');
      }

      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!,
          client_secret: Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!,
          refresh_token: doctor.google_refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (refreshResponse.ok) {
        const tokens = await refreshResponse.json();
        accessToken = tokens.access_token;
        
        // Update stored token
        await supabase
          .from('doctors')
          .update({
            google_access_token: tokens.access_token,
            google_token_expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
          })
          .eq('auth_user_id', userId);
      } else {
        throw new Error('Failed to refresh Google Calendar token. Please re-authorize access.');
      }
    }

    console.log('Publishing block to Google Calendar:', { blockId, calendarId });

    // Get the block and its assignments
    const { data: block, error: blockError } = await supabase
      .from('blocks')
      .select('*')
      .eq('id', blockId)
      .single();

    if (blockError) {
      throw new Error(`Failed to fetch block: ${blockError.message}`);
    }

    const { data: assignments, error: assignmentsError } = await supabase
      .from('assignments')
      .select(`
        *,
        doctor:doctors(name, email)
      `)
      .eq('block_id', blockId)
      .order('date');

    if (assignmentsError) {
      throw new Error(`Failed to fetch assignments: ${assignmentsError.message}`);
    }

    // Get doctor requests for unavailable dates
    const { data: doctorRequests, error: requestsError } = await supabase
      .from('doctor_requests')
      .select(`
        *,
        doctor:doctors(name, email)
      `)
      .eq('block_id', blockId);

    if (requestsError) {
      throw new Error(`Failed to fetch doctor requests: ${requestsError.message}`);
    }

    console.log(`Found ${assignments.length} assignments for block ${block.name}`);
    console.log(`Found ${doctorRequests.length} doctor requests with unavailable dates`);

    // Process call assignments (existing logic)
    const callEvents = [];
    const processedDates = new Set();

    for (const assignment of assignments) {
      if (processedDates.has(assignment.date)) continue;

      const date = new Date(assignment.date);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
      
      // Check if this is a weekend assignment (Friday, Saturday, or Sunday)
      if (dayOfWeek >= 5 || dayOfWeek === 0) {
        // Find the complete weekend for this doctor
        const doctorId = assignment.doctor_id;
        const weekendAssignments = assignments.filter(a => 
          a.doctor_id === doctorId && 
          !processedDates.has(a.date)
        );

        // Sort by date to find consecutive days
        weekendAssignments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let consecutiveDays = [assignment];
        let currentDate = new Date(assignment.date);
        
        // Find consecutive assignments for this doctor
        for (let i = 1; i < weekendAssignments.length; i++) {
          const nextDate = new Date(weekendAssignments[i].date);
          const nextDay = new Date(currentDate);
          nextDay.setDate(nextDay.getDate() + 1);
          
          if (nextDate.getTime() === nextDay.getTime()) {
            consecutiveDays.push(weekendAssignments[i]);
            currentDate = nextDate;
          } else {
            break;
          }
        }

        // Create event for consecutive days (weekend bundle)
        if (consecutiveDays.length >= 2) {
          const startDate = consecutiveDays[0].date;
          const endDate = new Date(consecutiveDays[consecutiveDays.length - 1].date);
          endDate.setDate(endDate.getDate() + 1); // End date is exclusive in Google Calendar

          const lastName = assignment.doctor.name.split(' ').pop() || assignment.doctor.name;
          callEvents.push({
            summary: `${lastName} Call`,
            description: `Medical on-call duty for ${block.name}\nDates: ${consecutiveDays.map(d => new Date(d.date).toLocaleDateString()).join(', ')}`,
            start: {
              date: startDate
            },
            end: {
              date: endDate.toISOString().split('T')[0]
            },
            colorId: '4' // Green color for weekend calls
          });

          // Mark all these dates as processed
          consecutiveDays.forEach(a => processedDates.add(a.date));
        } else {
          // Single day event
          const startDate = assignment.date;
          const endDate = new Date(assignment.date);
          endDate.setDate(endDate.getDate() + 1);

          const lastName = assignment.doctor.name.split(' ').pop() || assignment.doctor.name;
          callEvents.push({
            summary: `${lastName} Call`,
            description: `Medical on-call duty for ${block.name}`,
            start: {
              date: startDate
            },
            end: {
              date: endDate.toISOString().split('T')[0]
            },
            colorId: '2' // Blue color for single day calls
          });

          processedDates.add(assignment.date);
        }
      } else {
        // Weekday assignment
        const startDate = assignment.date;
        const endDate = new Date(assignment.date);
        endDate.setDate(endDate.getDate() + 1);

        const lastName = assignment.doctor.name.split(' ').pop() || assignment.doctor.name;
        callEvents.push({
          summary: `${lastName} Call`,
          description: `Medical on-call duty for ${block.name}`,
          start: {
            date: startDate
          },
          end: {
            date: endDate.toISOString().split('T')[0]
          },
          colorId: '1' // Default color for weekday calls
        });

        processedDates.add(assignment.date);
      }
    }

    console.log(`Created ${callEvents.length} call calendar events`);

    // Process unavailable dates for "Off" events
    const offEvents = [];
    
    for (const request of doctorRequests) {
      if (request.unavailable_dates && Array.isArray(request.unavailable_dates)) {
        const lastName = request.doctor.name.split(' ').pop() || request.doctor.name;
        
        for (const dateStr of request.unavailable_dates) {
          const date = new Date(dateStr);
          const endDate = new Date(date);
          endDate.setDate(endDate.getDate() + 1);
          
          offEvents.push({
            summary: `${lastName} Off`,
            description: `Doctor unavailable for on-call duty - ${block.name}`,
            start: {
              date: date.toISOString().split('T')[0]
            },
            end: {
              date: endDate.toISOString().split('T')[0]
            },
            colorId: '8' // Red color for off days
          });
        }
      }
    }

    console.log(`Created ${offEvents.length} off calendar events`);

    const allEvents = [...callEvents, ...offEvents];

    // Check for and delete existing events to prevent duplicates
    const deletedEvents = [];
    const blockStartDate = block.start_monday_date;
    const blockEndDate = block.end_sunday_date;
    
    console.log(`Checking for existing events between ${blockStartDate} and ${blockEndDate}`);

    // Function to delete existing events in a calendar
    const deleteExistingEvents = async (calendarId: string, calendarName: string) => {
      try {
        // List existing events in the date range
        const listUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
          `timeMin=${blockStartDate}T00:00:00Z&timeMax=${new Date(blockEndDate + 'T23:59:59Z').toISOString()}&singleEvents=true`;
        
        const listResponse = await fetch(listUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (listResponse.ok) {
          const existingEvents = await listResponse.json();
          console.log(`Found ${existingEvents.items?.length || 0} existing events in ${calendarName} calendar`);
          
          // Delete each existing event
          for (const existingEvent of existingEvents.items || []) {
            try {
              const deleteResponse = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${existingEvent.id}`,
                {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                  },
                }
              );
              
              if (deleteResponse.ok) {
                deletedEvents.push({ ...existingEvent, calendar: calendarName });
                console.log(`Deleted existing event: ${existingEvent.summary}`);
              } else {
                console.error(`Failed to delete event ${existingEvent.id}: ${await deleteResponse.text()}`);
              }
            } catch (error) {
              console.error(`Error deleting event ${existingEvent.id}: ${error}`);
            }
          }
        } else {
          console.error(`Failed to list events in ${calendarName}: ${await listResponse.text()}`);
        }
      } catch (error) {
        console.error(`Error checking existing events in ${calendarName}: ${error}`);
      }
    };

    // Delete existing events from both calendars
    await deleteExistingEvents(ON_CALL_CALENDAR_ID, 'on-call');
    await deleteExistingEvents(STAFFING_CALENDAR_ID, 'staffing');

    console.log(`Deleted ${deletedEvents.length} existing events to prevent duplicates`);

    // Create events in Google Calendar using OAuth
    const createdEvents = [];
    const failedEvents = [];

    // Create call events in on-call calendar
    for (const event of callEvents) {
      try {
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(ON_CALL_CALENDAR_ID)}/events`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          }
        );

        if (response.ok) {
          const createdEvent = await response.json();
          createdEvents.push({ ...createdEvent, calendar: 'on-call' });
          console.log(`Created call event: ${event.summary}`);
        } else {
          const errorText = await response.text();
          console.error(`Failed to create call event: ${errorText}`);
          failedEvents.push({ event, error: errorText });
        }
      } catch (error) {
        console.error(`Error creating call event: ${error}`);
        failedEvents.push({ event, error: error.message });
      }
    }

    // Create off events in staffing calendar
    for (const event of offEvents) {
      try {
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(STAFFING_CALENDAR_ID)}/events`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          }
        );

        if (response.ok) {
          const createdEvent = await response.json();
          createdEvents.push({ ...createdEvent, calendar: 'staffing' });
          console.log(`Created off event: ${event.summary}`);
        } else {
          const errorText = await response.text();
          console.error(`Failed to create off event: ${errorText}`);
          failedEvents.push({ event, error: errorText });
        }
      } catch (error) {
        console.error(`Error creating off event: ${error}`);
        failedEvents.push({ event, error: error.message });
      }
    }

    console.log(`Successfully created ${createdEvents.length} events, ${failedEvents.length} failed`);
    const { error: updateError } = await supabase
      .from('blocks')
      .update({ 
        status: 'published',
        published_at: new Date().toISOString(),
        calendar_events: allEvents
      })
      .eq('id', blockId);

    if (updateError) {
      throw new Error(`Failed to update block status: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      eventsCreated: createdEvents.length,
      eventsFailed: failedEvents.length,
      eventsDeleted: deletedEvents.length,
      callEvents: callEvents.length,
      offEvents: offEvents.length,
      message: createdEvents.length > 0 ? 'Schedule published to Google Calendar successfully!' : 'No events were created in Google Calendar.',
      createdEvents: createdEvents,
      failedEvents: failedEvents,
      deletedEvents: deletedEvents
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in publish-to-calendar function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});