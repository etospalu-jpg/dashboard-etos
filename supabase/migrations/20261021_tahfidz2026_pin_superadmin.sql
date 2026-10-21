
-- Tahfidz Juz 30 angkatan 2026: satu pengelola operasional, akses melalui PIN Superadmin yang sudah ada.
-- PIN tidak disimpan dalam kode ataupun tabel. Semua request tetap melewati sesi PIN di backend.
CREATE TABLE IF NOT EXISTS public.tahfidz_surahs(
 surah_no smallint PRIMARY KEY CHECK(surah_no BETWEEN 1 AND 37),
 name text NOT NULL, ayah_count smallint NOT NULL CHECK(ayah_count>0)
);
INSERT INTO public.tahfidz_surahs(surah_no,name,ayah_count) VALUES
(1,'An-Naba''',40),
(2,'An-Nazi''at',46),
(3,'''Abasa',42),
(4,'At-Takwir',29),
(5,'Al-Infitar',19),
(6,'Al-Mutaffifin',36),
(7,'Al-Insyiqaq',25),
(8,'Al-Buruj',22),
(9,'At-Tariq',17),
(10,'Al-A''la',19),
(11,'Al-Gasyiyah',26),
(12,'Al-Fajr',30),
(13,'Al-Balad',20),
(14,'Asy-Syams',15),
(15,'Al-Lail',21),
(16,'Ad-Duha',11),
(17,'Al-Insyirah',8),
(18,'At-Tin',8),
(19,'Al-''Alaq',19),
(20,'Al-Qadr',5),
(21,'Al-Bayyinah',8),
(22,'Az-Zalzalah',8),
(23,'Al-''Adiyat',11),
(24,'Al-Qari''ah',11),
(25,'At-Takasur',8),
(26,'Al-''Asr',3),
(27,'Al-Humazah',9),
(28,'Al-Fil',5),
(29,'Quraisy',4),
(30,'Al-Ma''un',7),
(31,'Al-Kausar',3),
(32,'Al-Kafirun',6),
(33,'An-Nasr',3),
(34,'Al-Lahab',5),
(35,'Al-Ikhlas',4),
(36,'Al-Falaq',5),
(37,'An-Nas',6)
ON CONFLICT(surah_no) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.tahfidz_plans(
 awardee_id uuid PRIMARY KEY REFERENCES public.awardees(id) ON DELETE RESTRICT,
 start_date date, target_date date, created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT tahfidz_plan_dates CHECK(target_date IS NULL OR start_date IS NULL OR target_date>=start_date)
);
INSERT INTO public.tahfidz_plans(awardee_id)
 SELECT id FROM public.awardees WHERE angkatan='2026' AND lower(status)='aktif'
 ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.tahfidz_baselines(
 awardee_id uuid NOT NULL REFERENCES public.tahfidz_plans(awardee_id) ON DELETE RESTRICT,
 surah_no smallint NOT NULL REFERENCES public.tahfidz_surahs(surah_no),
 accepted_until smallint NOT NULL CHECK(accepted_until>0),
 source_note text NOT NULL DEFAULT 'Kartu kontrol Excel, nilai historis',
 PRIMARY KEY(awardee_id,surah_no)
);
CREATE TABLE IF NOT EXISTS public.tahfidz_submissions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 awardee_id uuid NOT NULL REFERENCES public.tahfidz_plans(awardee_id) ON DELETE RESTRICT,
 surah_no smallint NOT NULL REFERENCES public.tahfidz_surahs(surah_no),
 kind text NOT NULL CHECK(kind IN ('Baru','M')),
 ayah_from smallint NOT NULL CHECK(ayah_from>0),
 ayah_to smallint NOT NULL CHECK(ayah_to>=ayah_from),
 grade text NOT NULL CHECK(grade IN ('L','KL','U')),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=500),
 submitted_on date NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 voided_at timestamptz
);
CREATE INDEX IF NOT EXISTS tahfidz_submissions_awardee_date_idx
 ON public.tahfidz_submissions(awardee_id,submitted_on DESC);
CREATE OR REPLACE FUNCTION public.tahfidz_guard_submission()
 RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $function$
BEGIN
 IF NEW.ayah_to>(SELECT ayah_count FROM public.tahfidz_surahs WHERE surah_no=NEW.surah_no)
 THEN RAISE EXCEPTION 'Ayat melebihi batas surah'; END IF;
 IF TG_OP='INSERT' AND NEW.voided_at IS NOT NULL THEN
  RAISE EXCEPTION 'Setoran baru tidak boleh sudah dibatalkan';
 END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'voided_at') IS DISTINCT FROM (to_jsonb(OLD)-'voided_at')
     OR OLD.voided_at IS NOT NULL OR NEW.voided_at IS NULL THEN
    RAISE EXCEPTION 'Setoran tidak dapat diedit. Batalkan lalu catat ulang.';
  END IF;
 END IF;
 RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS tahfidz_guard_submission_trigger ON public.tahfidz_submissions;
CREATE TRIGGER tahfidz_guard_submission_trigger BEFORE INSERT OR UPDATE
 ON public.tahfidz_submissions FOR EACH ROW EXECUTE FUNCTION public.tahfidz_guard_submission();
CREATE OR REPLACE FUNCTION public.tahfidz_guard_plan()
 RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $function$
BEGIN
 IF NEW.awardee_id<>OLD.awardee_id THEN RAISE EXCEPTION 'Identitas peserta tidak dapat diubah'; END IF;
 RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS tahfidz_guard_plan_trigger ON public.tahfidz_plans;
CREATE TRIGGER tahfidz_guard_plan_trigger BEFORE UPDATE ON public.tahfidz_plans
 FOR EACH ROW EXECUTE FUNCTION public.tahfidz_guard_plan();
-- Semua tabel hanya dapat diakses melalui backend yang sudah memverifikasi
-- sesi PIN Superadmin. Tidak ada policy publik/awardee untuk tulis maupun baca.
ALTER TABLE public.tahfidz_surahs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tahfidz_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tahfidz_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tahfidz_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tahfidz_surahs,public.tahfidz_plans,
 public.tahfidz_baselines,public.tahfidz_submissions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.tahfidz_surahs,public.tahfidz_plans,
 public.tahfidz_baselines,public.tahfidz_submissions TO service_role;
-- Seed historis by exact participant name + cohort, never by approximate surname.
WITH seed(person,surah_no,accepted_until,source_note) AS (
 VALUES ('Awaina',1,35,'Kartu Awaina'),
 ('Jelita',1,40,'Kartu Jelita'),
 ('Nur Afni',1,40,'Kartu Nur Afni'),
 ('Nur Afni',2,46,'Kartu Nur Afni'),
 ('Nur Afni',3,42,'Kartu Nur Afni'),
 ('Putri',1,10,'Kartu Putri (nama sel Excel salah)'),
 ('Zahratun Sita Ramadhani',1,40,'Kartu Zahra')
)
INSERT INTO public.tahfidz_baselines(awardee_id,surah_no,accepted_until,source_note)
 SELECT a.id,s.surah_no,s.accepted_until,s.source_note
 FROM seed s JOIN public.awardees a ON a.name=s.person AND a.angkatan='2026'
 ON CONFLICT(awardee_id,surah_no) DO NOTHING;
