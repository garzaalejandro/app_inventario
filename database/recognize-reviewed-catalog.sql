-- Applied only to new ANDROMEDA database, 2026-10-29.
-- Preserve conflicting descriptions/weights in catalog_import; do not infer stock.
insert into public.products(sku,description,weight_kg,source_rows)
select sku,'Descripción pendiente de validación del dueño',null,source_rows
from public.catalog_import where requires_review
on conflict (sku) do nothing;
-- No stock insert/update. Owner review of variants remains pending.
