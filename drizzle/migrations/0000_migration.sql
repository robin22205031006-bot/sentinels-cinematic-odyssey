create type public.app_role as enum ('admin','user');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null, role app_role not null, unique(user_id, role));
grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create or replace function public.handle_admin_signup() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if lower(new.email) = 'zananrobin@gmail.com' then
    insert into public.user_roles(user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created_admin after insert on auth.users for each row execute function public.handle_admin_signup();
insert into public.user_roles(user_id, role) select id, 'admin' from auth.users where lower(email)='zananrobin@gmail.com' on conflict do nothing;

create type public.entity_kind as enum ('character','organization','clan','bloodline','faction');
create table public.entities (
  id uuid primary key default gen_random_uuid(),
  kind entity_kind not null,
  name text not null,
  alias text,
  role text,
  status text not null default 'Unknown',
  description text not null default '',
  stats jsonb not null default '{}'::jsonb,
  image_url text,
  locked_fields text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.lore_notes (id uuid primary key default gen_random_uuid(), entity_id uuid not null references public.entities(id) on delete cascade, text text not null, source text, created_at timestamptz not null default now());
create table public.timeline_events (id uuid primary key default gen_random_uuid(), title text not null, era text, sort_order int not null default 0, description text not null default '', source text, created_at timestamptz not null default now());
create table public.ingest_jobs (id uuid primary key default gen_random_uuid(), filename text not null, summary jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
do $$ declare t text; begin foreach t in array array['entities','lore_notes','timeline_events','ingest_jobs'] loop
  execute format('grant select on public.%I to anon, authenticated', t);
  execute format('grant insert, update, delete on public.%I to authenticated', t);
  execute format('grant all on public.%I to service_role', t);
  execute format('alter table public.%I enable row level security', t);
  execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
  execute format('create policy "admin insert" on public.%I for insert to authenticated with check (public.has_role(auth.uid(),''admin''))', t);
  execute format('create policy "admin update" on public.%I for update to authenticated using (public.has_role(auth.uid(),''admin''))', t);
  execute format('create policy "admin delete" on public.%I for delete to authenticated using (public.has_role(auth.uid(),''admin''))', t);
end loop; end $$;
revoke select on public.ingest_jobs from anon;
drop policy "public read" on public.ingest_jobs;
create policy "admin read" on public.ingest_jobs for select to authenticated using (public.has_role(auth.uid(),'admin'));