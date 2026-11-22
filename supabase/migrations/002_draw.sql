-- Один календарный день для всех игроков. Блокировка профиля сериализует запросы.
create function public.draw_today() returns public.omikuji_draws
language plpgsql security definer set search_path = '' as $$
declare
 player uuid := auth.uid();
 today date := (now() at time zone 'Asia/Vladivostok')::date;
 result public.omikuji_draws;
 idx integer;
begin
 if player is null then raise exception 'Требуется вход'; end if;
 perform 1 from public.users where id=player for update;
 if not found then raise exception 'Профиль не найден'; end if;
 select * into result from public.omikuji_draws where user_id=player and day=today;
 if found then return result; end if;
 idx := 1+floor(random()*4)::integer;
 insert into public.omikuji_draws values(player,today,
 (array['great','good','small','poor'])[idx],(array[30,20,10,5])[idx]) returning * into result;
 update public.users set luck_balance=luck_balance+result.reward where id=player;
 return result;
end $$;
revoke all on function public.draw_today() from public, anon;
grant execute on function public.draw_today() to authenticated;
