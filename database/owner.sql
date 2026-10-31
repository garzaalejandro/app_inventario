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

-- Optional owner-authorized import of new SKU rows copied from Google Sheets.
create table if not exists public.catalog_metadata (
 id boolean primary key default true check(id), revision bigint not null default 3 check(revision>0)
);
insert into public.catalog_metadata(id,revision) values(true,3)
on conflict(id) do update set revision=greatest(public.catalog_metadata.revision,excluded.revision);
alter table public.catalog_metadata enable row level security;
revoke all on public.catalog_metadata from public,anon,authenticated;
create or replace function public.bump_catalog_revision()
returns trigger language plpgsql security invoker set search_path='' as $$
begin update public.catalog_metadata set revision=revision+1 where id=true;return null;end $$;
revoke all on function public.bump_catalog_revision() from public,anon,authenticated;
drop trigger if exists products_bump_catalog_revision on public.products;
create trigger products_bump_catalog_revision after insert on public.products for each statement execute function public.bump_catalog_revision();
create or replace function public.catalog_status() returns jsonb language sql stable security invoker set search_path='' as $$
 select pg_catalog.jsonb_build_object('catalog_count',(select count(*) from public.products),'catalog_revision',coalesce((select revision from public.catalog_metadata where id=true),3));
$$;
revoke all on function public.catalog_status() from public,anon,authenticated;
grant execute on function public.catalog_status() to service_role;
create or replace function public.import_products_batch(p_products jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare inserted_count integer;
begin
 if jsonb_typeof(p_products)<>'array' or jsonb_array_length(p_products)<1 or jsonb_array_length(p_products)>25 then raise exception 'Lote inválido';end if;
 insert into public.products(sku,description,weight_kg)
 select distinct on(upper(trim(rows.sku))) trim(rows.sku),trim(rows.description),rows.weight_kg
 from jsonb_to_recordset(p_products) as rows(sku text,description text,weight_kg numeric)
 where trim(coalesce(rows.sku,''))<>'' and length(trim(rows.sku))<=120 and trim(coalesce(rows.description,''))<>'' and length(trim(rows.description))<=2000 and (rows.weight_kg is null or rows.weight_kg>=0)
 order by upper(trim(rows.sku)) on conflict(sku) do nothing;
 get diagnostics inserted_count=row_count;
 return jsonb_build_object('inserted',inserted_count);
end $$;
revoke all on function public.import_products_batch(jsonb) from public,anon,authenticated;
grant execute on function public.import_products_batch(jsonb) to service_role;
