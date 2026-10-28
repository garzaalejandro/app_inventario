create extension if not exists pgcrypto with schema extensions;
create table public.owner_settings (
 id boolean primary key default true check(id), pin_hash text,
 failures integer not null default 0, locked_until timestamptz
);
insert into public.owner_settings(id) values(true);
create table public.owner_sessions (
 token uuid primary key default gen_random_uuid(),
 expires_at timestamptz not null default (now()+interval '15 minutes')
);
alter table public.owner_settings enable row level security;
alter table public.owner_sessions enable row level security;
revoke all on public.owner_settings,public.owner_sessions from anon,authenticated;
alter table public.unknown_codes add column resolved_at timestamptz;
create function public.owner_login(p_pin text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare settings public.owner_settings%rowtype; session_token uuid;
begin
 select * into settings from public.owner_settings where id=true for update;
 if settings.pin_hash is null then return jsonb_build_object('error','PIN pendiente de configuración por el dueño');end if;
 if settings.locked_until>now() then return jsonb_build_object('error','Demasiados intentos; espera antes de reintentar');end if;
 if extensions.crypt(p_pin,settings.pin_hash)<>settings.pin_hash then
  update public.owner_settings set failures=case when failures>=4 then 0 else failures+1 end,
   locked_until=case when failures>=4 then now()+interval '5 minutes' else null end where id=true;
  return jsonb_build_object('error','PIN incorrecto');
 end if;
 update public.owner_settings set failures=0,locked_until=null where id=true;
 insert into public.owner_sessions default values returning token into session_token;
 return jsonb_build_object('owner_token',session_token);
end $$;
revoke all on function public.owner_login(text) from public,anon,authenticated;
grant execute on function public.owner_login(text) to service_role;
create function public.resolve_pending(p_id uuid,p_sku text,p_description text,p_internal_name text)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.unknown_codes where id=p_id and resolved_at is null for update;
 if not found then raise exception 'Pendiente no disponible';end if;
 insert into public.products(sku,description,internal_name)values(p_sku,p_description,p_internal_name);
 update public.unknown_codes set resolved_at=now() where id=p_id;
 return jsonb_build_object('sku',p_sku);
end $$;
revoke all on function public.resolve_pending(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.resolve_pending(uuid,text,text,text) to service_role;
