begin;
alter table public.profile_pins add column purchased_pin boolean not null default false;
update public.profile_pins p set purchased_pin=true where exists (
  select from public.user_talismans t where t.user_id=p.user_id and t.effect=p.effect
);
alter table public.profile_pins alter column purchased_pin set default true;

create or replace function public.profile_card(player uuid)
returns table(display_name text, pins jsonb)
language sql stable security definer set search_path = '' as $$
  select u.name, coalesce((select jsonb_object_agg(p.slot,p.effect)
    from public.profile_pins p where p.user_id=u.id and p.purchased_pin),'{}'::jsonb)
  from public.users u where u.id=player;
$$;
create or replace function public.set_profile_pin(position_no integer, item text)
returns void language plpgsql security definer set search_path = '' as $$
declare player uuid := auth.uid();
begin
  if player is null or position_no is null or position_no not between 1 and 3 then
    raise exception 'Недоступный слот';
  end if;
  perform 1 from public.users where id=player for update;
  if not found then raise exception 'Профиль не найден'; end if;
  if item is not null and not exists (
    select from public.user_talismans where user_id=player and effect=item
  ) then raise exception 'Сначала купи талисман.'; end if;
  delete from public.profile_pins where user_id=player and (slot=position_no or effect=item);
  if item is not null then
    insert into public.profile_pins(user_id,slot,effect) values(player,position_no,item);
  end if;
end $$;

grant select on public.user_talismans to authenticated;
create policy own_collection on public.user_talismans for select to authenticated
  using(user_id=auth.uid());

create function public.shop_offers()
returns table(item text, cost integer, owned boolean)
language sql stable security definer set search_path='' as $$
 select t.effect, case when exists (
   select from public.profile_pins where user_id=auth.uid() and purchased_pin and effect='frog'
 ) then ceil(t.price*0.9)::integer else t.price end,
 exists(select from public.user_talismans u where u.user_id=auth.uid() and u.effect=t.effect)
 from public.talismans t
$$;

create function public.buy_talisman(chosen text) returns void
language plpgsql security definer set search_path='' as $$
declare player uuid := auth.uid(); offer record;
begin
 perform 1 from public.users where id=player for update;
 if not found then raise exception 'Войди для покупки.'; end if;
 select * into offer from public.shop_offers() where item=chosen;
 if not found then raise exception 'Талисман не найден.'; end if;
 if offer.owned then return; end if;
 update public.users set coin_balance=coin_balance-offer.cost
 where id=player and coin_balance>=offer.cost;
 if not found then raise exception 'Недостаточно монет.'; end if;
 insert into public.user_talismans(user_id,effect) values(player,chosen);
end $$;
revoke all on function public.shop_offers(), public.buy_talisman(text) from public,anon;
grant execute on function public.shop_offers(), public.buy_talisman(text) to authenticated;
commit;
