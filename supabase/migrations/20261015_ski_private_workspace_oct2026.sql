-- Personal SKI workspace, all data server-only (no anon/authenticated grants).
create table if not exists public.ski_private_owner (
 id boolean primary key default true check(id),salt text not null,secret_hash text not null,
 failed_attempts integer not null default 0,locked_until timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.ski_report_items (
 id uuid primary key default gen_random_uuid(),
 report_kind text not null check(report_kind in ('fasilitator','espresi','awardee_reminder','prestasi')),
 month_start date not null, status text not null default 'belum' check(status in ('belum','proses','siap','terkirim','terverifikasi')),
 completed_at timestamptz,proof_url text,notes text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(report_kind,month_start),constraint ski_reports_month_start check(extract(day from month_start)=1)
);
create table if not exists public.ski_evidence (
 id uuid primary key default gen_random_uuid(),semester text not null check(semester in ('2026-2','2027-1')),
 indicator_code text not null,title text not null,evidence_url text,notes text,is_verified boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists ski_evidence_period_code_idx on public.ski_evidence(semester,indicator_code,created_at desc);
create table if not exists public.ski_weekly_checks (
 id uuid primary key default gen_random_uuid(),checked_at timestamptz not null default now(),
 source_url text not null,access_state text not null check(access_state in ('blocked','source_unverified','machine_readable')),
 http_status integer,summary text not null
);
create index if not exists ski_weekly_checks_last_idx on public.ski_weekly_checks(checked_at desc);
alter table public.ski_private_owner enable row level security;
alter table public.ski_report_items enable row level security;
alter table public.ski_evidence enable row level security;
alter table public.ski_weekly_checks enable row level security;
revoke all on public.ski_private_owner,public.ski_report_items,public.ski_evidence,public.ski_weekly_checks from anon,authenticated,public;
grant select,insert,update,delete on public.ski_private_owner,public.ski_report_items,public.ski_evidence,public.ski_weekly_checks to service_role;