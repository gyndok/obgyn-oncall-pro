import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
import { corsHeaders, getAuthenticatedUser, isAdmin, unauthorized, forbidden } from "../_shared/auth.ts";
import {
  ON_CALL_CALENDAR_ID, STAFFING_CALENDAR_ID, getValidAccessToken, removeBlockEvents,
} from "../_shared/google.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const addDays = (d: string, n: number) => {
  const x = utc(d); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10);
};
const lastName = (name: string) => name.split(' ').pop() || name;

interface PlannedEvent {
  calendarId: string;
  doctorId: string;
  startDate: string;
  body: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authedUser = await getAuthenticatedUser(req);
    if (!authedUser) return unauthorized();
    if (!(await isAdmin(authedUser))) return forbidden();

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { blockId } = await req.json().catch(() => ({}));
    if (typeof blockId !== 'string' || !blockId) return json({ success: false, error: 'blockId is required' }, 400);

    const accessToken = await getValidAccessToken(supabase, authedUser.id);

    const { data: block, error: blockError } = await supabase.from('blocks').select('*').eq('id', blockId).single();
    if (blockError) throw new Error(`Failed to fetch block: ${blockError.message}`);
    const blockLabel = `${block.start_monday_date} to ${block.end_sunday_date}`;

    const { data: assignments, error: aErr } = await supabase
      .from('assignments').select('*, doctor:doctors(name)').eq('block_id', blockId).order('date');
    if (aErr) throw new Error(`Failed to fetch assignments: ${aErr.message}`);

    const { data: requests, error: rErr } = await supabase
      .from('doctor_requests').select('*, doctor:doctors(name)').eq('block_id', blockId);
    if (rErr) throw new Error(`Failed to fetch doctor requests: ${rErr.message}`);

    const privateProps = { extendedProperties: { private: { blockId } } };
    const planned: PlannedEvent[] = [];
    const done = new Set<string>();
    const byDate = new Map(assignments.map((a: any) => [a.date, a]));

    for (const a of assignments as any[]) {
      if (done.has(a.date)) continue;
      const dow = utc(a.date).getUTCDay(); // 0 Sun, 5 Fri, 6 Sat
      let days = [a];

      // Bundle only Fri/Sat/Sun of the same weekend for the same doctor
      if (dow === 5 || dow === 6) {
        let cursor = a.date;
        while (utc(cursor).getUTCDay() !== 0) {
          const next = addDays(cursor, 1);
          const na: any = byDate.get(next);
          if (!na || na.doctor_id !== a.doctor_id) break;
          days.push(na);
          cursor = next;
        }
      }
      days.forEach((d) => done.add(d.date));

      const name = a.doctor?.name ?? 'Unknown';
      planned.push({
        calendarId: ON_CALL_CALENDAR_ID,
        doctorId: a.doctor_id,
        startDate: a.date,
        body: {
          summary: `${lastName(name)} Call`,
          description: `Medical on-call duty for ${blockLabel}`,
          start: { date: a.date },
          end: { date: addDays(days[days.length - 1].date, 1) },
          colorId: days.length > 1 ? '4' : dow === 0 || dow >= 5 ? '2' : '1',
          ...privateProps,
        },
      });
    }

    for (const r of requests as any[]) {
      if (!Array.isArray(r.unavailable_dates)) continue;
      const name = r.doctor?.name ?? 'Unknown';
      for (const raw of r.unavailable_dates) {
        const d = String(raw).slice(0, 10);
        planned.push({
          calendarId: STAFFING_CALENDAR_ID,
          doctorId: r.doctor_id,
          startDate: d,
          body: {
            summary: `${lastName(name)} Off`,
            description: `Doctor unavailable for on-call duty - ${blockLabel}`,
            start: { date: d },
            end: { date: addDays(d, 1) },
            colorId: '8',
            ...privateProps,
          },
        });
      }
    }

    // Remove only events this app created for THIS block (throws if listing fails)
    const removed = await removeBlockEvents(supabase, accessToken, blockId, {
      start: block.start_monday_date, end: block.end_sunday_date,
    });
    if (removed.failed > 0) {
      return json({ success: false, error: `Could not remove ${removed.failed} old event(s); publish stopped to avoid duplicates.` }, 502);
    }

    let created = 0;
    const failures: string[] = [];
    for (const ev of planned) {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(ev.calendarId)}/events`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(ev.body),
        },
      );
      if (!res.ok) {
        failures.push(`${ev.body.summary} ${ev.startDate}: [${res.status}] ${await res.text()}`);
        continue;
      }
      const g = await res.json();
      created++;
      const { error: insErr } = await supabase.from('calendar_publishes').insert({
        block_id: blockId,
        doctor_id: ev.doctorId,
        date: ev.startDate,
        google_calendar_id: ev.calendarId,
        google_event_id: g.id,
      });
      if (insErr) console.error('Failed to record published event:', insErr);
    }

    if (failures.length > 0) {
      console.error('Publish failures:', failures);
      return json({
        success: false,
        eventsCreated: created,
        eventsFailed: failures.length,
        error: `${failures.length} of ${planned.length} events failed to publish. The block was not marked published.`,
        failures,
      });
    }

    const { error: updateError } = await supabase.from('blocks').update({
      status: 'published',
      published_at: new Date().toISOString(),
      calendar_events: planned.map((p) => p.body),
    }).eq('id', blockId);
    if (updateError) throw new Error(`Failed to update block status: ${updateError.message}`);

    return json({
      success: true,
      eventsCreated: created,
      eventsDeleted: removed.deleted,
      message: `Published ${created} events to Google Calendar.`,
    });
  } catch (error) {
    console.error('Error in publish-to-calendar:', error);
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
