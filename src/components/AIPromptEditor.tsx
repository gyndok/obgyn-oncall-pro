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
    const defaultPrompt = `You are an expert medical call-scheduling AI.

Build an on-call schedule of {{weeks}} weeks ({{days}} consecutive days) starting Monday {{start_date}}.

Doctors (use these exact last names): {{doctors}}

Time off (hard excludes):
{{time_off}}

HARD RULES:
- Exactly one doctor per day, every day in the range.
- Each doctor gets exactly one weekend bundle (Fri+Sat+Sun of the same week).
- A doctor cannot take the Thursday before or the Monday after their own weekend.
- Spread Mon-Thu days evenly; at most one Mon-Thu day per doctor per week.
- LeBlanc never gets Tuesday.
- Never assign a doctor on a time-off date.

Respond ONLY with JSON: {"schedule":[{"date":"YYYY-MM-DD","doctor_name":"LastName"}]}`;

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
