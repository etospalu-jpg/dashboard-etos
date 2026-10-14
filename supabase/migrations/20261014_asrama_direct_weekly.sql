-- Native, fully independent ETOS Palu weekly Google Sheets sync.
-- Publicly readable CSV/Visualization source is pinned to the single Palu asrama sheet/tab.
-- No ChatGPT, Google Drive OAuth, Google Apps Script, Vercel Cron or owner approval required.
-- IMPORTANT: if Google restricts link sharing, the job will fail safely and report an error.
CREATE OR REPLACE FUNCTION public.sync_asrama_sheet_direct()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_source CONSTANT text := '1GlzHEfjY0QDZNs7lntoUEjoANqiRN5JYRVlG-Em0aVA';
  v_url CONSTANT text := 'https://docs.google.com/spreadsheets/d/1GlzHEfjY0QDZNs7lntoUEjoANqiRN5JYRVlG-Em0aVA/gviz/tq?tqx=out:json&gid=1234166377';
  v_expected text[] := ARRAY['Awaina','Jelita','Nur Afni','Putri','Risky Maharani','Wiwid Awrel','Zahratun Sita'];
  v_seen text[] := '{}';
  v_http_status integer;
  v_raw text;
  v_payload text;
  v_sheet jsonb;
  v_rows jsonb;
  v_row jsonb;
  v_head jsonb;
  v_actual text[];
  v_date_raw text;
  v_date_parts text[];
  v_day date;
  v_title text;
  v_code text;
  v_value text;
  v_statuses jsonb;
  v_snapshot jsonb := '[]'::jsonb;
  v_result jsonb;
  v_total integer := 0;
  v_active integer := 0;
  v_i integer;
BEGIN
  SELECT x.status,x.content INTO v_http_status,v_raw FROM public.http_get(v_url) AS x;
  IF v_http_status<>200 OR v_raw IS NULL OR length(v_raw) NOT BETWEEN 1000 AND 200000
    OR position('google.visualization.Query.setResponse(' in v_raw)=0 THEN
    RAISE EXCEPTION 'Google Sheets Palu could not be read (HTTP %). Existing attendance unchanged.',v_http_status;
  END IF;
  v_payload:=btrim(substring(v_raw FROM position('setResponse(' in v_raw)+length('setResponse(')));
  IF right(v_payload,2)<>');' THEN
    RAISE EXCEPTION 'Google Sheets format changed, refusing to update attendance';
  END IF;
  v_sheet:=left(v_payload,length(v_payload)-2)::jsonb;
  IF v_sheet->>'status'<>'ok' OR jsonb_typeof(v_sheet#>'{table,rows}')<>'array' THEN
    RAISE EXCEPTION 'Google Sheets returned an invalid table';
  END IF;
  v_rows:=v_sheet#>'{table,rows}';

  -- Header row must match precisely the seven Palu asrama members; a moved column aborts all writes.
  SELECT r INTO v_head
  FROM jsonb_array_elements(v_rows) r
  WHERE r#>>'{c,0,v}'='ID Agenda'
  LIMIT 1;
  IF v_head IS NULL THEN
    RAISE EXCEPTION 'Google Sheets attendance header missing';
  END IF;
  SELECT array_agg(v_head->'c'->v_i->>'v' ORDER BY v_i) INTO v_actual
  FROM generate_series(4,10) AS v_i;
  IF v_actual IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'The seven Palu Awardee columns changed; no attendance was imported';
  END IF;
  IF (SELECT count(*) FROM public.asrama_identity_map)<>7 THEN
    RAISE EXCEPTION 'Palu Awardee mapping is no longer seven participants';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(v_rows) LOOP
    v_code:=v_row#>>'{c,0,v}';
    IF v_code IS NULL OR v_code !~ '^AGD-[0-9]{3}$' THEN CONTINUE;END IF;
    IF v_code=ANY(v_seen) THEN RAISE EXCEPTION 'Duplicate Palu agenda %',v_code;END IF;
    v_seen:=array_append(v_seen,v_code);
    v_date_raw:=v_row#>>'{c,1,v}';
    v_date_parts:=regexp_match(v_date_raw,'^Date\(([0-9]{4}),([0-9]{1,2}),([0-9]{1,2})\)$');
    IF v_date_parts IS NULL OR v_date_parts[1]<>'2026' THEN
      RAISE EXCEPTION 'Invalid date on Palu agenda %',v_code;
    END IF;
    v_day:=make_date(v_date_parts[1]::integer,v_date_parts[2]::integer+1,v_date_parts[3]::integer);
    IF v_day<DATE '2026-09-01' OR v_day>DATE '2026-12-31' THEN
      RAISE EXCEPTION 'Agenda outside the Palu September-December 2026 scope';
    END IF;
    v_title:=btrim(coalesce(v_row#>>'{c,3,v}',''));
    IF length(v_title) NOT BETWEEN 3 AND 150 THEN
      RAISE EXCEPTION 'Missing title on Palu agenda %',v_code;
    END IF;
    v_statuses:='{}'::jsonb;
    FOR v_i IN 0..6 LOOP
      v_value:=btrim(coalesce(v_row->'c'->(v_i+4)->>'v',''));
      IF v_value<>'' THEN
        IF v_value NOT IN ('Hadir','Izin','Sakit','Alpa') THEN
          RAISE EXCEPTION 'Invalid attendance value on Palu agenda %',v_code;
        END IF;
        v_statuses:=v_statuses || jsonb_build_object(v_expected[v_i+1],v_value);
      END IF;
    END LOOP;
    v_snapshot:=v_snapshot || jsonb_build_array(jsonb_build_object(
      'agendaId',v_code,'date',to_char(v_day,'YYYY-MM-DD'),
      'title',v_title,'statuses',v_statuses
    ));
    v_total:=v_total+1;
    IF v_statuses<>'{}'::jsonb THEN v_active:=v_active+1;END IF;
  END LOOP;

  IF v_total NOT BETWEEN 67 AND 100 THEN
    RAISE EXCEPTION 'Incomplete Palu agenda snapshot (%); no updates applied',v_total;
  END IF;
  -- Safe merge is atomic: no deletion of wilayah sessions or members outside the seven names.
  v_result:=public.apply_asrama_sheet_snapshot(v_source,v_snapshot);
  UPDATE public.asrama_sync_settings
    SET last_connector_at=now(),updated_at=now()
    WHERE integration_id='asrama_2026';
  RETURN v_result || jsonb_build_object('source','supabase_weekly_direct',
    'agendaRows',v_total,'activeAgendaRows',v_active);
END;$$;
REVOKE ALL ON FUNCTION public.sync_asrama_sheet_direct() FROM PUBLIC,anon,authenticated;
