# Round 2 fixes (from LOVABLE_FIXES_2026-09.md)

I agree with the review. Following the file's own advice, the work goes in batches, and you check the app between them. Each batch starts only after you say "go".

## Batch 1: Security and data loss (Tasks 1 to 5)
1. Delete the unused password-reset email function and the debug "test calendar event" function, both from the code and from the live project.
2. Publishing to Google Calendar: record every event it creates, and delete only those events when republishing. This stops the previous block's last weekend from being wiped. Weekend bundling will only group Fri/Sat/Sun of the same week. The block is marked "published" only if every event was created.
3. Unpublish really removes the events and puts the block status back, after asking you to confirm.
4. Generating or importing a schedule swaps the old one for the new one in a single step, so a failure can't leave you with no schedule. Every schedule is checked first: every day is covered once, only active doctors appear, and names must match exactly. If anything fails, you see a list of problems and nothing is saved.
5. Doctors can no longer edit sensitive fields on their own record. Google sign-in tokens move to a locked table the browser can't read. The Google connect button gets proper protection against forged sign-in requests.

## Batch 2: Emails and doctor portal bugs (Tasks 6 to 8)
- Emails go out from your own verified sender, real failures are reported, and the bulk "undefined" title is gone. **Needs from you:** a sending domain verified in Resend and the "from" address you want.
- Admins are no longer briefly sent to the doctor page. The portal still shows the call schedule when no request period is open. Deadlines are actually enforced, and "Save Draft" no longer un-submits a request.
- Team Status shows counts only (e.g. "2 others picked this weekend"), without exposing other doctors' details.

## Batch 3: AI and small fixes (Tasks 9 and 10)
- One AI scheduling function with a provider choice. It uses a single JSON format, and the prompt is built from the block's real dates and doctors. It also includes the time off you enter for doctors.
- Ten small fixes: the Labor Day date, blank status badges, a crash when a doctor is missing, "my shift" highlighting, the reset-password link, old-data cleanup, submission counts, a sign-in check on the calendar-events function, calendar-file formatting, and fast month clicking.

## Batch 4: UI polish (Tasks 11 to 13 plus the file's final housekeeping)
- Admin: confirmation dialogs, a working CSV export, the correct "Mobile number" label, a separate loading state for each action, tabs that fit on phones, and accessibility labels.
- Doctor portal on phones: an "upcoming shifts" list, a deadline banner, a sticky Save/Submit bar with a summary before submitting, and range selection for unavailable dates.

## Technical notes
- New database pieces: `replace_block_assignments` (security definer, checks admin), a unique index on assignments (block_id, date) after removing duplicates, `google_credentials` (service role only), `link_my_doctor_account()`, and `get_block_request_summary()`. The doctors UPDATE policy becomes admin-only. The doctor_requests write policies check that the block is collecting and the deadline hasn't passed.
- Shared `_shared/google.ts` for refreshing tokens and `_shared/escapeHtml`. Validation lives in `src/lib/schedule/validateAssignments.ts`.
- Project memory prefers calendar-file export over Google sync. Tasks 2, 3 and 5 still fix the existing Google publish path, because you use it today.
