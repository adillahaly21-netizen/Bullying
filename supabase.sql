-- SAHABAT AMAN: jalankan di Supabase Dashboard > SQL Editor.
-- Review kebijakan bersama penanggung jawab TI/sekolah sebelum data siswa sungguhan digunakan.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Pengguna',
  class_name text,
  role text not null default 'student' check (role in ('student','counselor','admin','principal')),
  created_at timestamptz not null default now()
);

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, class_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), 'Pengguna'),
    nullif(new.raw_user_meta_data->>'class_name',''),
    'student'
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.create_profile_for_new_user();

create or replace function public.current_role()
returns text language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(public.current_role() in ('counselor','admin','principal'), false)
$$;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  assigned_to uuid references public.profiles(id),
  title text not null check (char_length(title) between 3 and 120),
  category text not null,
  incident_date date not null,
  location text,
  description text not null check (char_length(description) between 15 and 6000),
  status text not null default 'Baru' check (status in ('Baru','Ditinjau','Ditindaklanjuti','Selesai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.education_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.messages enable row level security;
alter table public.education_articles enable row level security;

-- Profiles: pengguna membaca profil sendiri; staf membaca profil untuk penugasan.
drop policy if exists "profile self or staff read" on public.profiles;
create policy "profile self or staff read" on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.current_role() in ('counselor','admin','principal'));

drop policy if exists "admin manage profiles" on public.profiles;
create policy "admin manage profiles" on public.profiles for all to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

-- Reports: siswa hanya melihat/membuat laporan miliknya; konselor hanya kasus yang ditugaskan;
-- admin dapat melihat semua. Kepala sekolah hanya membaca data untuk rekap (tetap data sensitif).
drop policy if exists "read allowed reports" on public.reports;
create policy "read allowed reports" on public.reports for select to authenticated
using (
  reporter_id = (select auth.uid())
  or (public.current_role() = 'admin')
  or (public.current_role() = 'counselor' and assigned_to = (select auth.uid()))
  or public.current_role() = 'principal'
);

drop policy if exists "student create own report" on public.reports;
create policy "student create own report" on public.reports for insert to authenticated
with check (reporter_id = (select auth.uid()) and assigned_to is null and status = 'Baru');

drop policy if exists "admin update reports" on public.reports;
create policy "admin update reports" on public.reports for update to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "assigned counselor update reports" on public.reports;
create policy "assigned counselor update reports" on public.reports for update to authenticated
using (public.current_role() = 'counselor' and (assigned_to = (select auth.uid()) or assigned_to is null))
with check (public.current_role() = 'counselor' and (assigned_to = (select auth.uid()) or assigned_to is null));

-- Pesan hanya dapat dilihat oleh pelapor, admin, atau konselor yang ditugaskan.
drop policy if exists "read messages for accessible reports" on public.messages;
create policy "read messages for accessible reports" on public.messages for select to authenticated
using (exists (
  select 1 from public.reports r where r.id = report_id and (
    r.reporter_id = (select auth.uid())
    or public.current_role() = 'admin'
    or (public.current_role() = 'counselor' and r.assigned_to = (select auth.uid()))
  )
));

drop policy if exists "send messages for accessible reports" on public.messages;
create policy "send messages for accessible reports" on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid()) and exists (
    select 1 from public.reports r where r.id = report_id and (
      r.reporter_id = (select auth.uid())
      or public.current_role() = 'admin'
      or (public.current_role() = 'counselor' and r.assigned_to = (select auth.uid()))
    )
  )
);

-- Edukasi: semua akun terverifikasi dapat membaca artikel terbit; admin mengelola artikel.
drop policy if exists "read published education" on public.education_articles;
create policy "read published education" on public.education_articles for select to authenticated
using (published = true or public.current_role() = 'admin');

drop policy if exists "admin manage education" on public.education_articles;
create policy "admin manage education" on public.education_articles for all to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

-- Hak akses tabel. RLS tetap menjadi lapisan pembatas utama.
grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update, delete on public.education_articles to authenticated;

-- Artikel awal (aman dan umum).
insert into public.education_articles(title, body, published)
select 'Jika mengalami perundungan', 'Utamakan keselamatan. Cari guru atau orang dewasa yang dipercaya. Catat kejadian dan simpan bukti secara aman. Kamu tidak bersalah karena meminta bantuan.', true
where not exists (select 1 from public.education_articles where title = 'Jika mengalami perundungan');

-- PENTING: setelah akun admin dibuat dan diverifikasi, jalankan perintah manual berikut
-- dengan email admin yang benar. Jangan beri peran admin melalui formulir pendaftaran.
-- update public.profiles p set role = 'admin'
-- from auth.users u where u.id = p.id and u.email = 'admin@sekolah.sch.id';
-- Peran lain: 'counselor' atau 'principal'. Gunakan akun admin utama tepercaya untuk promosi peran.
