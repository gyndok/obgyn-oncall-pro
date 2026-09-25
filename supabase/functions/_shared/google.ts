// Shared Google Calendar helpers: token storage/refresh and event cleanup.
// deno-lint-ignore-file no-explicit-any

export const ON_CALL_CALENDAR_ID =
  Deno.env.get('ON_CALL_CALENDAR_ID') ?? 'q6u72r1ummu006qishq90i7iek@group.calendar.google.com';
export const STAFFING_CALENDAR_ID =
  Deno.env.get('STAFFING_CALENDAR_ID') ?? 'odn75bvuc02onjrb0ai9oskbc4@group.calendar.google.com';

const GCAL = 'https://www.googleapis.com/calendar/v3/calendars';

/** Returns a valid access token for the doctor linked to this auth user, refreshing if needed. */
export async function getValidAccessToken(supabase: any, authUserId: string): Promise<string> {
  const { data: doctor } = await supabase
    .from('doctors').select('id').eq('auth_user_id', authUserId).maybeSingle();
  if (!doctor) throw new Error('No doctor record linked to this account.');

  const { data: cred } = await supabase
    .from('google_credentials').select('*').eq('doctor_id', doctor.id).maybeSingle();
  if (!cred?.access_token) {
    throw new Error('Google Calendar not connected. Please authorize Google Calendar access first.');
  }

  const expiresAt = cred.expires_at ? new Date(cred.expires_at) : new Date(0);
  if (expiresAt.getTime() - 60_000 > Date.now()) return cred.access_token;

  if (!cred.refresh_token) throw new Error('Google Calendar token expired. Please reconnect.');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!,
      refresh_token: cred.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token refresh failed [${res.status}]: ${body}. Please disconnect and reconnect Google Calendar.`);
  }
  const tokens = await res.json();
  await supabase.from('google_credentials').update({
    access_token: tokens.access_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('doctor_id', doctor.id);
  return tokens.access_token;
}

export async function deleteGoogleEvent(token: string, calendarId: string, eventId: string): Promise<boolean> {
  const res = await fetch(
    `${GCAL}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.ok || res.status === 404 || res.status === 410) return true;
  console.error(`Delete ${eventId} failed [${res.status}]: ${await res.text()}`);
  return false;
}

/** Lists all events (all pages) matching the given query params. Throws on failure. */
export async function listEvents(token: string, calendarId: string, params: Record<string, string>): Promise<any[]> {
  const items: any[] = [];
  let pageToken: string | undefined;
  do {
    const qs = new URLSearchParams({ singleEvents: 'true', maxResults: '2500', ...params });
    if (pageToken) qs.set('pageToken', pageToken);
    const res = await fetch(`${GCAL}/${encodeURIComponent(calendarId)}/events?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to list events in ${calendarId} [${res.status}]: ${await res.text()}`);
    const json = await res.json();
    items.push(...(json.items ?? []));
    pageToken = json.nextPageToken;
  } while (pageToken);
  return items;
}

/**
 * Removes every Google event this app created for a block.
 * Uses calendar_publishes rows first, then the blockId extended property as a fallback.
 * If `legacy` is provided and nothing else was found, deletes only events inside the block
 * whose title matches one we create.
 */
export async function removeBlockEvents(
  supabase: any,
  token: string,
  blockId: string,
  legacy?: { start: string; end: string },
): Promise<{ deleted: number; failed: number }> {
  let deleted = 0, failed = 0;

  const { data: rows, error } = await supabase
    .from('calendar_publishes').select('*').eq('block_id', blockId);
  if (error) throw new Error(`Failed to read published events: ${error.message}`);

  if (rows && rows.length > 0) {
    for (const r of rows) {
      (await deleteGoogleEvent(token, r.google_calendar_id, r.google_event_id)) ? deleted++ : failed++;
    }
    if (failed === 0) {
      await supabase.from('calendar_publishes').delete().eq('block_id', blockId);
    }
    return { deleted, failed };
  }

  for (const cal of [ON_CALL_CALENDAR_ID, STAFFING_CALENDAR_ID]) {
    let events = await listEvents(token, cal, { privateExtendedProperty: `blockId=${blockId}` });
    if (events.length === 0 && legacy) {
      const all = await listEvents(token, cal, {
        timeMin: `${legacy.start}T00:00:00Z`,
        timeMax: `${legacy.end}T23:59:59Z`,
      });
      events = all.filter((e) => {
        const d = (e.start?.date ?? e.start?.dateTime ?? '').slice(0, 10);
        return d >= legacy.start && d <= legacy.end && /^\S+ (Call|Off)$/.test(e.summary ?? '');
      });
    }
    for (const e of events) {
      (await deleteGoogleEvent(token, cal, e.id)) ? deleted++ : failed++;
    }
  }
  return { deleted, failed };
}
