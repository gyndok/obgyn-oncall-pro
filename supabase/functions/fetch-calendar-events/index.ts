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

            // Handle timezone properly for date-only events
            // For date-only events, we need to ensure they stay in the correct timezone
            let start, end;
            if (event.start?.date) {
              // Date-only events should be treated as local timezone, not UTC
              start = new Date(startDate + 'T12:00:00'); // Use noon to avoid timezone shifts
              end = new Date(endDate + 'T12:00:00');
            } else {
              // Timed events
              start = new Date(startDate);
              end = new Date(endDate);
            }
            const events = [];
            
            // If it's a multi-day event (end date is different from start date)
            if (start.toDateString() !== end.toDateString() && event.start?.date) {
              // Create an event for each day in the range
              const currentDate = new Date(start);
              while (currentDate < end) {
                // For date-only events, keep the original date string format
                const dateStr = event.start?.date ? 
                  currentDate.toISOString().split('T')[0] : 
                  currentDate.toISOString().split('T')[0];
                
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
              // Single day event - preserve original date format for date-only events
              const eventDateStr = event.start?.date ? startDate : new Date(startDate).toISOString().split('T')[0];
              const eventEndStr = event.end?.date ? endDate : new Date(endDate).toISOString().split('T')[0];
              const dayOfWeek = event.start?.date ? 
                new Date(startDate + 'T12:00:00').getDay() : 
                new Date(startDate).getDay();
              
              events.push({
                id: event.id,
                title: event.summary || 'Untitled Event',
                description: event.description || '',
                date: eventDateStr,
                endDate: eventEndStr,
                isAllDay: !event.start?.dateTime,
                calendarId: calendarId,
                isUserEvent: isUserEvent,
                location: event.location || '',
                attendees: event.attendees || [],
                created: event.created,
                updated: event.updated,
                dayOfWeek: dayOfWeek,
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

    // Fetch US holidays
    try {
      const currentYear = new Date().getFullYear();
      const holidayUrl = `https://date.nager.at/api/v3/PublicHolidays/${currentYear}/US`;
      
      console.log(`Fetching US holidays for ${currentYear}`);
      
      const holidayResponse = await fetch(holidayUrl);
      
      if (holidayResponse.ok) {
        const holidays = await holidayResponse.json();
        
        // Filter holidays to the requested time range and process them
        const filteredHolidays = holidays.filter((holiday: any) => {
          const holidayDate = new Date(holiday.date);
          const timeMinDate = timeMin ? new Date(timeMin) : new Date('1900-01-01');
          const timeMaxDate = timeMax ? new Date(timeMax) : new Date('2100-12-31');
          return holidayDate >= timeMinDate && holidayDate <= timeMaxDate;
        });
        
        const holidayEvents = filteredHolidays.map((holiday: any) => ({
          id: `holiday_${holiday.date}`,
          title: `🎄 ${holiday.name}`,
          description: `US Holiday: ${holiday.name}`,
          date: holiday.date,
          endDate: holiday.date,
          isAllDay: true,
          calendarId: 'holidays',
          isUserEvent: false,
          isHoliday: true,
          location: '',
          attendees: [],
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          dayOfWeek: new Date(holiday.date + 'T12:00:00').getDay(),
          rawEvent: {
            start: { date: holiday.date },
            end: { date: holiday.date },
            summary: holiday.name
          }
        }));
        
        allEvents.push(...holidayEvents);
        console.log(`Added ${holidayEvents.length} holidays`);
      } else {
        console.error('Error fetching holidays:', holidayResponse.status);
      }
    } catch (error) {
      console.error('Error processing holidays:', error);
      // Continue without holidays if there's an error
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