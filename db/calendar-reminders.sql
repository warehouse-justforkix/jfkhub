-- Calendar reminders (personal, admin-only): store a computed reminder time on
-- calendar entries. Run once in the Supabase SQL editor.
--
-- Phase 1 (this file): adds the columns. The app computes `remind_at` when Karley
-- sets "Remind me" on an entry, and fires an in-app reminder while the hub is open.
-- Phase 2 (later, once push delivery is verified): a pg_cron job reads `remind_at`
-- / `reminded_at` to send a push even when the app is closed.

alter table schedule_notes add column if not exists remind_at   timestamptz;
alter table schedule_notes add column if not exists reminded_at timestamptz;

-- Helps the future cron find due, unsent reminders quickly.
create index if not exists schedule_notes_remind_idx
  on schedule_notes (remind_at)
  where remind_at is not null and reminded_at is null;
