-- ETOS ID Palu Dashboard v36
-- Assessment feature was retired from this dashboard.
-- This migration intentionally targets only the dashboard assessment table.
-- The separate ETOS Assessment Center project is not affected.
-- Health snapshot is updated first so the hourly cron no longer references the retired table.
-- Intentionally no CASCADE: unexpected dependencies must be reviewed explicitly.

create or replace function private.run_etos_health_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actual jsonb;
  parity boolean;
  last_sync timestamptz;
  last_backup timestamptz;
  last_verify timestamptz;
  sync_ok boolean;
  backup_ok boolean;
  verify_ok boolean;
  jobs_ok boolean;
  state text;
  result jsonb;
  auth_summary jsonb;
begin
  actual := jsonb_build_object(
    'awardees', (select count(*) from public.awardees),
    'academic_records', (select count(*) from public.academic_records),
    'achievements', (select count(*) from public.achievements),
    'organization_records', (select count(*) from public.organization_records),
    'rule_analyses', (select count(*) from public.rule_analyses),
    'portfolios', (select count(*) from public.portfolios),
    'reflection_forms', (select count(*) from public.reflection_forms),
    'facilitators', (select count(*) from public.facilitators)
  );

  parity := actual = jsonb_build_object(
    'awardees',16,'academic_records',61,'achievements',19,'organization_records',2,
    'rule_analyses',3,'portfolios',3,'reflection_forms',1,'facilitators',1
  );

  select max(coalesce(completed_at,started_at)) into last_sync
  from public.migration_batches
  where lower(status)='completed';

  select max(coalesce(completed_at,started_at)) into last_backup
  from public.backup_runs
  where lower(status)='completed';

  select max(coalesce(completed_at,started_at)) into last_verify
  from public.backup_verification_runs
  where lower(status)='completed'
    and checksum_ok is true and size_ok is true and json_ok is true and row_counts_ok is true;

  sync_ok := last_sync is not null and last_sync >= now() - interval '150 minutes';
  backup_ok := last_backup is not null and last_backup >= now() - interval '36 hours';
  verify_ok := last_verify is not null and last_verify >= now() - interval '36 hours';

  jobs_ok :=
    exists(select 1 from cron.job where jobname='etos-sheet-sync-hourly' and active)
    and exists(select 1 from cron.job where jobname='etos-logical-backup-daily' and active)
    and exists(select 1 from cron.job where jobname='etos-backup-verify-daily' and active)
    and exists(select 1 from cron.job where jobname='etos-health-snapshot-hourly' and active);

  select jsonb_build_object(
    'profiles',(select count(*) from public.profiles),
    'auth_users',(select count(*) from auth.users),
    'active_accounts',(select count(*) from public.profiles where is_active),
    'inactive_accounts',(select count(*) from public.profiles where not is_active),
    'active_superadmins',(select count(*) from public.profiles where is_active and role::text='superadmin'),
    'pending_email_confirmation',(select count(*) from auth.users where email_confirmed_at is null),
    'orphan_auth_users',(select count(*) from auth.users u left join public.profiles p on p.id=u.id where p.id is null),
    'orphan_profiles',(select count(*) from public.profiles p left join auth.users u on u.id=p.id where u.id is null),
    'consistent',((select count(*) from auth.users u left join public.profiles p on p.id=u.id where p.id is null)=0 and (select count(*) from public.profiles p left join auth.users u on u.id=p.id where u.id is null)=0),
    'rollout_ready',((select count(*) from public.profiles where is_active)>0),
    'latest_login',(select max(last_login_at) from public.profiles),
    'roles',coalesce((select jsonb_object_agg(role_text,cnt) from (select role::text role_text,count(*) cnt from public.profiles group by role::text) x),'{}'::jsonb)
  ) into auth_summary;

  state := case when parity and sync_ok and backup_ok and verify_ok and jobs_ok then 'healthy' else 'degraded' end;
  result := jsonb_build_object(
    'status',state,
    'checked_at',now(),
    'parity_ok',parity,
    'sync_fresh',sync_ok,
    'backup_fresh',backup_ok,
    'backup_verified',verify_ok,
    'cron_ok',jobs_ok,
    'last_sync',last_sync,
    'last_backup',last_backup,
    'last_backup_verification',last_verify,
    'counts',actual,
    'auth',auth_summary
  );

  insert into public.system_health_runs(status,parity_ok,sync_fresh,backup_fresh,cron_ok,details)
  values(state,parity,sync_ok,backup_ok,jobs_ok,result);

  delete from public.system_health_runs where checked_at < now() - interval '30 days';
  return result;
end;
$function$;

revoke all on function private.run_etos_health_snapshot() from public;

drop table if exists public.assessments;
