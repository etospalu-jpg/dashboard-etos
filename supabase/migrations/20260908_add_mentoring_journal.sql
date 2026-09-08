create table if not exists public.mentoring_journal (
  id uuid primary key default gen_random_uuid(),
  mentoring_case_id uuid not null references public.mentoring_cases(id) on delete cascade,
  awardee_id uuid not null references public.awardees(id) on delete cascade,
  session_date date not null default current_date,
  progress_note text not null,
  intervention text,
  awardee_response text,
  follow_up_plan text,
  next_follow_up date,
  status_after text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create index if not exists mentoring_journal_case_idx
  on public.mentoring_journal(mentoring_case_id, session_date desc);

create index if not exists mentoring_journal_awardee_idx
  on public.mentoring_journal(awardee_id, session_date desc);

alter table public.mentoring_journal enable row level security;

drop policy if exists mentoring_journal_read on public.mentoring_journal;
create policy mentoring_journal_read on public.mentoring_journal
for select to authenticated
using ((select private.can_read_development()));

drop policy if exists mentoring_journal_insert on public.mentoring_journal;
create policy mentoring_journal_insert on public.mentoring_journal
for insert to authenticated
with check ((select private.can_manage_development()));

drop policy if exists mentoring_journal_update on public.mentoring_journal;
create policy mentoring_journal_update on public.mentoring_journal
for update to authenticated
using ((select private.can_manage_development()))
with check ((select private.can_manage_development()));

drop policy if exists mentoring_journal_delete on public.mentoring_journal;
create policy mentoring_journal_delete on public.mentoring_journal
for delete to authenticated
using ((select private.can_admin()));

grant select, insert, update, delete on public.mentoring_journal to authenticated;
grant all privileges on public.mentoring_journal to service_role;
