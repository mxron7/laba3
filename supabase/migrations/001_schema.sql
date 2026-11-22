create table public.users (
 id uuid primary key references auth.users on delete cascade,
 name text not null,
 luck_balance bigint not null default 0 check (luck_balance >= 0),
 coin_balance bigint not null default 0 check (coin_balance >= 0)
);
create table public.omikuji_draws (
 user_id uuid references public.users on delete cascade,
 day date not null, outcome text not null, reward integer not null check (reward >= 0),
 primary key (user_id, day)
);
create table public.gifts (
 id bigint generated always as identity primary key,
 sender uuid not null references public.users, recipient uuid not null references public.users,
 amount integer not null check(amount > 0), note text, created_at timestamptz not null default now(),
 check(sender <> recipient)
);
create table public.wishes (
 id bigint generated always as identity primary key, author uuid not null references public.users,
 body text not null, created_at timestamptz not null default now(),
 status text not null default 'open' check(status in ('open','fulfilled'))
);
create table public.wish_supports (
 id bigint generated always as identity primary key, wish_id bigint not null references public.wishes,
 supporter uuid not null references public.users, amount integer not null check(amount > 0),
 note text, created_at timestamptz not null default now()
);
create table public.talismans (
 effect text primary key, name text not null, description text not null, rarity text not null,
 price integer not null check(price > 0)
);
create table public.user_talismans (
 user_id uuid references public.users, effect text references public.talismans,
 slot integer check(slot between 1 and 3), primary key(user_id,effect), unique(user_id,slot)
);
create table public.payments_demo (
 id bigint generated always as identity primary key, user_id uuid not null references public.users,
 package integer not null check(package in (100,500,1000)), created_at timestamptz not null default now()
);

do $$
declare t text;
begin
 foreach t in array array['users','omikuji_draws','gifts','wishes','wish_supports','talismans','user_talismans','payments_demo'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
 end loop;
end $$;
grant select on public.users, public.omikuji_draws to authenticated;
create policy own_profile on public.users for select to authenticated using(id=auth.uid());
create policy own_draws on public.omikuji_draws for select to authenticated using(user_id=auth.uid());

create function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.users(id,name) values(new.id,coalesce(nullif(left(trim(new.raw_user_meta_data->>'name'),32),''),'Путник'));
 return new;
end $$;
revoke all on function public.create_profile() from public, anon, authenticated;
create trigger on_signup after insert on auth.users for each row execute function public.create_profile();
