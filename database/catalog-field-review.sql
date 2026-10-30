-- Only the new ANDROMEDA database. Review description and weight independently.
begin;
alter table public.products add column if not exists description_review boolean not null default false;
alter table public.products add column if not exists weight_review boolean not null default false;
alter table public.products add column if not exists reference_description text;
with fields as (
 select sku,min(trim(v->>0)) as common_description,
 count(distinct trim(v->>0))=1 as same_description,
 count(distinct (v->1))=1 as same_weight,
 min((v->>1)::numeric) as common_weight
 from public.catalog_import cross join lateral jsonb_array_elements(variants) v
 group by sku
)
update public.products p set
 description=case when f.same_description then f.common_description else p.description end,
 description_review=not f.same_description,
 reference_description=case when f.same_description then null else c.description end,
 weight_kg=case when f.same_weight then f.common_weight else p.weight_kg end,
 weight_review=not f.same_weight
from fields f join public.catalog_import c using(sku)
where p.sku=f.sku and p.description='Descripción pendiente de validación del dueño';
create or replace function public.catalog_status() returns jsonb language sql stable security invoker set search_path='' as $$
 select pg_catalog.jsonb_build_object('catalog_count',count(*),'catalog_revision',2) from public.products;
$$;
revoke all on function public.catalog_status() from public,anon,authenticated;
grant execute on function public.catalog_status() to service_role;
-- Does not touch quantity, location, source variants, or worker identifiers.
commit;
