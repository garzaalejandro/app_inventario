-- Only in the independent test project. Everything rolls back.
begin;
insert into public.products(sku,description) values('__TEST_ONLY__','Prueba');
select public.record_movement('10000000-0000-4000-8000-000000000001','__TEST_ONLY__','in',3,1,'R',7);
select public.record_movement('10000000-0000-4000-8000-000000000002','__TEST_ONLY__','out',2);
select public.record_movement('10000000-0000-4000-8000-000000000002','__TEST_ONLY__','out',2);
do $$ begin
 begin
  perform public.record_movement('10000000-0000-4000-8000-000000000003','__TEST_ONLY__','out',2);
  raise exception 'TEST FAILED';
 exception when raise_exception then
  if SQLERRM <> 'Insufficient stock' then raise;end if;
 end;
 if (select quantity from public.stock where sku='__TEST_ONLY__')<>1 then raise exception 'Wrong stock';end if;
end $$;
rollback;
