-- ETOS Palu: additive services and Tahsin reflections; existing data untouched.
CREATE TABLE IF NOT EXISTS public.awardee_service_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 awardee_id uuid NOT NULL REFERENCES public.awardees(id) ON DELETE RESTRICT,
 service_type text NOT NULL CHECK(service_type IN ('mind_mate','research_clinic')),
 topic text NOT NULL CHECK(length(btrim(topic)) BETWEEN 3 AND 160),
 details text CHECK(details IS NULL OR length(details)<=2000),
 meeting_method text CHECK(meeting_method IS NULL OR meeting_method IN ('Daring','Tatap muka','Fleksibel')),
 preferred_time text CHECK(preferred_time IS NULL OR length(preferred_time)<=160),
 document_url text CHECK(document_url IS NULL OR (length(document_url)<=800 AND document_url ~ '^https://')),
 status text NOT NULL DEFAULT 'Diajukan' CHECK(status IN ('Diajukan','Dalam Tindak Lanjut','Perlu Konfirmasi','Dijadwalkan','Selesai','Dibatalkan')),
 admin_note text CHECK(admin_note IS NULL OR length(admin_note)<=1500),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_etos_service_awardee ON public.awardee_service_requests(awardee_id,created_at DESC);
ALTER TABLE public.awardee_service_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.awardee_service_requests FROM anon,authenticated;
GRANT SELECT,INSERT ON public.awardee_service_requests TO authenticated;
CREATE POLICY service_request_own_read ON public.awardee_service_requests FOR SELECT TO authenticated
 USING (awardee_id IN (SELECT m.awardee_id FROM public.readmap_memberships m WHERE m.user_id=(SELECT auth.uid())));
CREATE POLICY service_request_own_create ON public.awardee_service_requests FOR INSERT TO authenticated
 WITH CHECK (awardee_id IN (SELECT m.awardee_id FROM public.readmap_memberships m WHERE m.user_id=(SELECT auth.uid()))
 AND status='Diajukan' AND admin_note IS NULL);

CREATE TABLE IF NOT EXISTS public.tahsin_weekly_reflections(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE RESTRICT,
 awardee_id uuid NOT NULL REFERENCES public.awardees(id) ON DELETE RESTRICT,
 lesson text NOT NULL CHECK(length(btrim(lesson)) BETWEEN 8 AND 1200),
 challenges text[] NOT NULL DEFAULT '{}',
 confidence smallint NOT NULL CHECK(confidence BETWEEN 1 AND 5),
 practice_frequency text NOT NULL CHECK(practice_frequency IN ('Belum sempat','1 kali','2–3 kali','4 kali atau lebih')),
 improvement_goal text NOT NULL CHECK(length(btrim(improvement_goal)) BETWEEN 8 AND 900),
 previous_goal_review text CHECK(previous_goal_review IS NULL OR previous_goal_review IN ('Sudah terlaksana','Sebagian terlaksana','Belum terlaksana')),
 submitted_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT tahsin_one_response_per_session UNIQUE(session_id,awardee_id)
);
CREATE INDEX IF NOT EXISTS idx_etos_tahsin_awardee ON public.tahsin_weekly_reflections(awardee_id,submitted_at DESC);
ALTER TABLE public.tahsin_weekly_reflections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tahsin_weekly_reflections FROM anon,authenticated;
GRANT SELECT ON public.tahsin_weekly_reflections TO authenticated;
CREATE POLICY tahsin_own_read ON public.tahsin_weekly_reflections FOR SELECT TO authenticated
 USING (awardee_id IN(SELECT m.awardee_id FROM public.readmap_memberships m WHERE m.user_id=(SELECT auth.uid())));

