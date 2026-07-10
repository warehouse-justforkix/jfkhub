-- JFK Warehouse Hub — database setup
-- Run once against the Supabase project.
--
-- Access model:
--   * Admins add emails to `invited_emails`.
--   * Anyone can create an auth account, but only invited emails can create a
--     `profiles` row — and having a profile ("member") is what unlocks all data.
--   * Hours live in `member_hours`, visible only to the member themself + admins.
--   * Messages are member <-> admin only (no member-to-member DMs).
--   * Karley is seeded as the first admin invite.

-- ---------- tables ----------

create table if not exists invited_emails (
  email text primary key,               -- stored lowercase
  is_admin boolean not null default false,
  support_access boolean not null default false,   -- customer-support hub access
  warehouse_access boolean not null default true,    -- warehouse hub access (true+support = both)
  invited_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,           -- stored lowercase
  name text not null,
  role text not null default 'part-time' check (role in ('full-time', 'part-time')),
  is_admin boolean not null default false,
  support_access boolean not null default false,   -- customer-support hub access
  warehouse_access boolean not null default true,    -- warehouse hub access
  avatar text not null default '🙂',              -- emoji profile icon
  avatar_options jsonb,                           -- custom character avatar (DiceBear options); overrides emoji when set
  reminders boolean not null default false,       -- opt-in on-open reminders
  created_at timestamptz not null default now()
);

-- Hours are separate from profiles so they can have stricter visibility:
-- only the member themself and admins can read them.
create table if not exists member_hours (
  profile_id uuid primary key references profiles(id) on delete cascade,
  hours jsonb not null default '{}'::jsonb  -- {"mon": "8:00–4:30", ...}; empty/missing = not scheduled
);

-- Calendar entries: time off, changed hours, meetings, notes.
-- visibility 'admin' = a "view only" entry the admin posts for herself.
create table if not exists schedule_notes (
  id uuid primary key default gen_random_uuid(),
  staff_name text not null,
  note_type text not null check (note_type in ('out', 'different-hours', 'meeting', 'other')),
  start_date date not null,
  end_date date,
  event_time text,                      -- freeform, mainly for meetings ("2:00–3:00 PM")
  details text,
  visibility text not null default 'team' check (visibility in ('team', 'admin')),
  recurrence text not null default 'none' check (recurrence in ('none', 'weekly', 'biweekly', 'monthly')),
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  team text not null default 'warehouse' check (team in ('warehouse', 'support')),
  title text not null,
  details text,
  assigned_to text,               -- profile name; null = up for grabs
  due_date date,
  status text not null default 'open' check (status in ('open', 'done')),
  recurrence text not null default 'none'
    check (recurrence in ('none', 'daily', 'weekdays', 'weekly', 'monthly')),
  photo text,                     -- optional attached photo (resized data URI)
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete set null,
  author_name text not null,
  body text not null,
  photo text,                     -- optional attached photo (resized data URI)
  created_at timestamptz not null default now()
);

-- Time clock: four punch types per day. Presence only — not payroll.
create table if not exists time_punches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  punch_type text not null check (punch_type in ('in', 'lunch-out', 'lunch-in', 'out')),
  punched_at timestamptz not null default now()
);

-- Punch-correction requests: a member proposes a missed/wrong punch;
-- it stays pending until the admin approves (writes the punch) or denies.
create table if not exists punch_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  punch_type text not null check (punch_type in ('in', 'lunch-out', 'lunch-in', 'out')),
  requested_time timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now()
);

-- Daily & weekly checklists: items persist, checks are per-period
-- (period = the date for daily items, the Monday of the week for weekly ones).
create table if not exists checklist_items (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  cadence text not null check (cadence in ('daily', 'weekly')),
  team text not null default 'warehouse' check (team in ('warehouse', 'support')),
  sort_order int not null default 0,
  photo text,                     -- optional attached photo (resized data URI)
  created_at timestamptz not null default now()
);

create table if not exists checklist_checks (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references checklist_items(id) on delete cascade,
  period text not null,
  checked_by text not null,
  checked_at timestamptz not null default now(),
  unique (item_id, period)
);

-- Attendance warnings (no call/no show): PRIVATE — the member + admins only.
create table if not exists warnings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  incident_date date not null default current_date,
  reason text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

