-- Owner-only catalog additions from tab-separated rows copied from Google Sheets.
-- Existing products and stock are never updated by this import path.
begin;

create table if not exists public.catalog_metadata (
  id boolean primary key default true check (id),
  revision bigint not null default 3 check (revision > 0)
);
insert into public.catalog_metadata(id, revision) values (true, 3)
on conflict (id) do update set revision = greatest(public.catalog_metadata.revision, excluded.revision);
alter table public.catalog_metadata enable row level security;
revoke all on public.catalog_metadata from public, anon, authenticated;

create or replace function public.bump_catalog_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  update public.catalog_metadata set revision = revision + 1 where id = true;
  return null;
end;
$$;
revoke all on function public.bump_catalog_revision() from public, anon, authenticated;
drop trigger if exists products_bump_catalog_revision on public.products;
create trigger products_bump_catalog_revision
after insert on public.products for each statement
execute function public.bump_catalog_revision();

create or replace function public.catalog_status()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'catalog_count', (select count(*) from public.products),
    'catalog_revision', coalesce((select revision from public.catalog_metadata where id = true), 3)
  );
$$;
revoke all on function public.catalog_status() from public, anon, authenticated;
grant execute on function public.catalog_status() to service_role;

create or replace function public.import_products_batch(p_products jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare inserted_count integer;
begin
  if jsonb_typeof(p_products) <> 'array' or jsonb_array_length(p_products) < 1 or jsonb_array_length(p_products) > 25 then
    raise exception 'Lote inválido';
  end if;

  insert into public.products(sku, description, weight_kg)
  select distinct on (upper(trim(rows.sku))) trim(rows.sku), trim(rows.description), rows.weight_kg
  from jsonb_to_recordset(p_products) as rows(sku text, description text, weight_kg numeric)
  where trim(coalesce(rows.sku, '')) <> ''
    and length(trim(rows.sku)) <= 120
    and trim(coalesce(rows.description, '')) <> ''
    and length(trim(rows.description)) <= 2000
    and (rows.weight_kg is null or rows.weight_kg >= 0)
  order by upper(trim(rows.sku))
  on conflict (sku) do nothing;
  get diagnostics inserted_count = row_count;
  return jsonb_build_object('inserted', inserted_count);
end;
$$;
revoke all on function public.import_products_batch(jsonb) from public, anon, authenticated;
grant execute on function public.import_products_batch(jsonb) to service_role;

commit;
