alter table public.entities add column if not exists category text;
alter table public.entities add column if not exists sketches text[] not null default '{}';
alter table public.timeline_events add column if not exists impact int not null default 5;
alter table public.timeline_events add column if not exists series text;

create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, email text, display_name text, created_at timestamptz not null default now());
grant select on public.profiles to authenticated; grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.banned_users (user_id uuid primary key, reason text, banned_by uuid, created_at timestamptz not null default now());
create table public.banned_words (id uuid primary key default gen_random_uuid(), word text not null unique, created_at timestamptz not null default now());
create table public.posts (id uuid primary key default gen_random_uuid(), author_id uuid not null default auth.uid(), author_name text, title text not null, body text not null, created_at timestamptz not null default now());
create table public.comments (id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade, parent_id uuid references public.comments(id) on delete cascade, author_id uuid not null default auth.uid(), author_name text, body text not null, created_at timestamptz not null default now());
create table public.post_votes (post_id uuid not null references public.posts(id) on delete cascade, user_id uuid not null default auth.uid(), primary key (post_id, user_id));
create table public.vault_documents (id uuid primary key default gen_random_uuid(), title text not null, file_path text not null, is_public boolean not null default false, downloadable boolean not null default true, created_at timestamptz not null default now());
create table public.activity_log (id uuid primary key default gen_random_uuid(), user_id uuid, action text not null, created_at timestamptz not null default now());

grant select, insert, update, delete on public.banned_users, public.banned_words, public.posts, public.comments, public.post_votes, public.vault_documents, public.activity_log to authenticated;
grant all on public.banned_users, public.banned_words, public.posts, public.comments, public.post_votes, public.vault_documents, public.activity_log to service_role;
alter table public.banned_users enable row level security;
alter table public.banned_words enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_votes enable row level security;
alter table public.vault_documents enable row level security;
alter table public.activity_log enable row level security;

create or replace function public.is_staff(_uid uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_roles where user_id=_uid and role in ('admin','moderator')) $$;
create or replace function public.is_banned(_uid uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.banned_users where user_id=_uid) $$;

create policy "profiles own" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "staff manage bans" on public.banned_users for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "own ban visible" on public.banned_users for select to authenticated using (user_id = auth.uid());
create policy "words readable" on public.banned_words for select to authenticated using (true);
create policy "staff manage words" on public.banned_words for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "posts readable" on public.posts for select to authenticated using (true);
create policy "post create" on public.posts for insert to authenticated with check (author_id = auth.uid() and not public.is_banned(auth.uid()));
create policy "post delete" on public.posts for delete to authenticated using (author_id = auth.uid() or public.is_staff(auth.uid()));
create policy "comments readable" on public.comments for select to authenticated using (true);
create policy "comment create" on public.comments for insert to authenticated with check (author_id = auth.uid() and not public.is_banned(auth.uid()));
create policy "comment delete" on public.comments for delete to authenticated using (author_id = auth.uid() or public.is_staff(auth.uid()));
create policy "votes readable" on public.post_votes for select to authenticated using (true);
create policy "vote own" on public.post_votes for insert to authenticated with check (user_id = auth.uid() and not public.is_banned(auth.uid()));
create policy "unvote own" on public.post_votes for delete to authenticated using (user_id = auth.uid());

create policy "vault visible" on public.vault_documents for select to authenticated using (is_public or public.has_role(auth.uid(),'admin'));
create policy "vault admin" on public.vault_documents for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "log insert own" on public.activity_log for insert to authenticated with check (user_id = auth.uid());
create policy "log staff read" on public.activity_log for select to authenticated using (public.is_staff(auth.uid()));
create policy "staff read roles" on public.user_roles for select to authenticated using (public.is_staff(auth.uid()));

create policy "vault files read" on storage.objects for select to authenticated using (
  bucket_id = 'vault' and (public.has_role(auth.uid(),'admin') or exists (select 1 from public.vault_documents d where d.file_path = name and d.is_public and d.downloadable)));
create policy "vault files admin write" on storage.objects for insert to authenticated with check (bucket_id = 'vault' and public.has_role(auth.uid(),'admin'));
create policy "vault files admin delete" on storage.objects for delete to authenticated using (bucket_id = 'vault' and public.has_role(auth.uid(),'admin'));

create or replace function public.filter_banned_words() returns trigger language plpgsql security definer set search_path=public as $$
declare w text;
begin
  for w in select word from public.banned_words loop
    new.body := regexp_replace(new.body, '\m' || w || '\M', repeat('*', length(w)), 'gi');
    if tg_table_name = 'posts' then new.title := regexp_replace(new.title, '\m' || w || '\M', repeat('*', length(w)), 'gi'); end if;
  end loop;
  return new;
end $$;
create trigger posts_filter before insert or update on public.posts for each row execute function public.filter_banned_words();
create trigger comments_filter before insert or update on public.comments for each row execute function public.filter_banned_words();

create or replace function public.handle_new_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id, email) values (new.id, new.email) on conflict do nothing; return new; end $$;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute function public.handle_new_profile();
insert into public.profiles(id, email) select id, email from auth.users on conflict do nothing;