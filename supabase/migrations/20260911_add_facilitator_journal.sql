-- ETOS ID Palu Dashboard v36
-- Persistent facilitator field journal + monthly summaries.
-- Self-contained authorization helpers avoid dependency on older policy helpers.
-- Existing v35/v36-compatible journal indexes are reused by name to avoid duplicates.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.etos_v36_can_development()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active is true
      and lower(coalesce(p.role::text, '')) in ('facilitator','admin','superadmin')
  );
$$;

create or replace function private.etos_v36_can_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active is true
      and lower(coalesce(p.role::text, '')) in ('admin','superadmin')
  );
$$;

revoke all on function private.etos_v36_can_development() from public;
revoke all on function private.etos_v36_can_admin() from public;
grant execute on function private.etos_v36_can_development() to authenticated;
grant execute on function private.etos_v36_can_admin() to authenticated;
grant execute on function private.etos_v36_can_development() to service_role;
grant execute on function private.etos_v36_can_admin() to service_role;

create table if not exists public.facilitator_journal_entries (
  id uuid primary key default gen_random_uuid(),
  awardee_id uuid not null references public.awardees(id) on delete cascade,
  facilitator_name text not null,
  entry_type text not null,
  note text not null,
  follow_up text,
  attention_level text not null default 'Catatan',
  tags text[] not null default '{}'::text[],
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create index if not exists facilitator_journal_awardee_date_idx
  on public.facilitator_journal_entries(awardee_id, observed_at desc);
create index if not exists facilitator_journal_facilitator_date_idx
  on public.facilitator_journal_entries(facilitator_name, observed_at desc);

alter table public.facilitator_journal_entries enable row level security;

revoke all on table public.facilitator_journal_entries from anon, authenticated;
grant select, insert, update, delete on table public.facilitator_journal_entries to authenticated;
grant all privileges on table public.facilitator_journal_entries to service_role;

drop policy if exists facilitator_journal_read on public.facilitator_journal_entries;
create policy facilitator_journal_read on public.facilitator_journal_entries
for select to authenticated
using ((select private.etos_v36_can_development()));

drop policy if exists facilitator_journal_insert on public.facilitator_journal_entries;
create policy facilitator_journal_insert on public.facilitator_journal_entries
for insert to authenticated
with check ((select private.etos_v36_can_development()));

drop policy if exists facilitator_journal_update on public.facilitator_journal_entries;
create policy facilitator_journal_update on public.facilitator_journal_entries
for update to authenticated
using ((select private.etos_v36_can_development()))
with check ((select private.etos_v36_can_development()));

drop policy if exists facilitator_journal_delete on public.facilitator_journal_entries;
create policy facilitator_journal_delete on public.facilitator_journal_entries
for delete to authenticated
using ((select private.etos_v36_can_admin()));

create table if not exists public.facilitator_monthly_summaries (
  id uuid primary key default gen_random_uuid(),
  awardee_id uuid not null references public.awardees(id) on delete cascade,
  month_start date not null,
  facilitator_scope text not null,
  entry_count integer not null default 0 check (entry_count >= 0),
  summary jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  generated_by uuid,
  constraint facilitator_monthly_summary_month_start_check check (extract(day from month_start) = 1),
  constraint facilitator_monthly_summary_unique unique (awardee_id, month_start, facilitator_scope)
);

create index if not exists facilitator_monthly_awardee_month_idx
  on public.facilitator_monthly_summaries(awardee_id, month_start desc);

alter table public.facilitator_monthly_summaries enable row level security;

revoke all on table public.facilitator_monthly_summaries from anon, authenticated;
grant select, insert, update, delete on table public.facilitator_monthly_summaries to authenticated;
grant all privileges on table public.facilitator_monthly_summaries to service_role;

-- Remove policy names used by the previous journal migration so no legacy permissive
-- policy remains active alongside the v36 policy set.
drop policy if exists facilitator_monthly_read on public.facilitator_monthly_summaries;
drop policy if exists facilitator_monthly_insert on public.facilitator_monthly_summaries;
drop policy if exists facilitator_monthly_update on public.facilitator_monthly_summaries;
drop policy if exists facilitator_monthly_delete on public.facilitator_monthly_summaries;

drop policy if exists facilitator_monthly_summary_read on public.facilitator_monthly_summaries;
create policy facilitator_monthly_summary_read on public.facilitator_monthly_summaries
for select to authenticated
using ((select private.etos_v36_can_development()));

drop policy if exists facilitator_monthly_summary_insert on public.facilitator_monthly_summaries;
create policy facilitator_monthly_summary_insert on public.facilitator_monthly_summaries
for insert to authenticated
with check ((select private.etos_v36_can_development()));

drop policy if exists facilitator_monthly_summary_update on public.facilitator_monthly_summaries;
create policy facilitator_monthly_summary_update on public.facilitator_monthly_summaries
for update to authenticated
using ((select private.etos_v36_can_development()))
with check ((select private.etos_v36_can_development()));

drop policy if exists facilitator_monthly_summary_delete on public.facilitator_monthly_summaries;
create policy facilitator_monthly_summary_delete on public.facilitator_monthly_summaries
for delete to authenticated
using ((select private.etos_v36_can_admin()));
