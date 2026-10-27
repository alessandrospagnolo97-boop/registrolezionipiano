-- ============================================================
-- Registro lezioni di pianoforte — schema Supabase
-- Eseguire per intero in: Supabase > SQL Editor > New query > Run
-- Lo script è rieseguibile senza errori.
-- ============================================================

-- Una riga per data. Le lezioni ricorrenti sono generate dal frontend;
-- una riga esiste solo dopo la prima modifica. PK su date = nessun duplicato.
create table if not exists public.lessons (
  date         date    primary key,
  attendance_a boolean not null default false,   -- Alessandro
  attendance_g boolean not null default false,   -- Gianmarco
  driver       text    check (driver in ('Alessandro','Andrea','Gabriele','Gianmarco'))
);

-- Elenco degli amministratori (utenti autenticati autorizzati a scrivere).
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.lessons enable row level security;
alter table public.admins  enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- lessons: lettura pubblica, scrittura solo admin
drop policy if exists "lessons_read"   on public.lessons;
drop policy if exists "lessons_insert" on public.lessons;
drop policy if exists "lessons_update" on public.lessons;
drop policy if exists "lessons_delete" on public.lessons;
create policy "lessons_read"   on public.lessons for select using (true);
create policy "lessons_insert" on public.lessons for insert to authenticated with check (public.is_admin());
create policy "lessons_update" on public.lessons for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "lessons_delete" on public.lessons for delete to authenticated using (public.is_admin());

-- admins: ognuno può leggere solo la propria riga; nessuna policy di scrittura
-- (gli admin si aggiungono solo da SQL Editor, che bypassa la RLS)
drop policy if exists "admins_read_self" on public.admins;
create policy "admins_read_self" on public.admins for select to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------
-- PASSO FINALE (dopo aver creato l'utente in Authentication > Users):
-- sostituisci l'email qui sotto con la tua ed esegui questa riga.
-- ------------------------------------------------------------
insert into public.admins (user_id)
select id from auth.users where email = 'LA_TUA_EMAIL@esempio.it'
on conflict do nothing;
