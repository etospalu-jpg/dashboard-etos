-- ETOS READMAP: isolated, additive schema for reading and learning records.
-- All rows belong to existing public.awardees; no changes to existing tables or roles.
create table if not exists public.readmap_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  awardee_id uuid not null unique references public.awardees(id) on delete cascade,
  username text not null unique check (username ~ '^ETOS26-[A-F0-9]{10}
);
create table if not exists public.readmap_books (
  id uuid primary key default gen_random_uuid(),
  awardee_id uuid not null references public.awardees(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 200),
  author text,
  category text not null check (category in ('Pengembangan Diri','Keislaman','Akademik & Sains','Sejarah & Sosial','Bisnis & Karier','Sastra & Fiksi','Kepemimpinan','Lainnya')),
  format text not null default 'Fisik' check (format in ('Fisik','Digital')),
  total_pages integer check (total_pages between 1 and 20000),
  status text not null default 'Sedang Dibaca' check (status in ('Sedang Dibaca','Selesai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists readmap_books_awardee_idx on public.readmap_books(awardee_id,created_at desc);
create table if not exists public.readmap_reading_entries (
  id uuid primary key default gen_random_uuid(),
  awardee_id uuid not null references public.awardees(id) on delete cascade,
  book_id uuid not null references public.readmap_books(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start)=1),
  input_mode text not null check (input_mode in ('rentang','jumlah')),
  from_page integer check (from_page between 1 and 20000),
  to_page integer check (to_page between 1 and 20000),
  pages_read integer not null check (pages_read between 1 and 20000),
  insight text not null check (length(trim(insight)) between 8 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint readmap_entry_unique_week_book unique (awardee_id,week_start,book_id),
  constraint readmap_entry_range_check check (
    (input_mode='rentang' and from_page is not null and to_page is not null
     and to_page >= from_page and pages_read=to_page-from_page+1)
    or (input_mode='jumlah' and from_page is null and to_page is null)
  )
);
create index if not exists readmap_entries_week_idx on public.readmap_reading_entries(awardee_id,week_start desc);
create table if not exists public.readmap_weekly_status (
  awardee_id uuid not null references public.awardees(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start)=1),
  no_reading boolean not null default false,
  note text check (length(note)<=500),
  submitted_at timestamptz not null default now(),
  primary key(awardee_id,week_start)
);
create table if not exists public.readmap_videos (
  id uuid primary key default gen_random_uuid(),
  awardee_id uuid not null references public.awardees(id) on delete cascade,
  youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null check (length(title) between 1 and 255),
  thumbnail_url text,
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 86400),
  last_position_seconds integer not null default 0 check (last_position_seconds between 0 and 86400),
  watched_intervals jsonb not null default '[]'::jsonb check(jsonb_typeof(watched_intervals)='array'),
  status text not null default 'Belum Dimulai' check (status in ('Belum Dimulai','Sedang Belajar','Selesai')),
  insight text check (length(insight)<=2000),
  last_watched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint readmap_videos_awardee_youtube_key unique(awardee_id,youtube_id)
);
create index if not exists readmap_videos_awardee_idx on public.readmap_videos(awardee_id,updated_at desc);

-- Check that each reading entry's book belongs to the same awardee.
create or replace function private.readmap_check_entry_owner()
returns trigger language plpgsql set search_path='' as $$
begin
  if not exists (select 1 from public.readmap_books b where b.id=new.book_id and b.awardee_id=new.awardee_id) then
    raise exception 'Buku tidak sesuai dengan pemilik laporan';
  end if;
  return new;
end;
$$;
drop trigger if exists readmap_entry_book_owner_guard on public.readmap_reading_entries;
create trigger readmap_entry_book_owner_guard before insert or update on public.readmap_reading_entries
for each row execute function private.readmap_check_entry_owner();

-- Accounts are provisioned server-side using Supabase Auth Admin and a generated username/PIN.
-- No public self-claim RPC or registration permission is granted.
-- Self-only membership lookup; all editing rights are constrained per awardee.
alter table public.readmap_memberships enable row level security;
alter table public.readmap_books enable row level security;
alter table public.readmap_reading_entries enable row level security;
alter table public.readmap_weekly_status enable row level security;
alter table public.readmap_videos enable row level security;
revoke all on public.readmap_memberships,public.readmap_books,public.readmap_reading_entries,public.readmap_weekly_status,public.readmap_videos from anon,authenticated;
grant select on public.readmap_memberships to authenticated;
grant select,insert,update,delete on public.readmap_books,public.readmap_reading_entries,public.readmap_weekly_status,public.readmap_videos to authenticated;
create policy readmap_member_self on public.readmap_memberships for select to authenticated
using (user_id=(select auth.uid()));
create policy readmap_book_self on public.readmap_books for all to authenticated
using (awardee_id in (select awardee_id from public.readmap_memberships where user_id=(select auth.uid())))
with check (awardee_id in (select awardee_id from public.readmap_memberships where user_id=(select auth.uid())));
create policy readmap_entry_self on public.readmap_reading_entries for all to authenticated
using (awardee_id in (select awardee_id from public.readmap_memberships where user_id=(select auth.uid())))
with check (awardee_id in (select awardee_id from public.readmap_memberships where user_id=(select auth.uid())));
create policy readmap_week_self on public.readmap_weekly_status for all to authenticated
using (awardee_id in (select awardee_id from public.readmap_memberships where user_id=(select auth.uid())))
with check (awardee_id in (select awardee_id from public.readmap_memberships where user_id=(select auth.uid())));
create policy readmap_video_self on public.readmap_videos for all to authenticated
using (awardee_id in (select awardee_id from public.readmap_memberships where user_id=(select auth.uid())))
with check (awardee_id in (select awardee_id from public.readmap_memberships where user_id=(select auth.uid())));

-- Permission isolation: do not grant public UPDATE access to legacy awardee records.
comment on table public.readmap_memberships is 'Provisioned username-to-awardee mapping for READMAP; passwords are hashed by Supabase Auth.';
comment on table public.readmap_videos is 'Playback progress is automatically reported by the embedded YouTube player; it is not proof of attention.';
),
  created_at timestamptz not null default now()
);
create table if not exists public.readmap_books (
  id uuid primary key default gen_random_uuid(),
  awardee_id uuid not null references public.awardees(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 200),
  author text,
  category text not null check (category in ('Pengembangan Diri','Keislaman','Akademik & Sains','Sejarah & Sosial','Bisnis & Karier','Sastra & Fiksi','Kepemimpinan','Lainnya')),
  format text not null default 'Fisik' check (format in ('Fisik','Digital')),
  total_pages integer check (total_pages between 1 and 20000),
  status text not null default 'Sedang Dibaca' check (status in ('Sedang Dibaca','Selesai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists readmap_books_awardee_idx on public.readmap_books(awardee_id,created_at desc);
create table if not exists public.readmap_reading_entries (
  id uuid primary key default gen_random_uuid(),
  awardee_id uuid not null references public.awardees(id) on delete cascade,
  book_id uuid not null references public.readmap_books(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start)=1),
  input_mode text not null check (input_mode in ('rentang','jumlah')),
  from_page integer check (from_page between 1 and 20000),
  to_page integer check (to_page between 1 and 20000),
  pages_read integer not null check (pages_read between 1 and 20000),
  insight text not null check (length(trim(insight)) between 8 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint readmap_entry_unique_week_book unique (awardee_id,week_start,book_id),
  constraint readmap_entry_range_check check (
    (input_mode='rentang' and from_page is not null and to_page is not null
     and to_page >= from_page and pages_read=to_page-from_page+1)
    or (input_mode='jumlah' and from_page is null and to_page is null)
  )
);
create index if not exists readmap_entries_week_idx on public.readmap_reading_entries(awardee_id,week_start desc);
create table if not exists public.readmap_weekly_status (
  awardee_id uuid not null references public.awardees(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start)=1),
  no_reading boolean not null default false,
  note text check (length(note)<=500),
  submitted_at timestamptz not null default now(),
  primary key(awardee_id,week_start)
);
create table if not exists public.readmap_videos (
  id uuid primary key default gen_random_uuid(),
  awardee_id uuid not null references public.awardees(id) on delete cascade,
  youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null check (length(title) between 1 and 255),
  thumbnail_url text,
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 86400),
  last_position_seconds integer not null default 0 check (last_position_seconds between 0 and 86400),
  watched_intervals jsonb not null default '[]'::jsonb check(jsonb_typeof(watched_intervals)='array'),
  status text not null default 'Belum Dimulai' check (status in ('Belum Dimulai','Sedang Belajar','Selesai')),
  insight text check (length(insight)<=2000),
  last_watched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint readmap_videos_awardee_youtube_key unique(awardee_id,youtube_id)
);
create index if not exists readmap_videos_awardee_idx on public.readmap_videos(awardee_id,updated_at desc);

-- Check that each reading entry's book belongs to the same awardee.
create or replace function private.readmap_check_entry_owner()
returns trigger language plpgsql set search_path='' as $$
begin
  if not exists (select 1 from public.readmap_books b where b.id=new.book_id and b.awardee_id=new.awardee_id) then
    raise exception 'Buku tidak sesuai dengan pemilik laporan';
  end if;
  return new;
end;
$$;
drop trigger if exists readmap_entry_book_owner_guard on public.readmap_reading_entries;
create trigger readmap_entry_book_owner_guard before insert or update on public.readmap_reading_entries
for each row execute function private.readmap_check_entry_owner();

-- Claim access only after a real verified Supabase email session.
-- The email must match exactly one active existing awardee contact.
create or replace function public.readmap_claim_account()
returns table(awardee_id uuid) language plpgsql security definer
set search_path='' as $$
declare
  uid uuid := (select auth.uid());
  verified_email text;
  matched_id uuid;
  matches integer;
begin
  if uid is null then raise exception 'Sesi masuk diperlukan'; end if;
  select lower(trim(u.email)) into verified_email from auth.users u
  where u.id=uid and u.email_confirmed_at is not null;
  if coalesce(verified_email,'')='' then raise exception 'Email belum diverifikasi'; end if;
  select count(*),min(a.id) into matches,matched_id
  from public.awardee_contacts c join public.awardees a on a.id=c.awardee_id
  where lower(trim(c.email))=verified_email and lower(a.status)='aktif';
  if matches<>1 then raise exception 'Email belum terhubung dengan satu awardee aktif. Hubungi admin ETOS Palu.'; end if;
  if exists(select 1 from public.readmap_memberships m where m.user_id=uid and m.awardee_id<>matched_id) then
    raise exception 'Akun sudah terhubung dengan awardee lain';
  end if;
  if exists(select 1 from public.readmap_memberships m where m.awardee_id=matched_id and m.user_id<>uid) then
    raise exception 'Awardee ini sudah memiliki akun';
  end if;
  insert into public.readmap_memberships(user_id,awardee_id) values(uid,matched_id)
  on conflict(user_id) do nothing;
  return query select matched_id;
end;
$$;
revoke all on function public.readmap_claim_account() from public,anon;
grant execute on function public.readmap_claim_account() to authenticated;

-- Self-only membership lookup; all editing rights are constrained per awardee.
alter table public.readmap_memberships enable row level security;
alter table public.readmap_books enable row level security;
alter table public.readmap_reading_entries enable row level security;
alter table public.readmap_weekly_status enable row level security;
alter table public.readmap_videos enable row level security;
revoke all on public.readmap_memberships,public.readmap_books,public.readmap_reading_entries,public.readmap_weekly_status,public.readmap_videos from anon,authenticated;
grant select on public.readmap_memberships to authenticated;
grant select,insert,update,delete on public.readmap_books,public.readmap_reading_entries,public.readmap_weekly_status,public.readmap_videos to authenticated;
create policy readmap_member_self on public.readmap_memberships for select to authenticated
using (user_id=(select auth.uid()));
create policy readmap_book_self on public.readmap_books for all to authenticated
using (awardee_id in (select awardee_id from public.readmap_memberships where user_id=(select auth.uid())))
with check (awardee_id in (select awardee_id from public.readmap_memberships where user_id=(select auth.uid())));
create policy readmap_entry_self on public.readmap_reading_entries for all to authenticated
using (awardee_id in (select awardee_id from public.readmap_memberships where user_id=(select auth.uid())))
with check (awardee_id in (select awardee_id from public.readmap_memberships where user_id=(select auth.uid())));
create policy readmap_week_self on public.readmap_weekly_status for all to authenticated
using (awardee_id in (select awardee_id from public.readmap_memberships where user_id=(select auth.uid())))
with check (awardee_id in (select awardee_id from public.readmap_memberships where user_id=(select auth.uid())));
create policy readmap_video_self on public.readmap_videos for all to authenticated
using (awardee_id in (select awardee_id from public.readmap_memberships where user_id=(select auth.uid())))
with check (awardee_id in (select awardee_id from public.readmap_memberships where user_id=(select auth.uid())));

-- Permission isolation: do not grant public UPDATE access to legacy awardee records.
comment on table public.readmap_memberships is 'Verified email-to-awardee identity mapping for READMAP.';
comment on table public.readmap_videos is 'Playback progress is automatically reported by the embedded YouTube player; it is not proof of attention.';