-- Restocking list (warehouse floor): anyone adds, assigns themselves, completes.
create table if not exists restock_items (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  note text,
  requested_by text not null,
  assigned_to text,
  status text not null default 'open' check (status in ('open', 'done')),
  photo text,                     -- optional attached photo (resized data URI)
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Supplies-to-order list: needed → ordered → received.
create table if not exists supply_requests (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  note text,
  requested_by text not null,
  status text not null default 'needed' check (status in ('needed', 'ordered', 'received')),
  photo text,                     -- optional attached photo (resized data URI)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per device that opted in to push notifications.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text unique not null,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
-- (RLS: "own push subs" policy — each user manages only their own devices.
--  Pushes are SENT by the push-message edge function via a pg_net trigger on
--  messages; VAPID keys + trigger secret live in Supabase function secrets.)

-- One thread per member; from_admin marks which side sent it.
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles(id) on delete cascade,
  from_admin boolean not null default false,
  sender_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------- helper functions (security definer to avoid RLS recursion) ----------

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid()) $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select is_admin from profiles where id = auth.uid()), false) $$;

create or replace function public.is_invited(check_email text) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from invited_emails where email = lower(check_email)) $$;

create or replace function public.has_support() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select support_access from profiles where id = auth.uid()), false) $$;

create or replace function public.has_warehouse() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select warehouse_access from profiles where id = auth.uid()), false) $$;

-- The admin/support flags always come from the invite, never from the client.
create or replace function public.profiles_set_admin_flag() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.email := lower(new.email);
  select coalesce(i.is_admin, false), coalesce(i.support_access, false), coalesce(i.warehouse_access, true)
    into new.is_admin, new.support_access, new.warehouse_access
    from (select 1) x
    left join invited_emails i on i.email = new.email;
  return new;
end $$;

create trigger profiles_before_insert
  before insert on profiles
  for each row execute function public.profiles_set_admin_flag();

-- Non-admins can't flip is_admin or support_access on updates.
create or replace function public.profiles_guard_admin_flag() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.is_admin := old.is_admin;
    new.support_access := old.support_access;
    new.warehouse_access := old.warehouse_access;
  end if;
  new.email := old.email;  -- email is fixed to the auth account
  return new;
end $$;

create trigger profiles_before_update
  before update on profiles
  for each row execute function public.profiles_guard_admin_flag();

-- ---------- row-level security ----------

alter table invited_emails enable row level security;
alter table profiles enable row level security;
alter table member_hours enable row level security;
alter table schedule_notes enable row level security;
alter table tasks enable row level security;
alter table announcements enable row level security;
alter table messages enable row level security;
alter table time_punches enable row level security;
alter table checklist_items enable row level security;
alter table checklist_checks enable row level security;

-- checklists: strictly team-scoped, same rule as tasks.
create policy "team checklist items" on checklist_items for all
  to authenticated
  using (public.is_member() and (public.is_admin() or (checklist_items.team = 'support' and public.has_support()) or (checklist_items.team = 'warehouse' and public.has_warehouse())))
  with check (public.is_member() and (public.is_admin() or (checklist_items.team = 'support' and public.has_support()) or (checklist_items.team = 'warehouse' and public.has_warehouse())));
create policy "member checklist checks" on checklist_checks for all
  to authenticated using (public.is_member()) with check (public.is_member());

alter table supply_requests enable row level security;
create policy "member all supplies" on supply_requests for all
  to authenticated using (public.is_member()) with check (public.is_member());

alter table restock_items enable row level security;
create policy "member all restock" on restock_items for all
  to authenticated using (public.is_member()) with check (public.is_member());

alter table warnings enable row level security;
create policy "own or admin read warnings" on warnings for select
  to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy "admin insert warnings" on warnings for insert
  to authenticated with check (public.is_admin());
create policy "admin delete warnings" on warnings for delete
  to authenticated using (public.is_admin());

-- invited_emails: admins manage; a signed-in user may see their own row
-- (needed during signup to check whether they're invited).
create policy "own or admin read invites" on invited_emails for select
  to authenticated using (email = lower(auth.email()) or public.is_admin());
create policy "admin insert invites" on invited_emails for insert
  to authenticated with check (public.is_admin());
create policy "admin delete invites" on invited_emails for delete
  to authenticated using (public.is_admin());

-- profiles: members read all (names/roles only — hours live elsewhere);
-- invited users create their own; self or admin edits.
create policy "member read profiles" on profiles for select
  to authenticated using (public.is_member());
create policy "invited create own profile" on profiles for insert
  to authenticated with check (
    id = auth.uid()
    and email = lower(auth.email())
    and public.is_invited(auth.email())
  );
create policy "self or admin update profile" on profiles for update
  to authenticated using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy "admin delete profile" on profiles for delete
  to authenticated using (public.is_admin());

-- member_hours: hours are visible within your own team; only the member/admin can edit.
create policy "team read hours" on member_hours for select
  to authenticated using (
    public.is_admin()
    or exists (
      select 1 from profiles t where t.id = member_hours.profile_id
      and ((public.has_support() and t.support_access) or (public.has_warehouse() and t.warehouse_access))
    )
  );
create policy "own or admin write hours" on member_hours for insert
  to authenticated with check (profile_id = auth.uid() or public.is_admin());
create policy "own or admin update hours" on member_hours for update
  to authenticated using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());
