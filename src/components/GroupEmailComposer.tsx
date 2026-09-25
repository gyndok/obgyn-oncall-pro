import { useState } from "react";
import { Mail, Sparkles, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/hooks/useConfirm";

interface Doctor { id: string; name: string; email?: string | null; active?: boolean }

async function readError(error: any, fallback: string) {
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return body.error as string;
  } catch { /* ignore */ }
  return error?.message ?? fallback;
}

export function GroupEmailComposer({ doctors }: { doctors: Doctor[] }) {
  const active = doctors.filter((d) => d.active !== false);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [instructions, setInstructions] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const { confirm, dialog: ConfirmDialog } = useConfirm();

  const selectedIds = active.filter((d) => !excluded.includes(d.id)).map((d) => d.id);
  const allSelected = selectedIds.length === active.length && active.length > 0;

  const draft = async () => {
    if (!instructions.trim()) return;
    setDrafting(true);
    const { data, error } = await supabase.functions.invoke("draft-group-email", { body: { instructions } });
    setDrafting(false);
    if (error || data?.error) {
      toast({ title: "Couldn't draft email", description: data?.error ?? (await readError(error, "Try again.")), variant: "destructive" });
      return;
    }
    setSubject(data.subject);
    setBody(data.body);
    toast({ title: "Draft ready", description: "Review and edit before sending." });
  };

  const send = async () => {
    if (!subject.trim() || !body.trim() || selectedIds.length === 0) return;
    const ok = await confirm({
      title: "Send this email?",
      description: `"${subject}" will go to ${selectedIds.length} doctor${selectedIds.length === 1 ? "" : "s"}.`,
      confirmLabel: "Send",
    });
    if (!ok) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-group-email", {
      body: { subject, body, doctorIds: selectedIds },
    });
    setSending(false);
    if (error || data?.error) {
      toast({ title: "Send failed", description: data?.error ?? (await readError(error, "Try again.")), variant: "destructive" });
      return;
    }
    const failed = data.failed ?? [];
    toast({
      title: `Sent to ${data.sent?.length ?? 0} doctor${data.sent?.length === 1 ? "" : "s"}`,
      description: failed.length ? `Failed: ${failed.map((f: any) => `${f.name} (${f.error})`).join(", ")}` : undefined,
      variant: failed.length ? "destructive" : undefined,
    });
  };

  return (
    <Card className="shadow-soft">
      {ConfirmDialog}
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Group Email</CardTitle>
        <CardDescription>Write a custom message to the doctors, or let Lovable AI draft it for you.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2 rounded-md border p-4">
          <Label htmlFor="ai-instructions" className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Draft with AI</Label>
          <Textarea id="ai-instructions" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Remind everyone that holiday requests for December are due Friday, and thank them for using the new portal." />
          <Button variant="secondary" onClick={draft} disabled={drafting || !instructions.trim()}>
            <Sparkles className="h-4 w-4 mr-2" />{drafting ? "Drafting…" : "Draft subject & message"}
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="group-subject">Subject</Label>
          <Input id="group-subject" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="group-body">Message</Label>
          <Textarea id="group-body" rows={14} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Recipients ({selectedIds.length} of {active.length})</Label>
            <Button variant="link" size="sm" onClick={() => setExcluded(allSelected ? active.map((d) => d.id) : [])}>
              {allSelected ? "Clear all" : "Select all"}
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {active.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={!excluded.includes(d.id)}
                  onCheckedChange={(c) => setExcluded((s) => (c ? s.filter((x) => x !== d.id) : [...s, d.id]))} />
                <span>{d.name}</span>
                <span className="text-muted-foreground truncate">{d.email}</span>
              </label>
            ))}
          </div>
        </div>

        <Button onClick={send} disabled={sending || !subject.trim() || !body.trim() || selectedIds.length === 0}>
          <Send className="h-4 w-4 mr-2" />{sending ? "Sending…" : `Send to ${selectedIds.length} doctor${selectedIds.length === 1 ? "" : "s"}`}
        </Button>
      </CardContent>
    </Card>
  );
}
