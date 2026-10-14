-- RUANG AWARDEE · ETOS ID Palu — self-only academic and literary snapshot
-- HOLD: apply on approved production release, not before. Existing data remains unchanged.
-- All queries use the awardee_id resolved from auth.uid(), never a browser-provided id.
BEGIN;
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

REVOKE ALL ON FUNCTION public.awardee_self_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.awardee_self_snapshot() FROM anon;
GRANT EXECUTE ON FUNCTION public.awardee_self_snapshot() TO authenticated;
COMMENT ON FUNCTION public.awardee_self_snapshot() IS
'READMAP-authenticated awardee only: returns own minimal identity, semester IP, academic summary, writing and reading counts. No arbitrary awardee_id arguments.';
COMMIT;