-- Only registered, PRESENT Tahsin participants can submit. The form URL alone grants nothing.
CREATE OR REPLACE FUNCTION public.submit_my_tahsin_reflection(
 p_session uuid,p_lesson text,p_challenges text[],p_confidence integer,
 p_practice text,p_goal text,p_previous text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_awardee uuid;v_id uuid;
BEGIN
 SELECT m.awardee_id INTO v_awardee FROM public.readmap_memberships m
 JOIN public.awardees a ON a.id=m.awardee_id
 WHERE m.user_id=(SELECT auth.uid()) AND lower(a.status)='aktif';
 IF v_awardee IS NULL THEN RAISE EXCEPTION 'Akun Awardee tidak aktif' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.attendance_records r JOIN public.attendance_sessions s ON s.id=r.session_id
   WHERE s.id=p_session AND s.activity_name ILIKE '%tahsin%'
   AND r.awardee_id=v_awardee AND lower(r.status::text)='hadir'
 ) THEN RAISE EXCEPTION 'Refleksi hanya untuk peserta Tahsin yang tercatat hadir' USING ERRCODE='42501';END IF;
 IF length(btrim(coalesce(p_lesson,''))) NOT BETWEEN 8 AND 1200
 OR length(btrim(coalesce(p_goal,''))) NOT BETWEEN 8 AND 900
 OR p_confidence NOT BETWEEN 1 AND 5
 OR p_practice NOT IN ('Belum sempat','1 kali','2–3 kali','4 kali atau lebih')
 OR (p_previous IS NOT NULL AND p_previous NOT IN ('Sudah terlaksana','Sebagian terlaksana','Belum terlaksana'))
 OR coalesce(array_length(p_challenges,1),0)>5
 THEN RAISE EXCEPTION 'Isi refleksi belum valid';END IF;
 IF EXISTS(SELECT 1 FROM unnest(coalesce(p_challenges,'{}'::text[])) c WHERE length(c)>80)
 THEN RAISE EXCEPTION 'Kategori latihan tidak valid'; END IF;
 INSERT INTO public.tahsin_weekly_reflections(session_id,awardee_id,lesson,challenges,confidence,practice_frequency,improvement_goal,previous_goal_review)
 VALUES(p_session,v_awardee,btrim(p_lesson),coalesce(p_challenges,'{}'::text[]),p_confidence,p_practice,btrim(p_goal),p_previous)
 ON CONFLICT (session_id,awardee_id) DO UPDATE SET
 lesson=EXCLUDED.lesson,challenges=EXCLUDED.challenges,confidence=EXCLUDED.confidence,
 practice_frequency=EXCLUDED.practice_frequency,improvement_goal=EXCLUDED.improvement_goal,
 previous_goal_review=EXCLUDED.previous_goal_review,updated_at=now()
 RETURNING id INTO v_id;
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.submit_my_tahsin_reflection(uuid,text,text[],integer,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_my_tahsin_reflection(uuid,text,text[],integer,text,text,text) TO authenticated;

-- A signed-in Awardee sees only their own Tahsin sessions and previous goal.
CREATE OR REPLACE FUNCTION public.my_tahsin_sessions()
RETURNS TABLE(session_id uuid,activity_name text,activity_date date,reflection_submitted boolean,previous_goal text)
LANGUAGE sql SECURITY DEFINER SET search_path=''
AS $$
 SELECT s.id,s.activity_name,s.activity_date,
 EXISTS(SELECT 1 FROM public.tahsin_weekly_reflections t WHERE t.session_id=s.id AND t.awardee_id=m.awardee_id),
 (SELECT t.improvement_goal FROM public.tahsin_weekly_reflections t
  JOIN public.attendance_sessions prev ON prev.id=t.session_id
  WHERE t.awardee_id=m.awardee_id AND prev.activity_date<s.activity_date
  ORDER BY prev.activity_date DESC,t.submitted_at DESC LIMIT 1)
 FROM public.readmap_memberships m
 JOIN public.awardees a ON a.id=m.awardee_id
 JOIN public.attendance_records r ON r.awardee_id=m.awardee_id
 JOIN public.attendance_sessions s ON s.id=r.session_id
 WHERE m.user_id=(SELECT auth.uid()) AND lower(a.status)='aktif'
 AND s.activity_name ILIKE '%tahsin%' AND lower(r.status::text)='hadir'
 ORDER BY s.activity_date DESC NULLS LAST,s.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.my_tahsin_sessions() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_tahsin_sessions() TO authenticated;
