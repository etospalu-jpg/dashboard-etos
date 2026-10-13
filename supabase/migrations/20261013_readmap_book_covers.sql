-- ETOS READMAP: optional user-uploaded book covers (additive migration).
ALTER TABLE public.readmap_books ADD COLUMN IF NOT EXISTS cover_path text;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('readmap-book-covers','readmap-book-covers',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Private objects are scoped to an authenticated READMAP member's auth.uid folder.
-- RLS policies are enforced by Supabase Storage.
CREATE POLICY "readmap_covers_insert_owner" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
 bucket_id = 'readmap-book-covers'
 AND (storage.foldername(name))[1]=(select auth.uid())::text
 AND EXISTS (SELECT 1 FROM public.readmap_memberships m WHERE m.user_id=(select auth.uid()))
);
CREATE POLICY "readmap_covers_select_owner" ON storage.objects FOR SELECT TO authenticated
USING (
 bucket_id = 'readmap-book-covers'
 AND (storage.foldername(name))[1]=(select auth.uid())::text
 AND EXISTS (SELECT 1 FROM public.readmap_memberships m WHERE m.user_id=(select auth.uid()))
);
CREATE POLICY "readmap_covers_delete_owner" ON storage.objects FOR DELETE TO authenticated
USING (
 bucket_id = 'readmap-book-covers'
 AND (storage.foldername(name))[1]=(select auth.uid())::text
 AND EXISTS (SELECT 1 FROM public.readmap_memberships m WHERE m.user_id=(select auth.uid()))
);
