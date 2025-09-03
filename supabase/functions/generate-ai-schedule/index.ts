import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

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
    const { prompt, blockStartDate, doctors }: ScheduleRequest = await req.json();

    console.log('📝 Sending AI scheduling prompt to OpenAI...');
    console.log('Block start date:', blockStartDate);
    console.log('Number of doctors:', doctors.length);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: `You are an expert medical scheduling AI. You must respond with a valid JSON object containing a complete 7-week call schedule.

RESPONSE FORMAT (REQUIRED):
{
  "schedule": [
    {
      "date": "2025-11-03",
      "doctor_name": "Klein",
      "is_weekend": false,
      "weekday_name": "Monday",
      "week_index": 0
    },
    ...
  ],
  "summary": {
    "total_assignments": 49,
    "weekend_assignments": 21,
    "weekday_assignments": 28,
    "violations": []
  }
}

CRITICAL REQUIREMENTS:
- Generate exactly 49 assignments (7 weeks × 7 days)
- Each doctor gets exactly one weekend bundle (Fri+Sat+Sun)
- Each doctor gets exactly 4 weekdays (Mon-Thu)
- LeBlanc never gets Tuesday
- Use exact doctor names: Klein, LeBlanc, Johnson, Kenney, LaBerge, Clinger, Demerson
- Dates must be in YYYY-MM-DD format
- Respond ONLY with valid JSON, no other text`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: 4000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log('✅ Received response from OpenAI');

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