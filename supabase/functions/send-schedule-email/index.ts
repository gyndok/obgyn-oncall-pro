import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ScheduleEmailRequest {
  blockId: string;
  customMessage?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { blockId, customMessage }: ScheduleEmailRequest = await req.json();

    if (!blockId) {
      throw new Error('Block ID is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Fetching schedule data for block ${blockId}`);

    // Get block information
    const { data: block, error: blockError } = await supabase
      .from('blocks')
      .select('*')
      .eq('id', blockId)
      .single();

    if (blockError) throw blockError;

    // Get all doctors
    const { data: doctors, error: doctorsError } = await supabase
      .from('doctors')
      .select('*')
      .eq('active', true)
      .order('name');

    if (doctorsError) throw doctorsError;

    // Get all assignments for this block
    const { data: assignments, error: assignmentsError } = await supabase
      .from('assignments')
      .select(`
        *,
        doctors (name, email)
      `)
      .eq('block_id', blockId)
      .order('date');

    if (assignmentsError) throw assignmentsError;

    console.log(`Found ${doctors?.length || 0} doctors and ${assignments?.length || 0} assignments`);

    const emailResults = [];

    // Send email to each doctor with their schedule
    for (const doctor of doctors || []) {
      try {
        // Get this doctor's assignments
        const doctorAssignments = assignments?.filter(a => a.doctor_id === doctor.id) || [];
        
        // Group assignments by week
        const weeklySchedule: Record<number, any[]> = {};
        doctorAssignments.forEach(assignment => {
          if (!weeklySchedule[assignment.week_index]) {
            weeklySchedule[assignment.week_index] = [];
          }
          weeklySchedule[assignment.week_index].push(assignment);
        });

        // Format schedule for email
        let scheduleHtml = '';
        const weekNumbers = Object.keys(weeklySchedule).map(Number).sort((a, b) => a - b);
        
        if (weekNumbers.length === 0) {
          scheduleHtml = '<p style="padding: 20px; background-color: #f3f4f6; border-radius: 8px; color: #6b7280;">You are not assigned to any calls during this period.</p>';
        } else {
          scheduleHtml = weekNumbers.map(weekNum => {
            const weekAssignments = weeklySchedule[weekNum].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const assignmentsList = weekAssignments.map(assignment => {
              const date = new Date(assignment.date);
              const formattedDate = date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });
              return `<li style="margin: 8px 0; padding: 8px; background-color: ${assignment.is_weekend ? '#fef3c7' : '#f0f9ff'}; border-radius: 4px;">
                <strong>${formattedDate}</strong>
                ${assignment.is_weekend ? ' <span style="color: #92400e; font-weight: bold;">(Weekend Call)</span>' : ''}
              </li>`;
            }).join('');
            
            return `
              <div style="margin: 20px 0;">
                <h3 style="color: #1f2937; margin: 10px 0;">Week ${weekNum}</h3>
                <ul style="list-style: none; padding: 0; margin: 0;">
                  ${assignmentsList}
                </ul>
              </div>
            `;
          }).join('');
        }

        const blockTitle = `Call Schedule: ${new Date(block.start_monday_date).toLocaleDateString()} - ${new Date(block.end_sunday_date).toLocaleDateString()}`;

        const emailResponse = await resend.emails.send({
          from: "Call Schedule Portal <onboarding@resend.dev>",
          to: [doctor.email],
          subject: `Your Call Schedule - ${blockTitle}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #333; text-align: center; margin-bottom: 30px;">Your Call Schedule</h1>
              
              <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                Dear Dr. ${doctor.name},
              </p>
              
              ${customMessage ? `
              <div style="background-color: #f0f9ff; padding: 15px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; color: #333;">Message from Administration</h3>
                <p style="margin: 0; color: #666; white-space: pre-wrap;">${customMessage}</p>
              </div>
              ` : ''}
              
              <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                Your call schedule for the following period has been finalized:
              </p>
              
              <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0;">
                <strong style="color: #333;">${blockTitle}</strong>
              </div>
              
              <h2 style="color: #333; margin: 30px 0 20px 0;">Your Assignments:</h2>
              ${scheduleHtml}
              
              ${weekNumbers.length > 0 ? `
              <div style="background-color: #f0f9ff; padding: 15px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; color: #333;">Summary</h3>
                <p style="margin: 0; color: #666;">
                  Total assignments: <strong>${doctorAssignments.length}</strong><br>
                  Weekend calls: <strong>${doctorAssignments.filter(a => a.is_weekend).length}</strong><br>
                  Weekday calls: <strong>${doctorAssignments.filter(a => !a.is_weekend).length}</strong>
                </p>
              </div>
              ` : ''}
              
              <p style="color: #666; font-size: 16px; line-height: 1.5; margin: 20px 0;">
                Please review your schedule and contact the administration team if you have any questions or concerns.
              </p>
              
              <p style="color: #666; font-size: 16px; line-height: 1.5; margin: 20px 0;">
                Thank you for your participation.
              </p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              
              <p style="color: #999; font-size: 12px; text-align: center;">
                Call Schedule Portal - This is an automated email. Please do not reply.
              </p>
            </div>
          `,
        });

        console.log(`Resend API response for ${doctor.name}:`, JSON.stringify(emailResponse));
        console.log(`Email sent to ${doctor.name} (${doctor.email})`);
        emailResults.push({
          doctor: doctor.name,
          email: doctor.email,
          success: true,
          assignmentCount: doctorAssignments.length,
          resendResponse: emailResponse
        });

        // Add delay to respect Resend rate limit (2 requests per second)
        // Wait 600ms between emails to be safe
        await new Promise(resolve => setTimeout(resolve, 600));

      } catch (error: any) {
        console.error(`Failed to send email to ${doctor.name}:`, error);
        emailResults.push({
          doctor: doctor.name,
          email: doctor.email,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = emailResults.filter(r => r.success).length;
    const totalCount = emailResults.length;

    console.log(`Mass email complete: ${successCount}/${totalCount} emails sent successfully`);

    return new Response(JSON.stringify({ 
      success: true, 
      emailResults,
      summary: {
        totalEmails: totalCount,
        successfulEmails: successCount,
        failedEmails: totalCount - successCount
      }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending mass schedule emails:", error);
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