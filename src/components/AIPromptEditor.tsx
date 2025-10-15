import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, RotateCcw } from "lucide-react";

export const AIPromptEditor = () => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPrompt();
  }, []);

  const fetchPrompt = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'ai_scheduling_prompt')
        .single();

      if (error) throw error;
      setPrompt(data.value);
    } catch (error) {
      console.error('Error fetching prompt:', error);
      toast({
        title: "Error",
        description: "Failed to load AI prompt",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const savePrompt = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ 
          value: prompt,
          updated_at: new Date().toISOString()
        })
        .eq('key', 'ai_scheduling_prompt');

      if (error) throw error;

      toast({
        title: "Success",
        description: "AI scheduling prompt updated successfully"
      });
    } catch (error) {
      console.error('Error saving prompt:', error);
      toast({
        title: "Error",
        description: "Failed to save AI prompt",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async () => {
    const defaultPrompt = `You are an expert medical scheduling AI. You must respond with a valid JSON object containing a complete 7-week call schedule.

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
- Dr. Clinger ALWAYS takes the Monday after Johnson's weekend (Fri+Sat+Sun)
- Dr. Johnson ALWAYS takes the Monday after Clinger's weekend (Fri+Sat+Sun)
- BLOCKING RULE: If Johnson has requested off a Monday, then Clinger CANNOT have the weekend (Fri+Sat+Sun) immediately before that Monday, even if Clinger requested that weekend
- BLOCKING RULE: If Clinger has requested off a Monday, then Johnson CANNOT have the weekend (Fri+Sat+Sun) immediately before that Monday, even if Johnson requested that weekend

- Use exact doctor names: Klein, LeBlanc, Johnson, Kenney, LaBerge, Clinger, Demerson
- Use abbreviated weekday names: Mon, Tue, Wed, Thu, Fri, Sat, Sun
- Dates must be in YYYY-MM-DD format
- Respond ONLY with valid JSON, no other text`;

    setPrompt(defaultPrompt);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Scheduling Prompt</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Scheduling Prompt</CardTitle>
        <CardDescription>
          Customize the system prompt used for AI schedule generation. This prompt is sent to the AI model to guide schedule creation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[400px] font-mono text-sm"
          placeholder="Enter the AI scheduling prompt..."
        />
        <div className="flex gap-2">
          <Button onClick={savePrompt} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Prompt"}
          </Button>
          <Button onClick={resetToDefault} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Default
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
