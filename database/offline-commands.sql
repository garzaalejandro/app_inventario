-- New ANDROMEDA database only. Atomic replay protection for disconnected devices.
begin;
create table if not exists public.device_commands (
 id uuid primary key, request jsonb not null, result jsonb not null,
 recorded_at timestamptz not null default now()
);
alter table public.device_commands enable row level security;
revoke all on public.device_commands from public,anon,authenticated;
grant all on public.device_commands to service_role;
create table if not exists public.product_identifier_changes (
 id uuid primary key, sku text not null references public.products(sku),
 previous_name text, next_name text, created_at timestamptz not null default now()
);
alter table public.product_identifier_changes enable row level security;
revoke all on public.product_identifier_changes from public,anon,authenticated;
grant all on public.product_identifier_changes to service_role;
create or replace function public.apply_device_command(p_id uuid,p_request jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare previous_identifier text; old public.device_commands%rowtype; answer jsonb; action text:=p_request->>'action';
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,71));
 select * into old from public.device_commands where id=p_id;
 if found then
  if old.request<>p_request then raise exception 'Identificador reutilizado con otros datos'; end if;
  return old.result;
 end if;
 case action
 when 'move' then
  answer:=public.record_movement(p_id,p_request->>'sku',p_request->>'kind',(p_request->>'units')::integer,
   (p_request->>'row')::integer,p_request->>'position',(p_request->>'level')::integer,p_request->>'scanned_code');
  answer:=answer||pg_catalog.jsonb_build_object('stock',(select pg_catalog.to_jsonb(s) from public.stock s where sku=p_request->>'sku'));
 when 'set_identifier' then
  if p_request->>'internal_name' is null or length(trim(p_request->>'internal_name'))>120 then raise exception 'Identificador inválido: máximo 120 caracteres';end if;
  select internal_name into previous_identifier from public.products where sku=p_request->>'sku' for update;
  if not found then raise exception 'Producto no encontrado en el catálogo';end if;
  update public.products set internal_name=nullif(trim(p_request->>'internal_name'),'') where sku=p_request->>'sku';
  insert into public.product_identifier_changes(id,sku,previous_name,next_name) values(p_id,p_request->>'sku',previous_identifier,nullif(trim(p_request->>'internal_name'),''));
  answer:=pg_catalog.jsonb_build_object('product',(select pg_catalog.to_jsonb(p) from public.products p where sku=p_request->>'sku'));
 when 'pending' then
  insert into public.unknown_codes(original_code,candidate_sku)
  values(p_request->>'scanned_code',pg_catalog.regexp_replace(p_request->>'scanned_code','(-[sv][0-9]+)+$','','i'))
  on conflict(original_code) do nothing; answer:='{}';
 when 'add_guide' then
  if (p_request->>'date')::date>current_date then raise exception 'Fecha futura'; end if;
  insert into public.receipt_guides(guide,received_on) values(p_request->>'guide',(p_request->>'date')::date)
  on conflict(guide) do nothing;
  if not exists(select 1 from public.receipt_guides where guide=p_request->>'guide' and received_on=(p_request->>'date')::date) then raise exception 'Guía existente con otra fecha';end if;
  answer:='{}';
 when 'create_package' then
  insert into public.picking_packages(id,label) values((p_request->>'id')::uuid,p_request->>'label');
  answer:=pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id',p_request->>'id','label',p_request->>'label'));
 when 'add_line' then
  insert into public.picking_lines(id,package_id,sku,quantity) values((p_request->>'id')::uuid,(p_request->>'package_id')::uuid,p_request->>'sku',(p_request->>'quantity')::integer);
  answer:='{}';
 when 'prepare_line' then
  update public.picking_lines set prepared=(p_request->>'prepared')::boolean where id=(p_request->>'line_id')::uuid;
  if not found then raise exception 'Línea de paquete inexistente';end if; answer:='{}';
 when 'remove_line' then
  delete from public.picking_lines where id=(p_request->>'line_id')::uuid;answer:='{}';
 else raise exception 'Acción de dispositivo no permitida';
 end case;
 insert into public.device_commands(id,request,result) values(p_id,p_request,answer);
 return answer;
end $$;
revoke all on function public.apply_device_command(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.apply_device_command(uuid,jsonb) to service_role;
commit;
