import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CalendarRequest {
  calendarIds: string[];
  timeMin?: string;
  timeMax?: string;
  userEmail?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_CALENDAR_API_KEY");
    
    if (!apiKey) {
      console.error("Google Calendar API key not found");
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { calendarIds, timeMin, timeMax, userEmail }: CalendarRequest = await req.json();

    if (!calendarIds || calendarIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Calendar IDs are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const allEvents = [];

    // Fetch events from each calendar
    for (const calendarId of calendarIds) {
      try {
        const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
        url.searchParams.append('key', apiKey);
        
        if (timeMin) url.searchParams.append('timeMin', timeMin);
        if (timeMax) url.searchParams.append('timeMax', timeMax);
        
        // Additional parameters for better results
        url.searchParams.append('singleEvents', 'true');
        url.searchParams.append('orderBy', 'startTime');
        url.searchParams.append('maxResults', '500');

        console.log(`Fetching events from calendar: ${calendarId}`);
        
        const response = await fetch(url.toString());
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error fetching calendar ${calendarId}:`, response.status, errorText);
          continue; // Skip this calendar and continue with others
        }

        const data = await response.json();
        
        if (data.items) {
          // Process events and expand multi-day events
          const processedEvents = data.items.flatMap((event: any) => {
            const startDate = event.start?.dateTime || event.start?.date;
            const endDate = event.end?.dateTime || event.end?.date;
            
            // Check if this event involves the current user
            const isUserEvent = userEmail && (
              event.summary?.toLowerCase().includes(userEmail.split('@')[0].toLowerCase()) ||
              event.description?.toLowerCase().includes(userEmail.toLowerCase()) ||
              (event.attendees && event.attendees.some((attendee: any) => 
                attendee.email?.toLowerCase() === userEmail.toLowerCase()
              ))
            );

            // For multi-day events, create an entry for each day
            // Handle timezone properly for date-only events
            const start = event.start?.date ? new Date(startDate + 'T00:00:00-05:00') : new Date(startDate);
            const end = event.end?.date ? new Date(endDate + 'T00:00:00-05:00') : new Date(endDate);
            const events = [];
            
            // If it's a multi-day event (end date is different from start date)
            if (start.toDateString() !== end.toDateString() && event.start?.date) {
              // Create an event for each day in the range
              const currentDate = new Date(start);
              while (currentDate < end) {
                // Format date in Central timezone
                const centralDate = new Date(currentDate.getTime() - (currentDate.getTimezoneOffset() * 60000));
                const dateStr = centralDate.toISOString().split('T')[0];
                
                events.push({
                  id: `${event.id}_${dateStr}`,
                  title: event.summary || 'Untitled Event',
                  description: event.description || '',
                  date: dateStr,
                  endDate: dateStr,
                  isAllDay: true,
                  calendarId: calendarId,
                  isUserEvent: isUserEvent,
                  location: event.location || '',
                  attendees: event.attendees || [],
                  created: event.created,
                  updated: event.updated,
                  dayOfWeek: currentDate.getDay(),
                  rawEvent: {
                    start: event.start,
                    end: event.end,
                    summary: event.summary
                  }
                });
                currentDate.setDate(currentDate.getDate() + 1);
              }
            } else {
              // Single day event
              const eventDate = event.start?.date ? 
                new Date(startDate + 'T00:00:00-05:00') : 
                new Date(startDate);
              const eventDateStr = event.start?.date ? startDate : eventDate.toISOString().split('T')[0];
              
              events.push({
                id: event.id,
                title: event.summary || 'Untitled Event',
                description: event.description || '',
                date: eventDateStr,
                endDate: event.end?.date ? endDate : eventDate.toISOString().split('T')[0],
                isAllDay: !event.start?.dateTime,
                calendarId: calendarId,
                isUserEvent: isUserEvent,
                location: event.location || '',
                attendees: event.attendees || [],
                created: event.created,
                updated: event.updated,
                dayOfWeek: eventDate.getDay(),
                rawEvent: {
                  start: event.start,
                  end: event.end,
                  summary: event.summary
                }
              });
            }
            
            return events;
          });

          allEvents.push(...processedEvents);
        }
      } catch (error) {
        console.error(`Error processing calendar ${calendarId}:`, error);
        // Continue with other calendars even if one fails
      }
    }

    // Sort events by date
    allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Debug logging for weekend events
    const fridayEvents = allEvents.filter(e => e.dayOfWeek === 5);
    const saturdayEvents = allEvents.filter(e => e.dayOfWeek === 6);
    console.log(`Friday events found: ${fridayEvents.length}`, fridayEvents.map(e => ({ title: e.title, date: e.date })));
    console.log(`Saturday events found: ${saturdayEvents.length}`, saturdayEvents.map(e => ({ title: e.title, date: e.date })));

    console.log(`Successfully fetched ${allEvents.length} events from ${calendarIds.length} calendars`);

    return new Response(JSON.stringify({ 
      events: allEvents,
      totalCount: allEvents.length,
      calendarsProcessed: calendarIds.length
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in fetch-calendar-events function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);