-- Documentation: large-file storage (catalogs up to ~650 MB) + downloads.
-- Run once in the Supabase SQL editor (project iptnlqfitvmoiofzrmvx).
-- Reuses the ct_is_member / ct_is_admin helpers from db/costume-timer.sql.
--
-- ⚠️ 650 MB uploads require a paid Supabase plan. The Free plan caps a single
-- upload at ~50 MB and total storage at 1 GB, so large catalogs will fail to
-- upload on Free regardless of the file_size_limit set below. On Pro you can
-- raise the per-file limit (this sets it to 700 MB) and storage/egress is billed.

-- ---------- storage bucket (private; downloads via short-lived signed URLs) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 700000000)
on conflict (id) do update set file_size_limit = 700000000, public = false;

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
