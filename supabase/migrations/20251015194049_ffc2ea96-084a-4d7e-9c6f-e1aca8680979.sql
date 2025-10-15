-- Create system_settings table to store configurable system-wide settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only admin can manage system settings
CREATE POLICY "Only admin can manage system settings"
ON public.system_settings
FOR ALL
USING (auth.email() = 'gyndok@yahoo.com');

-- Insert default AI scheduling prompt
INSERT INTO public.system_settings (key, value) VALUES (
  'ai_scheduling_prompt',
  'You are an expert medical scheduling AI. You must respond with a valid JSON object containing a complete 7-week call schedule.

RESPONSE FORMAT (REQUIRED):
{
  "schedule": [
    {
      "date": "2025-11-03",
      "doctor_name": "Klein",
      "is_weekend": false,
      "weekday_name": "Mon",
      "week_index": 1
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

CRITICAL CONSTRAINTS:
- Generate exactly 49 assignments (7 weeks × 7 days)
- Week_index must be 1-7
- Each doctor gets exactly one weekend bundle (Fri+Sat+Sun)
- Each doctor gets exactly 4 weekdays (Mon-Thu)
- LeBlanc never gets Tuesday

JOHNSON-CLINGER MONDAY RULE (ABSOLUTE):
- Dr. Clinger ALWAYS takes the Monday after Johnson''s weekend (Fri+Sat+Sun)
- Dr. Johnson ALWAYS takes the Monday after Clinger''s weekend (Fri+Sat+Sun)
- BLOCKING RULE: If Johnson has requested off a Monday, then Clinger CANNOT have the weekend (Fri+Sat+Sun) immediately before that Monday, even if Clinger requested that weekend
- BLOCKING RULE: If Clinger has requested off a Monday, then Johnson CANNOT have the weekend (Fri+Sat+Sun) immediately before that Monday, even if Johnson requested that weekend

- Use exact doctor names: Klein, LeBlanc, Johnson, Kenney, LaBerge, Clinger, Demerson
- Use abbreviated weekday names: Mon, Tue, Wed, Thu, Fri, Sat, Sun
- Dates must be in YYYY-MM-DD format
- Respond ONLY with valid JSON, no other text'
);