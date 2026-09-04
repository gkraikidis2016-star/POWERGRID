-- POWERGRID V3 - Supabase database
-- 1) Supabase Dashboard -> SQL Editor -> New query
-- 2) Κάνε paste όλο αυτό και πάτησε Run.
-- 3) Μετά φτιάξε τον πρώτο λογαριασμό διαχειριστή από Authentication -> Users
--    και βάλε το email του στο τελευταίο UPDATE.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'worker' check (role in ('worker','admin')),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null default current_date,
  status text not null default 'pending' check (status in ('pending','approved','rejected','absent')),
  note text,
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id)
);

create unique index if not exists attendance_one_per_day on public.attendance(user_id, work_date);

create table if not exists public.time_off_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_type text not null check (request_type in ('day_off','leave')),
  start_date date not null,
  end_date date not null,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id)
);

create table if not exists public.overtime (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null default current_date,
  hours numeric(5,2) not null check (hours >= 0 and hours <= 24),
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id)
);

alter table public.profiles enable row level security;
alter table public.attendance enable row level security;
alter table public.time_off_requests enable row level security;
alter table public.overtime enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.active = true);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, role, active)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'worker', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop policy if exists "profile own or admin select" on public.profiles;
create policy "profile own or admin select" on public.profiles for select using (id = auth.uid() or public.is_admin());

drop policy if exists "admin profile update" on public.profiles;
create policy "admin profile update" on public.profiles for update using (public.is_admin());

drop policy if exists "worker own attendance insert" on public.attendance;
create policy "worker own attendance insert" on public.attendance for insert with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "attendance select own or admin" on public.attendance;
create policy "attendance select own or admin" on public.attendance for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admin attendance update" on public.attendance;
create policy "admin attendance update" on public.attendance for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "worker own request insert" on public.time_off_requests;
create policy "worker own request insert" on public.time_off_requests for insert with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "request select own or admin" on public.time_off_requests;
create policy "request select own or admin" on public.time_off_requests for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admin request update" on public.time_off_requests;
create policy "admin request update" on public.time_off_requests for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "worker own overtime insert" on public.overtime;
create policy "worker own overtime insert" on public.overtime for insert with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "overtime select own or admin" on public.overtime;
create policy "overtime select own or admin" on public.overtime for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admin overtime update" on public.overtime;
create policy "admin overtime update" on public.overtime for update using (public.is_admin()) with check (public.is_admin());

-- Αφού δημιουργήσεις τον πρώτο χρήστη, άλλαξε το email παρακάτω:
-- update public.profiles set role='admin', active=true
-- where id = (select id from auth.users where email='TO_EMAIL_SOU');

