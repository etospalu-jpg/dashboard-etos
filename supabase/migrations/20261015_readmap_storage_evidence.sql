-- Additive READMAP evidence storage. Only file paths live in Postgres, not image bytes.
alter table public.readmap_reading_entries
 add column if not exists evidence_paths text[] not null default '{}'::text[];
alter table public.readmap_reading_entries
 add constraint readmap_evidence_max3 check (cardinality(evidence_paths) <= 3);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('readmap-reading-evidence','readmap-reading-evidence',false,2097152,array['image/webp'])
on conflict (id) do nothing;

create policy "readmap_evidence_insert_owner" on storage.objects for insert to authenticated
with check(bucket_id='readmap-reading-evidence' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.readmap_memberships m where m.user_id=(select auth.uid())));
create policy "readmap_evidence_select_owner" on storage.objects for select to authenticated
using(bucket_id='readmap-reading-evidence' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.readmap_memberships m where m.user_id=(select auth.uid())));
create policy "readmap_evidence_delete_owner" on storage.objects for delete to authenticated
using(bucket_id='readmap-reading-evidence' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.readmap_memberships m where m.user_id=(select auth.uid())));
comment on column public.readmap_reading_entries.evidence_paths is
 'Storage object paths only, not image contents. Objects stored privately in readmap-reading-evidence.';