create policy "admin delete hours" on member_hours for delete
  to authenticated using (public.is_admin());

-- calendar entries: members see/edit team entries; admin-only entries are
-- invisible to everyone but admins.
create policy "member notes" on schedule_notes for all
  to authenticated
  using (public.is_member() and (visibility = 'team' or public.is_admin()))
  with check (public.is_member() and (visibility = 'team' or public.is_admin()));

-- tasks: strictly team-scoped — you see your assigned team's board; admins see both.
create policy "team tasks" on tasks for all
  to authenticated
  using (public.is_member() and (public.is_admin() or (tasks.team = 'support' and public.has_support()) or (tasks.team = 'warehouse' and public.has_warehouse())))
  with check (public.is_member() and (public.is_admin() or (tasks.team = 'support' and public.has_support()) or (tasks.team = 'warehouse' and public.has_warehouse())));

-- announcements: members read + post; delete own (admins delete any).
create policy "member read announcements" on announcements for select
  to authenticated using (public.is_member());
create policy "member post announcements" on announcements for insert
  to authenticated with check (public.is_member() and author_id = auth.uid());
create policy "own or admin delete announcements" on announcements for delete
  to authenticated using (author_id = auth.uid() or public.is_admin());

-- messages: a member sees only their own thread with the admins; admins see all.
-- Members can only send into their own thread (never as admin).
create policy "own thread or admin read messages" on messages for select
  to authenticated using (member_id = auth.uid() or public.is_admin());
create policy "send message" on messages for insert
  to authenticated with check (
    (member_id = auth.uid() and from_admin = false)
    or (public.is_admin() and from_admin = true)
  );
create policy "admin delete messages" on messages for delete
  to authenticated using (public.is_admin());

-- time punches: you punch only for yourself; statuses are visible within your
-- own team (same rule as hours); only admins can correct punches directly.
create policy "team read punches" on time_punches for select
  to authenticated using (
    profile_id = auth.uid() or public.is_admin()
    or exists (
      select 1 from profiles t where t.id = time_punches.profile_id
      and ((public.has_support() and t.support_access) or (public.has_warehouse() and t.warehouse_access))
    )
  );
create policy "punch for self" on time_punches for insert
  to authenticated with check (profile_id = auth.uid() and public.is_member());
create policy "own or admin delete punches" on time_punches for delete
  to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy "admin insert punches" on time_punches for insert
  to authenticated with check (public.is_admin());
create policy "admin update punches" on time_punches for update
  to authenticated using (public.is_admin()) with check (public.is_admin());

-- punch requests: a member files/cancels their own pending fix; admin reviews.
alter table punch_requests enable row level security;
create policy "own or admin read punch requests" on punch_requests for select
  to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy "request own punch fix" on punch_requests for insert
  to authenticated with check (profile_id = auth.uid() and public.is_member() and status = 'pending');
create policy "cancel own pending or admin delete" on punch_requests for delete
  to authenticated using ((profile_id = auth.uid() and status = 'pending') or public.is_admin());
create policy "admin review punch requests" on punch_requests for update
  to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- grants ----------
-- Needed when this script runs via the Management API (default privileges
-- don't apply there the way they do in the dashboard SQL editor).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- The push-message edge function (service_role) reads profiles + push_subscriptions.
grant select, insert, update, delete on all tables in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
grant execute on all functions in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;

-- ---------- seed data ----------

insert into invited_emails (email, is_admin)
  values ('karley@justforkix.com', true)
  on conflict (email) do update set is_admin = true;

-- Example tasks so the board isn't empty on day one — edit or remove on the site.
insert into tasks (title, details, recurrence, due_date) values
  ('Restock shipping supplies', 'Boxes, tape, poly mailers at the pack stations', 'weekly', current_date + 1),
  ('Empty trash & sweep pack area', null, 'daily', current_date),
  ('Cycle count — one aisle', 'Pick the next aisle on the clipboard list', 'weekdays', current_date);
