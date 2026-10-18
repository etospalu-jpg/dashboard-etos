-- ETOS Palu · 18 October 2026
-- Asrama Sheet continues for non-WAFA programs. WAFA Tahsin sessions are manual.
-- Both asrama-sheet-sync Edge and the direct weekly SQL importer call this function.
CREATE OR REPLACE FUNCTION public.apply_asrama_sheet_snapshot(p_sheet text, p_events jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_event jsonb;v_code text;v_date text;v_title text;v_status jsonb;
 v_label text;v_state text;v_awardee uuid;v_session uuid;
 v_keys text[] := '{}';v_expected int;v_count int:=0;v_sessions int:=0;
 v_source text;v_period uuid;
BEGIN
 IF p_sheet <> '1GlzHEfjY0QDZNs7lntoUEjoANqiRN5JYRVlG-Em0aVA'
 OR jsonb_typeof(p_events) <> 'array'
 OR jsonb_array_length(p_events) NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION 'Format snapshot atau sumber spreadsheet tidak sesuai';
 END IF;
 -- Prevalidate entire snapshot before changing any attendance data.
 FOR v_event IN SELECT value FROM jsonb_array_elements(p_events) LOOP
  v_code:=v_event->>'agendaId';v_date:=v_event->>'date';v_title:=btrim(v_event->>'title');
  v_status:=v_event->'statuses';
  -- Tahsin WAFA (Asrama 2026) is entered manually in Dashboard so that
  -- each attendance session creates its reflection link in the same operation.
  -- Preserve every previously stored Asrama session; never re-import this activity.
  IF (v_code = 'AGD-010' OR lower(coalesce(v_title,'')) ~ '(tahsin.*wafa|wafa.*tahsin|tahfizh.*wafa|wafa.*tahfizh)') THEN CONTINUE; END IF;
  IF v_code IS NULL OR v_code !~ '^AGD-[0-9]{3}$' OR v_code=ANY(v_keys)
     OR v_date IS NULL OR v_date !~ '^2026-(09|10|11|12)-[0-3][0-9]$'
     OR to_char(to_date(v_date,'YYYY-MM-DD'),'YYYY-MM-DD')<>v_date
     OR length(v_title) NOT BETWEEN 3 AND 150
     OR jsonb_typeof(v_status)<>'object' THEN
   RAISE EXCEPTION 'Data agenda asrama belum valid';
  END IF;
  v_keys:=array_append(v_keys,v_code);
  FOR v_label,v_state IN SELECT key,value #>> '{}' FROM jsonb_each(v_status) LOOP
   SELECT m.awardee_id INTO v_awardee FROM public.asrama_identity_map m WHERE m.source_name=v_label;
   IF v_awardee IS NULL OR v_state NOT IN ('Hadir','Izin','Sakit','Alpa') THEN
    RAISE EXCEPTION 'Nama peserta atau status absensi tidak dikenali';
   END IF;
  END LOOP;
 END LOOP;

 SELECT p.id INTO v_period FROM public.development_periods p
 WHERE p.start_date >= DATE '2026-09-01' AND p.start_date <= DATE '2026-12-31'
 ORDER BY CASE WHEN p.status='Aktif' THEN 0 ELSE 1 END,p.start_date DESC LIMIT 1;
 IF v_period IS NULL THEN RAISE EXCEPTION 'Periode pembinaan asrama belum tersedia';END IF;
 -- Changes happen transactionally; a correction updates rather than adds duplicates.
 FOR v_event IN SELECT value FROM jsonb_array_elements(p_events) LOOP
  v_code:=v_event->>'agendaId';v_date:=v_event->>'date';v_title:=btrim(v_event->>'title');v_status:=v_event->'statuses';
  -- Tahsin WAFA (Asrama 2026) is entered manually in Dashboard so that
  -- each attendance session creates its reflection link in the same operation.
  -- Preserve every previously stored Asrama session; never re-import this activity.
  IF (v_code = 'AGD-010' OR lower(coalesce(v_title,'')) ~ '(tahsin.*wafa|wafa.*tahsin|tahfizh.*wafa|wafa.*tahfizh)') THEN CONTINUE; END IF;
  v_source:='asrama2026:'||v_code;
  SELECT s.id INTO v_session FROM public.attendance_sessions s
  WHERE s.source_external_key=v_source AND s.source_type='asrama' FOR UPDATE;
  IF (SELECT count(*)::int FROM jsonb_object_keys(v_status))=0 THEN
    IF v_session IS NOT NULL THEN
      DELETE FROM public.attendance_records WHERE session_id=v_session;
      DELETE FROM public.attendance_sessions WHERE id=v_session;
    END IF;
    CONTINUE;
  END IF;
  IF v_session IS NULL THEN
   INSERT INTO public.attendance_sessions(activity_name,activity_date,target_cohort,period_id,source_type,source_external_key,source_spreadsheet_id)
   VALUES('Asrama · '||v_title,v_date::date,'2026',v_period,'asrama',v_source,p_sheet)
   RETURNING id INTO v_session;
  ELSE
   UPDATE public.attendance_sessions SET activity_name='Asrama · '||v_title,
     activity_date=v_date::date,target_cohort='2026',period_id=v_period,updated_at=now()
   WHERE id=v_session;
  END IF;
  DELETE FROM public.attendance_records r
   WHERE r.session_id=v_session AND NOT EXISTS(
    SELECT 1 FROM jsonb_object_keys(v_status) k
    JOIN public.asrama_identity_map m ON m.source_name=k
    WHERE m.awardee_id=r.awardee_id
   );
  FOR v_label,v_state IN SELECT key,value #>> '{}' FROM jsonb_each(v_status) LOOP
   SELECT m.awardee_id INTO v_awardee FROM public.asrama_identity_map m WHERE m.source_name=v_label;
   INSERT INTO public.attendance_records(session_id,awardee_id,status,notes,checked_at)
   VALUES(v_session,v_awardee,v_state::public.attendance_status,'Sumber: Google Sheets Asrama 2026',now())
   ON CONFLICT(session_id,awardee_id) DO UPDATE
    SET status=EXCLUDED.status,updated_at=now(),checked_at=now();
  END LOOP;
  v_sessions:=v_sessions+1;v_count:=v_count+(SELECT count(*)::int FROM jsonb_object_keys(v_status));
 END LOOP;
 -- Other wilayah sessions are never touched.
 -- Missing agenda keys are not deleted; this avoids accidental data loss on partial fetches.
 UPDATE public.asrama_sync_settings
 SET last_sync_at=now(),last_session_count=v_sessions,last_record_count=v_count,updated_at=now()
 WHERE integration_id='asrama_2026';
 RETURN jsonb_build_object('sessions',v_sessions,'records',v_count,'syncedAt',now());
END;$function$


-- Archive only the pre-reflection Asrama WAFA session (9 Oct 2026).
-- Seven attendance records and the original link remain on disk for audit.
-- Do NOT touch the manually entered 13 Oct 2026 Tahsin session or its reflections.
DO $archive$
DECLARE n integer; r integer;
BEGIN
 SELECT count(*) INTO n FROM public.attendance_sessions
 WHERE source_type='asrama' AND source_external_key='asrama2026:AGD-010'
 AND activity_date=DATE '2026-10-09' AND activity_name ILIKE '%Tahsin WAFA%';
 IF n<>1 THEN RAISE EXCEPTION 'Expected precisely one historic Asrama WAFA session, got %',n; END IF;
 SELECT count(*) INTO r FROM public.attendance_records ar JOIN public.attendance_sessions s ON s.id=ar.session_id
 WHERE s.source_type='asrama' AND s.source_external_key='asrama2026:AGD-010'
 AND s.activity_date=DATE '2026-10-09';
 IF r<>7 THEN RAISE EXCEPTION 'Historic WAFA attendance count changed: %',r; END IF;
 IF EXISTS (SELECT 1 FROM public.tahsin_weekly_reflections tr
 JOIN public.attendance_sessions s ON s.id=tr.session_id
 WHERE s.source_type='asrama' AND s.source_external_key='asrama2026:AGD-010'
 AND s.activity_date=DATE '2026-10-09')
 THEN RAISE EXCEPTION 'Historic WAFA has reflections; manual review required'; END IF;
 UPDATE public.attendance_sessions SET status='arsip'
 WHERE source_type='asrama' AND source_external_key='asrama2026:AGD-010'
 AND activity_date=DATE '2026-10-09'
 AND activity_name ILIKE '%Tahsin WAFA%' AND status='aktif';
END;
$archive$;
