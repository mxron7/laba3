begin;
alter table public.gifts add column request_id uuid, add unique(sender,request_id);
alter table public.payments_demo add column request_id uuid, add unique(user_id,request_id);
create index gifts_inbox on public.gifts(recipient,id desc);

create function public.find_players(term text)
returns table(player uuid, nickname text)
language sql stable security definer set search_path='' as $$
 select id,name from public.users
 where id<>auth.uid() and length(trim(term)) between 1 and 32
 and strpos(lower(name),lower(trim(term)))>0
 order by lower(name),id limit 40
$$;

create function public.incoming_envelopes(before_id bigint default null)
returns table(id text, sender_id uuid, nickname text, amount integer, note text, sent_at timestamptz)
language sql stable security definer set search_path='' as $$
 select g.id::text,u.id,u.name,g.amount,g.note,g.created_at
 from public.gifts g join public.users u on u.id=g.sender
 where g.recipient=auth.uid() and (before_id is null or g.id<before_id)
 order by g.id desc limit 25
$$;

create function public.send_envelope(target uuid, quantity integer, message text, token uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid := auth.uid();
begin
 if me is null or target is null or target=me or token is null or quantity is null
 or quantity<=0 or length(message)>280 then raise exception 'Проверь получателя, сумму и записку.'; end if;
 perform 1 from public.users where id in (me,target) order by id for update;
 if not exists(select from public.users where id=target) then raise exception 'Получатель не найден.'; end if;
 if exists(select from public.gifts where sender=me and request_id=token) then return; end if;
 update public.users set luck_balance=luck_balance-quantity where id=me and luck_balance>=quantity;
 if not found then raise exception 'Недостаточно удачи.'; end if;
 update public.users set luck_balance=luck_balance+quantity where id=target;
 insert into public.gifts(sender,recipient,amount,note,request_id)
 values(me,target,quantity,nullif(trim(message),''),token);
end $$;

create function public.demo_top_up(coins integer, token uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid := auth.uid();
begin
 if me is null or token is null or coins is null or coins not in (100,500,1000)
 then raise exception 'Выбери пакет монет.'; end if;
 insert into public.payments_demo(user_id,package,request_id) values(me,coins,token)
 on conflict (user_id,request_id) do nothing;
 if found then update public.users set coin_balance=coin_balance+coins where id=me; end if;
end $$;

revoke all on function public.find_players(text),public.incoming_envelopes(bigint),
 public.send_envelope(uuid,integer,text,uuid),public.demo_top_up(integer,uuid) from public,anon;
grant execute on function public.find_players(text),public.incoming_envelopes(bigint),
 public.send_envelope(uuid,integer,text,uuid),public.demo_top_up(integer,uuid) to authenticated;
commit;
