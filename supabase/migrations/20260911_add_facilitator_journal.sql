-- ETOS ID Palu Dashboard v36
-- Persistent facilitator field journal + monthly summaries.

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

create index if not exists facilitator_journal_awardee_observed_idx
  on public.facilitator_journal_entries(awardee_id, observed_at desc);
create index if not exists facilitator_journal_facilitator_observed_idx
  on public.facilitator_journal_entries(facilitator_name, observed_at desc);

alter table public.facilitator_journal_entries enable row level security;

drop policy if exists facilitator_journal_read on public.facilitator_journal_entries;
create policy facilitator_journal_read on public.facilitator_journal_entries
for select to authenticated
using ((select private.can_read_development()));

drop policy if exists facilitator_journal_insert on public.facilitator_journal_entries;
create policy facilitator_journal_insert on public.facilitator_journal_entries
for insert to authenticated
with check ((select private.can_manage_development()));

drop policy if exists facilitator_journal_update on public.facilitator_journal_entries;
create policy facilitator_journal_update on public.facilitator_journal_entries
for update to authenticated
using ((select private.can_manage_development()))
with check ((select private.can_manage_development()));

drop policy if exists facilitator_journal_delete on public.facilitator_journal_entries;
create policy facilitator_journal_delete on public.facilitator_journal_entries
for delete to authenticated
using ((select private.can_admin()));

grant select, insert, update, delete on public.facilitator_journal_entries to authenticated;
grant all privileges on public.facilitator_journal_entries to service_role;

create table if not exists public.facilitator_monthly_summaries (
  id uuid primary key default gen_random_uuid(),
  awardee_id uuid not null references public.awardees(id) on delete cascade,
  month_start date not null,
  facilitator_scope text not null,
  entry_count integer not null default 0 check (entry_count >= 0),
  summary jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  generated_by uuid,
  constraint facilitator_monthly_summary_month_start_check
    check (extract(day from month_start) = 1),
  constraint facilitator_monthly_summary_unique
    unique (awardee_id, month_start, facilitator_scope)
);

create index if not exists facilitator_monthly_summary_awardee_month_idx
  on public.facilitator_monthly_summaries(awardee_id, month_start desc);

alter table public.facilitator_monthly_summaries enable row level security;

drop policy if exists facilitator_monthly_summary_read on public.facilitator_monthly_summaries;
create policy facilitator_monthly_summary_read on public.facilitator_monthly_summaries
for select to authenticated
using ((select private.can_read_development()));

drop policy if exists facilitator_monthly_summary_insert on public.facilitator_monthly_summaries;
create policy facilitator_monthly_summary_insert on public.facilitator_monthly_summaries
for insert to authenticated
with check ((select private.can_manage_development()));

drop policy if exists facilitator_monthly_summary_update on public.facilitator_monthly_summaries;
create policy facilitator_monthly_summary_update on public.facilitator_monthly_summaries
for update to authenticated
using ((select private.can_manage_development()))
with check ((select private.can_manage_development()));

drop policy if exists facilitator_monthly_summary_delete on public.facilitator_monthly_summaries;
create policy facilitator_monthly_summary_delete on public.facilitator_monthly_summaries
for delete to authenticated
using ((select private.can_admin()));

grant select, insert, update, delete on public.facilitator_monthly_summaries to authenticated;
grant all privileges on public.facilitator_monthly_summaries to service_role;
