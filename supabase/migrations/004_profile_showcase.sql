-- A showcase is decorative. Owning and equipping items use user_talismans.
create table public.profile_pins (
  user_id uuid not null references public.users on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  effect text not null references public.talismans,
  primary key(user_id, slot), unique(user_id,effect)
);
alter table public.profile_pins enable row level security;
revoke all on public.profile_pins from public, anon, authenticated;

create function public.profile_card(player uuid)
returns table(display_name text, pins jsonb)
language sql stable security definer set search_path = '' as $$
  select u.name, coalesce((select jsonb_object_agg(p.slot,p.effect)
    from public.profile_pins p where p.user_id=u.id),'{}'::jsonb)
  from public.users u where u.id=player;
$$;
create function public.set_profile_pin(position_no integer, item text)
returns void language plpgsql security definer set search_path = '' as $$
declare player uuid := auth.uid();
begin
  if player is null or position_no is null or position_no not between 1 and 3 then
    raise exception 'Недоступный слот';
  end if;
  perform 1 from public.users where id=player for update;
  if not found then raise exception 'Профиль не найден'; end if;
  delete from public.profile_pins where user_id=player and (slot=position_no or effect=item);
  if item is not null then
    insert into public.profile_pins values(player,position_no,item);
  end if;
end $$;

create function public.generosity_ranking()
returns table(player uuid, display_name text, total numeric)
language sql stable security definer set search_path = '' as $$
  select u.id,u.name,sum(a.amount) from (
    select sender,amount from public.gifts union all
    select supporter,amount from public.wish_supports
  ) a join public.users u on u.id=a.sender
  group by u.id,u.name order by sum(a.amount) desc,u.name,u.id limit 100;
$$;
revoke all on function public.profile_card(uuid), public.generosity_ranking(),public.set_profile_pin(integer,text) from public, anon, authenticated;
grant execute on function public.profile_card(uuid), public.generosity_ranking() to anon,authenticated;
grant execute on function public.set_profile_pin(integer,text) to authenticated;

-- Preserve the existing effect key for already issued items.
update public.talismans set name='Фонарь удачи',
  description='Праздничный фонарь символизирует свет и благополучие. Раз в неделю приносит случайный подарок удачи.'
where effect='ship';
