-- Draft only. Never run against the old inventory database.
-- No policies granting client access until the gateway is implemented.
begin;
create table public.products (
  sku text primary key check (length(trim(sku)) > 0),
  description text not null,
  internal_name text,
  weight_kg numeric,
  source_rows jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create table public.stock (
  sku text primary key references public.products(sku),
  quantity integer not null default 0 check (quantity >= 0),
  row_number integer not null check (row_number between 1 and 13),
  position text not null check (position ~ '^[A-R]$'),
  level integer not null check (level between 1 and 7),
  updated_at timestamptz not null default now()
);
create table public.unknown_codes (
  id uuid primary key default gen_random_uuid(),
  original_code text not null unique,
  candidate_sku text not null,
  created_at timestamptz not null default now()
);
create table public.receipt_guides (
  id uuid primary key default gen_random_uuid(),
  guide text not null unique,
  received_on date not null,
  recorded_at timestamptz not null default now()
);
create table public.picking_packages (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  created_at timestamptz not null default now()
);
create table public.picking_lines (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.picking_packages(id),
  sku text not null references public.products(sku),
  quantity integer not null check (quantity > 0),
  prepared boolean not null default false,
  unique(package_id, sku)
);
create table public.movements (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null,
  sku text not null references public.products(sku),
  kind text not null check (kind in ('in','out','relocate')),
  units integer not null check (units >= 0),
  original_code text,
  old_location jsonb,
  new_location jsonb,
  created_at timestamptz not null default now(),
  unique(operation_id, sku),
  check ((kind = 'relocate' and units = 0) or (kind <> 'relocate' and units > 0))
);
alter table public.products enable row level security;
alter table public.stock enable row level security;
alter table public.unknown_codes enable row level security;
alter table public.receipt_guides enable row level security;
alter table public.picking_packages enable row level security;
alter table public.picking_lines enable row level security;
alter table public.movements enable row level security;
revoke all on public.products, public.stock, public.unknown_codes,
 public.receipt_guides, public.picking_packages, public.picking_lines,
 public.movements from anon, authenticated;
commit;

-- Import staging preserves every distinct source variant without activating stock.
create table public.catalog_import (
 sku text primary key,
 description text not null,
 weight_kg numeric,
 requires_review boolean not null,
 variants jsonb not null,
 source_rows jsonb not null,
 imported_at timestamptz not null default now()
);
alter table public.catalog_import enable row level security;
revoke all on public.catalog_import from anon, authenticated;

-- The gateway uses a server-only service_role credential. No stock write is
-- allowed directly from the APK. This function executes one atomic movement.
create function public.record_movement(
 p_operation_id uuid, p_sku text, p_kind text, p_units integer,
 p_row integer default null, p_position text default null, p_level integer default null,
 p_original_code text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_stock public.stock%rowtype; previous public.movements%rowtype; next_quantity integer;
begin
 if p_kind not in ('in','out','relocate') then raise exception 'Invalid operation'; end if;
 if (p_kind='relocate' and p_units<>0) or (p_kind<>'relocate' and p_units<1) then
  raise exception 'Invalid units';
 end if;
 -- Per-operation lock prevents retry races; every caller then locks the SKU.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_operation_id::text,0));
 select * into previous from public.movements where operation_id=p_operation_id and sku=p_sku;
 if found then
  if previous.kind<>p_kind or previous.units<>p_units then raise exception 'Idempotency mismatch'; end if;
  if p_kind='relocate' and previous.new_location is distinct from pg_catalog.jsonb_build_object('row',p_row,'position',p_position,'level',p_level) then raise exception 'Idempotency mismatch'; end if;
  return pg_catalog.jsonb_build_object('replayed',true,'movement_id',previous.id);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_sku,1));
 select * into current_stock from public.stock where sku=p_sku for update;
 if not found then
  if p_kind<>'in' then raise exception 'Product has no stock location'; end if;
  insert into public.stock(sku,quantity,row_number,position,level)
    values(p_sku,0,p_row,p_position,p_level) returning * into current_stock;
 end if;
 next_quantity=current_stock.quantity + case p_kind when 'in' then p_units when 'out' then -p_units else 0 end;
 if next_quantity<0 then raise exception 'Insufficient stock'; end if;
 if p_kind='relocate' then
  update public.stock set row_number=p_row,position=p_position,level=p_level,updated_at=now() where sku=p_sku;
 else
  update public.stock set quantity=next_quantity,updated_at=now() where sku=p_sku;
 end if;
 insert into public.movements(operation_id,sku,kind,units,original_code,old_location,new_location)
  values(p_operation_id,p_sku,p_kind,p_units,p_original_code,
   pg_catalog.jsonb_build_object('row',current_stock.row_number,'position',current_stock.position,'level',current_stock.level),
   case when p_kind='relocate' then pg_catalog.jsonb_build_object('row',p_row,'position',p_position,'level',p_level) else null end);
 return pg_catalog.jsonb_build_object('quantity',next_quantity,'replayed',false);
end;
$$;
revoke all on function public.record_movement(uuid,text,text,integer,integer,text,integer,text) from public, anon, authenticated;
grant execute on function public.record_movement(uuid,text,text,integer,integer,text,integer,text) to service_role;
