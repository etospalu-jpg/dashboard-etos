-- ETOS ID Palu: secure Google Sheets asrama attendance integration.
-- Keeps pembinaan wilayah rows intact; all imported rows are explicitly tagged 'asrama'.
ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'wilayah',
  ADD COLUMN IF NOT EXISTS source_external_key text,
  ADD COLUMN IF NOT EXISTS source_spreadsheet_id text;
ALTER TABLE public.attendance_sessions
  DROP CONSTRAINT IF EXISTS attendance_sessions_source_type_check;
ALTER TABLE public.attendance_sessions
  ADD CONSTRAINT attendance_sessions_source_type_check CHECK (source_type IN ('wilayah','asrama'));
CREATE UNIQUE INDEX IF NOT EXISTS attendance_sessions_asrama_source_unique
  ON public.attendance_sessions(source_external_key)
  WHERE source_type='asrama' AND source_external_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.asrama_identity_map(
  source_name text PRIMARY KEY,
  awardee_id uuid NOT NULL UNIQUE REFERENCES public.awardees(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.asrama_identity_map ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.asrama_identity_map FROM PUBLIC,anon,authenticated;

-- Keep only a hash of the one-time key. The token is created by Superadmin.
CREATE TABLE IF NOT EXISTS public.asrama_sync_settings(
 integration_id text PRIMARY KEY DEFAULT 'asrama_2026'
  CHECK(integration_id='asrama_2026'),
 spreadsheet_id text NOT NULL,
 key_hash text,
 last_sync_at timestamptz,
 last_session_count integer NOT NULL DEFAULT 0,
 last_record_count integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(key_hash IS NULL OR key_hash ~ '^[a-f0-9]{64}$')
);
ALTER TABLE public.asrama_sync_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.asrama_sync_settings FROM PUBLIC,anon,authenticated;
INSERT INTO public.asrama_sync_settings(integration_id,spreadsheet_id)
 VALUES ('asrama_2026','1GlzHEfjY0QDZNs7lntoUEjoANqiRN5JYRVlG-Em0aVA')
 ON CONFLICT (integration_id) DO NOTHING;

-- Map the exact seven real Sheet column labels to stable Awardee IDs.
INSERT INTO public.asrama_identity_map(source_name,awardee_id)
SELECT d.name,a.id FROM (VALUES
 ('Awaina','AWD-0017'),('Jelita','AWD-0018'),
 ('Nur Afni','AWD-0019'),('Putri','AWD-0020'),
 ('Risky Maharani','AWD-0021'),('Wiwid Awrel','AWD-0022'),
 ('Zahratun Sita','AWD-0023')
) AS d(name,legacy_id)
JOIN public.awardees a ON a.legacy_id=d.legacy_id AND a.angkatan='2026'
ON CONFLICT (source_name) DO NOTHING;

-- Safe atomic snapshot, called ONLY from Supabase Edge with service_role.
-- Each spreadsheet row contains agendaId, date (ISO), title and statuses by source name.
CREATE OR REPLACE FUNCTION public.apply_asrama_sheet_snapshot(p_sheet text,p_events jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_event jsonb;v_code text;v_date text;v_title text;v_status jsonb;
 v_label text;v_state text;v_awardee uuid;v_session uuid;
 v_keys text[] := '{}';v_expected int;v_count int:=0;v_sessions int:=0;
 v_source text;
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

 -- Changes happen transactionally; a correction updates rather than adds duplicates.
 FOR v_event IN SELECT value FROM jsonb_array_elements(p_events) LOOP
  v_code:=v_event->>'agendaId';v_date:=v_event->>'date';v_title:=btrim(v_event->>'title');v_status:=v_event->'statuses';
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
   INSERT INTO public.attendance_sessions(activity_name,activity_date,target_cohort,source_type,source_external_key,source_spreadsheet_id)
   VALUES('Asrama · '||v_title,v_date::date,'2026','asrama',v_source,p_sheet)
   RETURNING id INTO v_session;
  ELSE
   UPDATE public.attendance_sessions SET activity_name='Asrama · '||v_title,
     activity_date=v_date::date,target_cohort='2026',updated_at=now()
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
END;$$;
REVOKE ALL ON FUNCTION public.apply_asrama_sheet_snapshot(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_asrama_sheet_snapshot(text,jsonb) TO service_role;

-- Personal summary includes only sessions where this Awardee has a recorded status.
-- Unfilled planned agenda rows are never counted as absence.
CREATE OR REPLACE FUNCTION public.my_attendance_report()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_awardee uuid;v_name text;v_cohort text;v_rows jsonb;
BEGIN
 SELECT a.id,a.name,a.angkatan INTO v_awardee,v_name,v_cohort
 FROM public.readmap_memberships m
 JOIN public.awardees a ON a.id=m.awardee_id
 WHERE m.user_id=(SELECT auth.uid()) AND lower(a.status)='aktif';
 IF v_awardee IS NULL THEN RAISE EXCEPTION 'Akun Awardee aktif diperlukan' USING ERRCODE='42501';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'date',s.activity_date,'agenda',s.activity_name,'type',s.source_type,
  'status',r.status::text,'sessionId',s.id
 ) ORDER BY s.activity_date,s.activity_name),'[]'::jsonb)
 INTO v_rows
 FROM public.attendance_records r
 JOIN public.attendance_sessions s ON s.id=r.session_id
 WHERE r.awardee_id=v_awardee AND s.activity_date IS NOT NULL
   AND r.status IS NOT NULL
   AND (s.source_type<>'asrama' OR v_cohort='2026');
 RETURN jsonb_build_object('name',v_name,'cohort',v_cohort,'records',v_rows);
END;$$;
REVOKE ALL ON FUNCTION public.my_attendance_report() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_attendance_report() TO authenticated;
