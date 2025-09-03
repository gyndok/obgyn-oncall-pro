import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReminderEmailRequest {
  doctorName: string;
  doctorEmail: string;
  blockTitle: string;
  submissionDeadline: string;
  doctorPortalUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { doctorName, doctorEmail, blockTitle, submissionDeadline, doctorPortalUrl }: ReminderEmailRequest = await req.json();

    console.log(`Sending reminder email to ${doctorName} (${doctorEmail})`);

    const emailResponse = await resend.emails.send({
      from: "Call Schedule <onboarding@resend.dev>", // You'll need to update this with your domain
      to: [doctorEmail],
      subject: `Reminder: Submit Your Call Schedule Preferences - ${blockTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Call Schedule Reminder</h2>
          
          <p>Dear Dr. ${doctorName},</p>
          
          <p>This is a friendly reminder to submit your call schedule preferences for:</p>
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <strong>${blockTitle}</strong><br>
            <span style="color: #6b7280;">Submission deadline: ${submissionDeadline}</span>
          </div>
          
          <p>Please click the button below to access the doctor portal and submit your preferences:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${doctorPortalUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Submit Schedule Preferences
            </a>
          </div>
          
          <p>If you have any questions or technical issues, please contact the administration team.</p>
          
          <p>Thank you for your cooperation.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 12px; color: #6b7280;">
            This is an automated reminder. Please do not reply to this email.
          </p>
        </div>
      `,
    });

    console.log("Reminder email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending reminder email:", error);
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