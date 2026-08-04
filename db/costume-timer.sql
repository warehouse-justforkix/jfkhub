-- Defective Costumes → Teehive: 30-day reminder timer.
-- Run once against the Supabase project (SQL editor).
--
-- Self-contained: it defines its OWN security-definer permission helpers
-- (ct_is_member / ct_is_admin) rather than assuming the repo's is_member()/
-- is_admin() exist — the live DB was set up without them.
--
-- What this adds:
--   * costume_timer   — a single row holding the next due date (shared by the team)
--   * team_broadcasts — insert-a-row-to-push-the-whole-team, wired to the SAME
--                       Database Webhook that already serves messages/tasks
--   * fire_costume_reminder_if_due() — atomic "if 30 days are up, push everyone
--                       and restart the clock." Safe to call from every device.
--   * send_costume_reminder_now()    — admin: push the team now and restart.

-- ---------- self-contained permission helpers (bypass RLS, no recursion) ----------
create or replace function public.ct_is_member() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid()) $$;
grant execute on function public.ct_is_member() to authenticated;

create or replace function public.ct_is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;
grant execute on function public.ct_is_admin() to authenticated;

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
  to authenticated using (public.ct_is_member());
drop policy if exists "admin update timer" on costume_timer;
create policy "admin update timer" on costume_timer for update
  to authenticated using (public.ct_is_admin()) with check (public.ct_is_admin());

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
  to authenticated using (public.ct_is_member());
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
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
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

-- ---------- wire the existing push Database Webhook onto team_broadcasts ----------
-- Clones whatever webhook already posts pushes on `messages` (URL + secret args
-- and all) onto team_broadcasts, so an insert here reaches the push-message edge
-- function with table = 'team_broadcasts'. Run AFTER the block above succeeds.
do $$
declare def text;
begin
  select pg_get_triggerdef(t.oid) into def
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
   where c.relname = 'messages' and n.nspname = 'public'
     and not t.tgisinternal
     and p.proname = 'http_request'      -- Supabase Database Webhook function
   limit 1;

  if def is null then
    raise notice 'No Database Webhook found on public.messages — wire team_broadcasts to push-message manually (Database > Webhooks).';
  else
    execute 'drop trigger if exists team_broadcasts_push on public.team_broadcasts';
    def := regexp_replace(def, '^CREATE TRIGGER (\S+|"[^"]*")', 'CREATE TRIGGER team_broadcasts_push');
    def := regexp_replace(def, ' ON public\.messages ', ' ON public.team_broadcasts ');
    execute def;
  end if;
end $$;
