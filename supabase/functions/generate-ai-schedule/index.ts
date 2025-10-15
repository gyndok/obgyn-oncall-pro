import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    console.log('📝 Starting AI schedule generation...');
    console.log('📝 DeepSeek API Key present:', !!deepseekApiKey);
    console.log('📝 Request body received');
    
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

    console.log('📝 Sending AI scheduling prompt to DeepSeek...');
    console.log('Block start date:', blockStartDate);
    console.log('Number of doctors:', doctors.length);

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
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
        max_tokens: 4000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API error details:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        errorBody: errorText
      });
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log('✅ Received response from DeepSeek');

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
    console.error('Error in generate-ai-schedule function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to generate AI schedule. Check function logs for details.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});