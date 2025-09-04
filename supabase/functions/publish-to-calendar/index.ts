import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googleApiKey = Deno.env.get('GOOGLE_CALENDAR_API_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { blockId, calendarId = 'primary' } = await req.json();

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

    console.log(`Found ${assignments.length} assignments for block ${block.name}`);

    // Group assignments by doctor to create multi-day events for weekends
    const events = [];
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
          events.push({
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
          events.push({
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
        events.push({
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

    console.log(`Created ${events.length} calendar events`);

    // Create events in Google Calendar using batch request
    const batchBoundary = 'batch_' + Math.random().toString(36).substr(2, 9);
    let batchBody = '';

    events.forEach((event, index) => {
      batchBody += `--${batchBoundary}\r\n`;
      batchBody += `Content-Type: application/http\r\n`;
      batchBody += `Content-ID: ${index + 1}\r\n\r\n`;
      batchBody += `POST /calendar/v3/calendars/${encodeURIComponent(calendarId)}/events\r\n`;
      batchBody += `Content-Type: application/json\r\n\r\n`;
      batchBody += JSON.stringify(event) + '\r\n';
    });
    batchBody += `--${batchBoundary}--\r\n`;

    // Note: This is a simplified implementation. In production, you would need:
    // 1. OAuth 2.0 authentication flow
    // 2. Access tokens for the user's Google Calendar
    // 3. Proper error handling for API rate limits
    // 4. Batch request handling

    console.log('Batch request prepared for Google Calendar API');

    // For now, we'll simulate success and store the calendar events in our database
    const { error: updateError } = await supabase
      .from('blocks')
      .update({ 
        status: 'published',
        published_at: new Date().toISOString(),
        calendar_events: events
      })
      .eq('id', blockId);

    if (updateError) {
      throw new Error(`Failed to update block status: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      eventsCreated: events.length,
      message: 'Schedule prepared for Google Calendar publication. OAuth setup required for actual calendar integration.',
      events: events
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