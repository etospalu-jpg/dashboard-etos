create table if not exists public.integration_secrets (
  provider text primary key,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.integration_secrets enable row level security;
revoke all on table public.integration_secrets from anon, authenticated;
grant select, insert, update, delete on table public.integration_secrets to service_role;
comment on table public.integration_secrets is 'Server-only encrypted integration credentials. No client policies by design.';
