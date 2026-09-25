# OB/GYN On-Call

Call-schedule portal for a small OB/GYN group. Doctors submit unavailable dates and preferred weekends for each N-week block (N = number of active doctors). The admin builds the schedule (manually, by import, or with AI), publishes it, and emails the doctors. Schedules export as calendar files and can be pushed to Google Calendar.

## Run locally

This project uses **bun**:

```sh
bun install
bun run dev
```

Copy `.env.example` to `.env` and fill in the Supabase URL, publishable key and project id.

## Supabase edge function secrets

- `RESEND_API_KEY`, `EMAIL_FROM`: email sending
- `LOVABLE_API_KEY`, `DEEPSEEK_API_KEY`: AI schedule generation and email drafting
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`: Google Calendar connect
- `GOOGLE_CALENDAR_API_KEY`, `ON_CALL_CALENDAR_ID`, `STAFFING_CALENDAR_ID`: calendar reads and publishing
