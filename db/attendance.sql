-- Attendance tracker: ADMIN-PRIVATE log of call-ins / no-shows.
-- Run once in the Supabase SQL editor (project iptnlqfitvmoiofzrmvx).
-- Reuses the ct_is_admin helper from db/costume-timer.sql.
--
-- Unlike the `warnings` table (which staff can see their own of), this table is
-- visible ONLY to admins — one all-or-nothing policy gated on ct_is_admin().

create table if not exists attendance_log (
  id            uuid primary key default gen_random_uuid(),
  staff_name    text not null,
  kind          text not null default 'no-show'
                  check (kind in ('no-show', 'call-in', 'late', 'left-early', 'other')),
  incident_date date not null default current_date,
  note          text,
  created_by    text,
  created_at    timestamptz not null default now()
);

alter table attendance_log enable row level security;

-- Admin-only: read AND write. Non-admins get zero rows and can't insert.
drop policy if exists "admin all attendance" on attendance_log;
create policy "admin all attendance" on attendance_log for all
  to authenticated
  using (public.ct_is_admin())
  with check (public.ct_is_admin());
