-- Performances calendar: team-wide parades / performances / shows.
-- Run once in the Supabase SQL editor (project iptnlqfitvmoiofzrmvx).
-- Reuses the ct_is_member / ct_is_admin helpers created by db/costume-timer.sql.

create table if not exists performances (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  kind        text not null default 'performance'
                check (kind in ('parade', 'performance', 'show')),
  perf_date   date not null,
  end_date    date,                 -- optional, for multi-day events
  details     text,
  created_by  text,                 -- profile name of whoever added it
  created_at  timestamptz not null default now()
);

alter table performances enable row level security;

-- Any member can see and add; only the creator or an admin can edit/delete.
drop policy if exists "member read performances" on performances;
create policy "member read performances" on performances for select
  to authenticated using (public.ct_is_member());

drop policy if exists "member add performances" on performances;
create policy "member add performances" on performances for insert
  to authenticated with check (public.ct_is_member());

drop policy if exists "own or admin update performances" on performances;
create policy "own or admin update performances" on performances for update
  to authenticated
  using (public.ct_is_admin() or created_by = (select name from public.profiles where id = auth.uid()))
  with check (public.ct_is_admin() or created_by = (select name from public.profiles where id = auth.uid()));

drop policy if exists "own or admin delete performances" on performances;
create policy "own or admin delete performances" on performances for delete
  to authenticated
  using (public.ct_is_admin() or created_by = (select name from public.profiles where id = auth.uid()));
