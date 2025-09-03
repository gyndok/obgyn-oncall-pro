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
    console.log('📝 Starting AI schedule generation...');
    console.log('📝 OpenAI API Key present:', !!openAIApiKey);
    console.log('📝 Request body received');
    
    const { prompt, blockStartDate, doctors }: ScheduleRequest = await req.json();
    
    console.log('📝 Parsed request data:', {
      promptLength: prompt?.length || 0,
      blockStartDate,
      doctorCount: doctors?.length || 0,
      doctorNames: doctors?.map(d => d.name) || []
    });

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
        model: 'o3-2025-04-16',
        messages: [
          {
            role: 'system',
            content: `You are an expert medical scheduling AI that must solve a complex constraint satisfaction problem.

TASK: Create a 7-week call schedule for 7 doctors with strict mathematical constraints.

MATHEMATICAL REQUIREMENTS (MUST BE EXACT):
- Total assignments: 49 (7 weeks × 7 days)
- Total doctors: 7 (Klein, LeBlanc, Johnson, Kenney, LaBerge, Clinger, Demerson)
- Assignments per doctor: 7 (1 weekend bundle + 4 weekdays)
- Weekend assignments: 21 (7 doctors × 3 days each = Fri+Sat+Sun)
- Weekday assignments: 28 (7 doctors × 4 days each = Mon+Tue+Wed+Thu)

HARD CONSTRAINTS (CANNOT BE VIOLATED):
1. Each doctor gets EXACTLY 1 weekend bundle (Fri+Sat+Sun of same week)
2. Each doctor gets EXACTLY 4 weekdays (Mon/Tue/Wed/Thu only)
3. LeBlanc gets ZERO Tuesday assignments
4. Week_index: 1-7 (Week 1 = Nov 3-9, Week 2 = Nov 10-16, etc.)
5. Weekday names: Mon, Tue, Wed, Thu, Fri, Sat, Sun
6. Dates: YYYY-MM-DD format starting 2025-11-03

REASONING APPROACH:
1. First assign weekend bundles (7 weeks, 7 doctors, 1 weekend each)
2. Then distribute weekdays ensuring each doctor gets exactly 4
3. Verify LeBlanc gets no Tuesday assignments
4. Check math: 7×7=49 total, 7×3=21 weekends, 7×4=28 weekdays

RESPONSE FORMAT:
{
  "schedule": [
    {
      "date": "2025-11-03",
      "doctor_name": "Klein",
      "is_weekend": false,
      "weekday_name": "Mon",
      "week_index": 1
    }
  ],
  "summary": {
    "total_assignments": 49,
    "weekend_assignments": 21,
    "weekday_assignments": 28,
    "violations": []
  }
}`
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
      console.error('OpenAI API error details:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        errorBody: errorText
      });
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
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