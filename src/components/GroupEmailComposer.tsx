import { useEffect, useState } from "react";
import { format } from "date-fns";
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
interface LogRow { id: string; subject: string; recipient_count: number; sent_count: number; failed_count: number; created_at: string }

async function readError(error: any, fallback: string) {
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return body.error as string;
  } catch { /* ignore */ }
  return error?.message ?? fallback;
}

export function GroupEmailComposer({ doctors }: { doctors: Doctor[] }) {
  const active = doctors.filter((d) => d.active !== false);
  const selectable = active.filter((d) => !!d.email);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [instructions, setInstructions] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState<LogRow[]>([]);
  const { confirm, dialog: ConfirmDialog } = useConfirm();

  const selected = selectable.filter((d) => !excluded.includes(d.id));
  const selectedIds = selected.map((d) => d.id);
  const allSelected = selected.length === selectable.length && selectable.length > 0;

  const loadLog = async () => {
    const { data, error } = await supabase
      .from("group_email_log" as any)
      .select("id, subject, recipient_count, sent_count, failed_count, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (!error) setLog((data as any) ?? []);
  };
  useEffect(() => { void loadLog(); }, []);

  const draft = async () => {
    if (!instructions.trim()) return;
    if ((subject.trim() || body.trim()) && !(await confirm({
      title: "Replace your text?",
      description: "The AI draft will overwrite the current subject and message.",
      confirmLabel: "Replace",
    }))) return;
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
    const who = allSelected
      ? `all ${selected.length} active doctors`
      : selected.map((d) => d.name).join(", ");
    const ok = await confirm({
      title: "Send this email?",
      description: `"${subject}" will go to ${who}.`,
      confirmLabel: "Send",
    });
    if (!ok) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-group-email", {
      body: allSelected ? { subject, body, all: true } : { subject, body, doctorIds: selectedIds },
    });
    setSending(false);
    void loadLog();
    if (error || data?.error) {
      toast({ title: "Send failed", description: data?.error ?? (await readError(error, "Try again.")), variant: "destructive" });
      return;
    }
    const sent: string[] = data.sent ?? [];
    const failed: { name: string; error: string }[] = data.failed ?? [];
    const skipped: number = data.skipped ?? 0;
    const parts = [
      failed.length ? `Failed: ${failed.map((f) => `${f.name} (${f.error})`).join(", ")}` : "",
      skipped ? `Skipped ${skipped} inactive or unknown` : "",
    ].filter(Boolean);
    toast({
      title: `Sent to ${sent.length} doctor${sent.length === 1 ? "" : "s"}`,
      description: parts.join(". ") || undefined,
      variant: failed.length ? "destructive" : undefined,
    });
    if (failed.length === 0 && sent.length > 0) {
      setSubject("");
      setBody("");
    }
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
            <Label>Recipients ({selected.length} of {selectable.length})</Label>
            <Button variant="link" size="sm" onClick={() => setExcluded(allSelected ? selectable.map((d) => d.id) : [])}>
              {allSelected ? "Clear all" : "Select all"}
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {active.map((d) => {
              const noEmail = !d.email;
              return (
                <label key={d.id} className={`flex items-center gap-2 text-sm ${noEmail ? "opacity-50" : ""}`}>
                  <Checkbox checked={!noEmail && !excluded.includes(d.id)} disabled={noEmail}
                    onCheckedChange={(c) => setExcluded((s) => (c ? s.filter((x) => x !== d.id) : [...s, d.id]))} />
                  <span>{d.name}</span>
                  <span className="text-muted-foreground truncate">{d.email || "No email on file"}</span>
                </label>
              );
            })}
          </div>
        </div>

        <Button onClick={send} disabled={sending || !subject.trim() || !body.trim() || selectedIds.length === 0}>
          <Send className="h-4 w-4 mr-2" />{sending ? "Sending…" : `Send to ${selectedIds.length} doctor${selectedIds.length === 1 ? "" : "s"}`}
        </Button>

        <div className="space-y-2 border-t pt-4">
          <Label>Recent sends</Label>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">No group emails sent yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {log.map((r) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2">
                  <span className="truncate">{r.subject}</span>
                  <span className="text-muted-foreground">
                    {format(new Date(r.created_at), "MMM d, h:mm a")} · {r.sent_count}/{r.recipient_count} sent
                    {r.failed_count ? ` · ${r.failed_count} failed` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
