-- Runs in Supabase pg_cron (GMT/UTC), independent of ChatGPT/Vercel deploy.
-- 00:00 UTC Monday == 08:00 WITA Monday.
SELECT cron.schedule('etos-asrama-palu-2026-weekly','0 0 * * 1',
 $$SELECT public.sync_asrama_sheet_direct();$$);