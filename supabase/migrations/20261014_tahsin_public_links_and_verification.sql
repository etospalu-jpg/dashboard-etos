-- Tahsin: short, durable, unguessable links and verified public participants.
-- Existing sessions and reflections are preserved.
ALTER TABLE public.attendance_sessions
 ADD COLUMN IF NOT EXISTS tahsin_public_code text;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_sessions_tahsin_public_code_unique
 ON public.attendance_sessions (tahsin_public_code)
 WHERE tahsin_public_code IS NOT NULL;
CREATE OR REPLACE FUNCTION public.assign_tahsin_public_code()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
BEGIN
 IF new.tahsin_public_code IS NULL AND new.activity_name ILIKE '%tahsin%' THEN
  new.tahsin_public_code := upper(substr(encode(gen_random_bytes(9),'hex'),1,12));
 END IF;
 RETURN new;
END;$$;
DROP TRIGGER IF EXISTS assign_tahsin_public_code_before_insert ON public.attendance_sessions;
CREATE TRIGGER assign_tahsin_public_code_before_insert BEFORE INSERT ON public.attendance_sessions
 FOR EACH ROW EXECUTE FUNCTION public.assign_tahsin_public_code();
UPDATE public.attendance_sessions
 SET tahsin_public_code=upper(substr(encode(gen_random_bytes(9),'hex'),1,12))
 WHERE activity_name ILIKE '%tahsin%' AND tahsin_public_code IS NULL;

CREATE TABLE IF NOT EXISTS public.tahsin_public_verification_limits(
 session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
 awardee_id uuid NOT NULL REFERENCES public.awardees(id) ON DELETE CASCADE,
 failed_attempts integer NOT NULL DEFAULT 0,
 period_started timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(session_id,awardee_id)
);
ALTER TABLE public.tahsin_public_verification_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tahsin_public_verification_limits FROM anon,authenticated;

-- Back-end only. Never expose WhatsApp numbers or verification results to public SQL roles.
CREATE OR REPLACE FUNCTION public.verify_tahsin_public_identity(
 p_reference text,p_legacy_id text,p_suffix text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_session uuid;v_id uuid;v_phone text;v_attempts integer;v_started timestamptz;v_suffix text;
BEGIN
 v_suffix:=regexp_replace(coalesce(p_suffix,''),'[^0-9]','','g');
 IF length(v_suffix)<>4 THEN RAISE EXCEPTION 'Verifikasi tidak sesuai' USING ERRCODE='22023';END IF;
 SELECT s.id INTO v_session FROM public.attendance_sessions s
 WHERE s.activity_name ILIKE '%tahsin%'
 AND (s.tahsin_public_code=upper(trim(coalesce(p_reference,'')))
 OR s.id::text=trim(coalesce(p_reference,''))) LIMIT 1;
 IF v_session IS NULL THEN RAISE EXCEPTION 'Sesi tidak ditemukan' USING ERRCODE='22023';END IF;
 SELECT a.id,c.whatsapp INTO v_id,v_phone
 FROM public.attendance_records r
 JOIN public.awardees a ON a.id=r.awardee_id
 LEFT JOIN public.awardee_contacts c ON c.awardee_id=a.id
 WHERE r.session_id=v_session AND lower(r.status::text)='hadir'
 AND upper(a.legacy_id)=upper(trim(coalesce(p_legacy_id,'')))
 AND lower(a.status)='aktif' LIMIT 1;
 IF v_id IS NULL THEN RAISE EXCEPTION 'Verifikasi tidak sesuai' USING ERRCODE='22023';END IF;
 INSERT INTO public.tahsin_public_verification_limits(session_id,awardee_id)
 VALUES(v_session,v_id) ON CONFLICT DO NOTHING;
 SELECT failed_attempts,period_started INTO v_attempts,v_started
 FROM public.tahsin_public_verification_limits
 WHERE session_id=v_session AND awardee_id=v_id FOR UPDATE;
 IF v_started < now()-interval '30 minutes' THEN
  UPDATE public.tahsin_public_verification_limits
  SET failed_attempts=0,period_started=now()
  WHERE session_id=v_session AND awardee_id=v_id;
  v_attempts:=0;
 END IF;
 IF v_attempts>=8 THEN
  RAISE EXCEPTION 'Batas verifikasi tercapai. Coba lagi setelah 30 menit atau hubungi fasilitator' USING ERRCODE='22023';
 END IF;
 IF length(regexp_replace(coalesce(v_phone,''),'[^0-9]','','g'))<4
 OR right(regexp_replace(coalesce(v_phone,''),'[^0-9]','','g'),4)<>v_suffix THEN
  UPDATE public.tahsin_public_verification_limits
  SET failed_attempts=failed_attempts+1
  WHERE session_id=v_session AND awardee_id=v_id;
  RAISE EXCEPTION 'Empat digit WhatsApp belum sesuai' USING ERRCODE='22023';
 END IF;
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.verify_tahsin_public_identity(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_tahsin_public_identity(text,text,text) TO service_role;
