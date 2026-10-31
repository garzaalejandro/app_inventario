create or replace function public.change_owner_pin(p_owner_token uuid,p_current_pin text,p_new_pin text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare settings public.owner_settings%rowtype;
begin
 if not exists(select 1 from public.owner_sessions where token=p_owner_token and expires_at>pg_catalog.now()) then
  return jsonb_build_object('error','La sesión del dueño venció. Ingresa de nuevo.');
 end if;
 select * into settings from public.owner_settings where id=true for update;
 if settings.pin_hash is null then
  return jsonb_build_object('error','El PIN todavía no está configurado.');
 end if;
 if settings.locked_until>pg_catalog.now() then
  return jsonb_build_object('error','Demasiados intentos; espera antes de reintentar.');
 end if;
 if extensions.crypt(p_current_pin,settings.pin_hash)<>settings.pin_hash then
  update public.owner_settings
   set failures=case when failures>=4 then 0 else failures+1 end,
       locked_until=case when failures>=4 then pg_catalog.now()+interval '5 minutes' else null end
   where id=true;
  return jsonb_build_object('error','El PIN actual es incorrecto.');
 end if;
 if p_new_pin !~ '^[0-9]{4,12}$' then
  return jsonb_build_object('error','El PIN nuevo debe tener entre 4 y 12 dígitos.');
 end if;
 update public.owner_settings
  set pin_hash=extensions.crypt(p_new_pin,extensions.gen_salt('bf')),failures=0,locked_until=null
  where id=true;
 delete from public.owner_sessions;
 return jsonb_build_object('success',true);
end $$;
revoke all on function public.change_owner_pin(uuid,text,text) from public,anon,authenticated;
grant execute on function public.change_owner_pin(uuid,text,text) to service_role;
