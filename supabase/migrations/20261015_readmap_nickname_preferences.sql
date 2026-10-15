-- READMAP Awardee: per-account preferred nickname. Official awardees.name is unchanged.
-- Only logged-in READMAP members can update their own nickname.
BEGIN;
CREATE TABLE IF NOT EXISTS public.readmap_nicknames (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text NOT NULL CHECK (char_length(nickname) BETWEEN 2 AND 24 AND nickname ~ '^[[:alnum:] .''-]+$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.readmap_nicknames ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.readmap_nicknames FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.readmap_set_nickname(p_nickname text)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog
AS $nickname$
DECLARE
 v_user uuid := auth.uid();
 v_name text := regexp_replace(btrim(COALESCE(p_nickname,'')), '[[:space:]]+', ' ', 'g');
BEGIN
 IF v_user IS NULL OR NOT EXISTS(SELECT 1 FROM public.readmap_memberships m WHERE m.user_id = v_user) THEN
  RAISE EXCEPTION 'Akses Awardee diperlukan' USING ERRCODE='42501';
 END IF;
 IF v_name = '' THEN
   DELETE FROM public.readmap_nicknames WHERE user_id=v_user;
   RETURN '';
 END IF;
 IF char_length(v_name) < 2 OR char_length(v_name)>24 OR v_name !~ '^[[:alnum:] .''-]+$' THEN
   RAISE EXCEPTION 'Nama panggilan 2–24 karakter; gunakan huruf, angka, spasi, titik, apostrof, atau tanda hubung.' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.readmap_nicknames(user_id,nickname,updated_at)
 VALUES(v_user,v_name,now())
 ON CONFLICT (user_id) DO UPDATE SET nickname=EXCLUDED.nickname, updated_at=now();
 RETURN v_name;
END
$nickname$;
REVOKE ALL ON FUNCTION public.readmap_set_nickname(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.readmap_set_nickname(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.awardee_self_snapshot()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_awardee uuid;
  v_output jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Akses akun Awardee diperlukan' USING ERRCODE = '42501';
  END IF;
  SELECT m.awardee_id INTO v_awardee
  FROM public.readmap_memberships AS m
  WHERE m.user_id = v_user
  LIMIT 1;
  IF v_awardee IS NULL THEN
    RAISE EXCEPTION 'Akun belum terhubung dengan data Awardee' USING ERRCODE = '42501';
  END IF;
  SELECT pg_catalog.jsonb_build_object(
    'identity', (
      SELECT pg_catalog.jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'nickname', COALESCE((SELECT p.nickname FROM public.readmap_nicknames p WHERE p.user_id = v_user),'') ,
        'campus', a.kampus,
        'major', a.jurusan,
        'cohort', a.angkatan,
        'status', a.status,
        'motto', a.motto,
        'photo_url', a.photo_url
      )
      FROM public.awardees AS a WHERE a.id = v_awardee
    ),
    'semesters', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'semester', r.semester,
          'ip', r.ipk,
          'updated_at', r.updated_at
        ) ORDER BY r.semester
      )
      FROM (
        SELECT DISTINCT ON (ar.semester) ar.semester, ar.ipk, ar.updated_at
        FROM public.academic_records AS ar
        WHERE ar.awardee_id = v_awardee
          AND ar.record_type = 'semester'
          AND ar.is_summary IS NOT TRUE
          AND ar.semester BETWEEN 1 AND 12
          AND ar.ipk BETWEEN 0 AND 4
        ORDER BY ar.semester, ar.updated_at DESC NULLS LAST
      ) AS r
    ), '[]'::jsonb),
    'academic_summary', (
      SELECT pg_catalog.jsonb_build_object(
        'label', COALESCE(ar.semester_label, 'Rekap Akademik'),
        'value', ar.ipk,
        'semester_from', ar.semester_from,
        'semester_to', ar.semester_to
      )
      FROM public.academic_records AS ar
      WHERE ar.awardee_id = v_awardee
        AND ar.is_summary IS TRUE
        AND ar.ipk BETWEEN 0 AND 4
      ORDER BY ar.updated_at DESC NULLS LAST LIMIT 1
    ),
    'stats', pg_catalog.jsonb_build_object(
      'published_articles', (
        SELECT count(*) FROM public.gagasan_articles g
        WHERE g.awardee_id = v_awardee AND g.status = 'published' AND g.share_enabled = true
      ),
      'draft_articles', (
        SELECT count(*) FROM public.gagasan_articles g
        WHERE g.awardee_id = v_awardee AND g.status = 'draft'
      ),
      'total_books', (
        SELECT count(*) FROM public.readmap_books b WHERE b.awardee_id = v_awardee
      ),
      'pages_read', (
        SELECT COALESCE(sum(g.pages_read),0)
        FROM public.readmap_reading_entries g WHERE g.awardee_id = v_awardee
      ),
      'achievements', (
        SELECT count(*) FROM public.achievements ac WHERE ac.awardee_id = v_awardee
      )
    ),
    'recent_writings', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', g.id,'title',g.title,'published_at',g.published_at
        ) ORDER BY g.published_at DESC
      )
      FROM (
        SELECT a.id,a.title,a.published_at FROM public.gagasan_articles a
        WHERE a.awardee_id = v_awardee
          AND a.status = 'published' AND a.share_enabled = true
        ORDER BY a.published_at DESC LIMIT 3
      ) g
    ),'[]'::jsonb)
  )
  INTO v_output;
  IF v_output -> 'identity' IS NULL OR v_output -> 'identity' = 'null'::jsonb THEN
    RAISE EXCEPTION 'Profil Awardee tidak tersedia' USING ERRCODE='42501';
  END IF;
  RETURN v_output;
END
$function$;

-- Existing read permission scope is preserved (member must be authenticated).
REVOKE ALL ON FUNCTION public.awardee_self_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.awardee_self_snapshot() TO authenticated;
COMMENT ON TABLE public.readmap_nicknames IS 'Private preferred display name for the logged-in READMAP member; never modifies the official Awardee name.';
COMMIT;
