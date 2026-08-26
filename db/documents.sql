-- Documentation: file storage (up to 50 MB per file) + downloads.
-- Run once in the Supabase SQL editor (project iptnlqfitvmoiofzrmvx).
-- Reuses the ct_is_member / ct_is_admin helpers from db/costume-timer.sql.
--
-- Sized for the Supabase Free plan: 50 MB per file, 1 GB total storage.
-- (To allow larger files later, upgrade to Pro and raise file_size_limit.)

-- ---------- storage bucket (private; downloads via short-lived signed URLs) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)   -- 50 MB
on conflict (id) do update set file_size_limit = 52428800, public = false;

-- storage.objects policies for the documents bucket.
-- (select + insert + update are all needed so resumable/chunked uploads work.)
drop policy if exists "docs read" on storage.objects;
create policy "docs read" on storage.objects for select
  to authenticated using (bucket_id = 'documents' and public.ct_is_member());

drop policy if exists "docs insert" on storage.objects;
create policy "docs insert" on storage.objects for insert
  to authenticated with check (bucket_id = 'documents' and public.ct_is_member());

drop policy if exists "docs update" on storage.objects;
create policy "docs update" on storage.objects for update
  to authenticated
  using (bucket_id = 'documents' and public.ct_is_member())
  with check (bucket_id = 'documents' and public.ct_is_member());

drop policy if exists "docs delete" on storage.objects;
create policy "docs delete" on storage.objects for delete
  to authenticated using (bucket_id = 'documents' and public.ct_is_member());

-- ---------- metadata table (one row per uploaded file) ----------
create table if not exists documents (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  file_path    text not null,          -- object path in the 'documents' bucket
  size         bigint,
  content_type text,
  uploaded_by  text,
  created_at   timestamptz not null default now()
);

alter table documents enable row level security;

drop policy if exists "member read docs" on documents;
create policy "member read docs" on documents for select
  to authenticated using (public.ct_is_member());

drop policy if exists "member add docs" on documents;
create policy "member add docs" on documents for insert
  to authenticated with check (public.ct_is_member());

drop policy if exists "own or admin delete docs" on documents;
create policy "own or admin delete docs" on documents for delete
  to authenticated
  using (public.ct_is_admin() or uploaded_by = (select name from public.profiles where id = auth.uid()));
