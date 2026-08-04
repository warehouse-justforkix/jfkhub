-- Defective Costumes → Teehive: 30-day reminder timer.
-- Run once against the Supabase project (SQL editor or `supabase db` push).
--
-- What this adds:
--   * costume_timer   — a single row holding the next due date (shared by the team)
--   * team_broadcasts — insert-a-row-to-push-the-whole-team, wired to the SAME
--                       pg_net push trigger that already serves messages/tasks
--   * fire_costume_reminder_if_due() — atomic "if 30 days are up, push everyone
--                       and restart the clock." Safe to call from every device on
--                       load; only the first caller past the due time fires.
--   * send_costume_reminder_now()    — admin: push the team now and restart.
--
-- The push itself is delivered by the existing push-message edge function, which
-- gains a `team_broadcasts` branch that notifies every member (see
-- supabase/functions/push-message/index.ts).

-- ---------- the shared timer (one row) ----------
create table if not exists costume_timer (
  id            int primary key default 1 check (id = 1),
  due_at        timestamptz not null default (now() + interval '30 days'),
  last_sent_at  timestamptz,
  interval_days int not null default 30,
  updated_at    timestamptz not null default now()
);
insert into costume_timer (id) values (1) on conflict (id) do nothing;

alter table costume_timer enable row level security;
drop policy if exists "member read timer" on costume_timer;
create policy "member read timer" on costume_timer for select
  to authenticated using (public.is_member());
drop policy if exists "admin update timer" on costume_timer;
create policy "admin update timer" on costume_timer for update
  to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- team broadcast (insert => push everyone) ----------
create table if not exists team_broadcasts (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,
  title      text not null,
  body       text not null,
  url_hash   text,
  created_at timestamptz not null default now()
);
alter table team_broadcasts enable row level security;
drop policy if exists "member read broadcasts" on team_broadcasts;
create policy "member read broadcasts" on team_broadcasts for select
  to authenticated using (public.is_member());
-- (No insert policy on purpose: rows are written only by the security-definer
--  functions below, never directly by the browser.)

-- ---------- atomic "fire if the 30 days are up" ----------
create or replace function public.fire_costume_reminder_if_due()
returns boolean
language plpgsql security definer set search_path = public as $$
declare fired boolean := false;
begin
  update costume_timer
     set last_sent_at = now(),
         due_at       = now() + make_interval(days => interval_days),
         updated_at   = now()
   where id = 1 and due_at <= now();
  if found then
    insert into team_broadcasts (kind, title, body, url_hash)
    values (
      'defective-costumes',
      'Defective costumes → Teehive',
      'It''s been 30 days — time to send this month''s defective costume stockpile to Teehive.',
      '#defective'
    );
    fired := true;
  end if;
  return fired;
end $$;
grant execute on function public.fire_costume_reminder_if_due() to authenticated;

-- ---------- admin: send the reminder now + restart the clock ----------
create or replace function public.send_costume_reminder_now()
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  update costume_timer
     set last_sent_at = now(),
         due_at       = now() + make_interval(days => interval_days),
         updated_at   = now()
   where id = 1;
  insert into team_broadcasts (kind, title, body, url_hash)
  values (
    'defective-costumes',
    'Defective costumes → Teehive',
    'Reminder: time to send this month''s defective costume stockpile to Teehive.',
    '#defective'
  );
end $$;
grant execute on function public.send_costume_reminder_now() to authenticated;

-- ---------- wire the existing push trigger onto team_broadcasts ----------
-- Reuses whatever trigger function already fires pushes on `messages` (the same
-- one serves announcements + tasks), so no push secret or function URL is needed
-- here. An insert into team_broadcasts will call the edge function with
-- table = 'team_broadcasts'.
do $$
declare fn oid;
begin
  select t.tgfoid into fn
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
   where c.relname = 'messages' and not t.tgisinternal
   limit 1;
  if fn is null then
    raise notice 'No push trigger found on messages; attach a trigger to team_broadcasts manually.';
  else
    execute 'drop trigger if exists team_broadcasts_push on team_broadcasts';
    execute format(
      'create trigger team_broadcasts_push after insert on team_broadcasts '
      'for each row execute function %s',
      fn::regproc
    );
  end if;
end $$;
