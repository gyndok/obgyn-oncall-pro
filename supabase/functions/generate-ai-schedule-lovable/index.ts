import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders, getAuthenticatedUser, isAdmin, unauthorized, forbidden } from "../_shared/auth.ts";

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;


interface ScheduleRequest {
  prompt: string;
  blockStartDate: string;
  doctors: Array<{
    id: string;
    name: string;
  }>;
}

interface Assignment {
  block_id: string;
  week_index: number;
  date: string;
  is_weekend: boolean;
  weekday_name: string;
  doctor_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authedUser = await getAuthenticatedUser(req);
    if (!authedUser) return unauthorized();
    if (!isAdmin(authedUser)) return forbidden();

    console.log('📝 Starting AI schedule generation with Lovable AI...');
    console.log('📝 Lovable API Key present:', !!lovableApiKey);
    
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }
    
    const { prompt, blockStartDate, doctors }: ScheduleRequest = await req.json();
    
    console.log('📝 Parsed request data:', {
      promptLength: prompt?.length || 0,
      blockStartDate,
      doctorCount: doctors?.length || 0,
      doctorNames: doctors?.map(d => d.name) || []
    });

    // Fetch the AI prompt from database
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'ai_scheduling_prompt')
      .single();

    if (settingsError) {
      console.error('Failed to fetch AI prompt from database:', settingsError);
      throw new Error('Failed to fetch AI scheduling prompt configuration');
    }

    const systemPrompt = settingsData.value;
    console.log('📝 Using AI prompt from database (length:', systemPrompt.length, 'chars)');

    console.log('📝 Sending AI scheduling prompt to Lovable AI (Gemini)...');
    console.log('Block start date:', blockStartDate);
    console.log('Number of doctors:', doctors.length);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI API error details:', {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (response.status === 402) {
        throw new Error('AI credits exhausted. Please add credits in Settings -> Workspace -> Usage.');
      }
      
      throw new Error(`Lovable AI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log('✅ Received response from Lovable AI');

    const aiContent = aiResponse.choices[0].message.content;
    console.log('Raw AI response:', aiContent);

    // Parse the AI response JSON
    let scheduleData;
    try {
      // Clean up the response (remove any markdown code blocks)
      const cleanedResponse = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      scheduleData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('AI response content:', aiContent);
      throw new Error('AI response was not valid JSON');
    }

    if (!scheduleData.schedule || !Array.isArray(scheduleData.schedule)) {
      throw new Error('AI response missing valid schedule array');
    }

    console.log(`📅 Parsed ${scheduleData.schedule.length} assignments from AI`);

    // Convert AI response to database format
    const assignments: Assignment[] = scheduleData.schedule.map((item: any) => {
      // Find doctor ID by name
      const doctor = doctors.find(d => 
        d.name.toLowerCase().includes(item.doctor_name.toLowerCase()) ||
        item.doctor_name.toLowerCase().includes(d.name.toLowerCase())
      );

      if (!doctor) {
        console.error(`Could not find doctor for name: ${item.doctor_name}`);
        throw new Error(`Doctor not found: ${item.doctor_name}`);
      }

      return {
        block_id: '', // Will be set by caller
        week_index: item.week_index,
        date: item.date,
        is_weekend: item.is_weekend,
        weekday_name: item.weekday_name,
        doctor_id: doctor.id
      };
    });

    console.log('✅ Successfully converted AI schedule to database format');

    return new Response(JSON.stringify({ 
      assignments,
      summary: scheduleData.summary || { total_assignments: assignments.length }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in generate-ai-schedule-lovable function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to generate AI schedule. Check function logs for details.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
