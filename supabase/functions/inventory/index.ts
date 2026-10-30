// User-authorized general warehouse operations have no employee login.
// Platform JWT verification remains ON. The APK carries only the public anon key.
// Owner-only actions additionally require a short-lived server-issued token.
const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Content-Type':'application/json'};
async function db(path: string, method='GET', data?: unknown) {
 const r=await fetch(`${url}/rest/v1/${path}`,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'},body:data===undefined?undefined:JSON.stringify(data)});
 const value=await r.json();
 if(!r.ok)throw new Error(value.message ?? 'No se completó la operación');
 return value;
}
function text(v:unknown,max=240):string {
 if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new Error('Texto inválido');
 return v.trim();
}
function skuCandidates(code:string){const candidates=[code];while(/-[sv]\d+$/i.test(candidates.at(-1)!))candidates.push(candidates.at(-1)!.replace(/-[sv]\d+$/i,''));return [...new Set(candidates)];}
function integer(v:unknown,min:number,max:number):number {
 if(typeof v!=='number'||!Number.isInteger(v)||v<min||v>max)throw new Error('Cantidad o ubicación inválida');
 return v;
}
function uuid(v:unknown):string {
 const s=text(v);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s))throw new Error('Identificador de operación inválido');return s;
}
function location(b:Record<string,unknown>) {
 const position=text(b.position,1);if(!/^[A-R]$/.test(position))throw new Error('Posición inválida');
 return {p_row:integer(b.row,1,13),p_position:position,p_level:integer(b.level,1,7)};
}
async function owner(b:Record<string,unknown>) {
 const token=uuid(b.owner_token);
 const sessions=await db(`owner_sessions?token=eq.${token}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=token`);
 if(sessions.length!==1)throw new Error('Sesión del dueño vencida');
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return new Response(JSON.stringify({error:'Método no permitido'}),{status:405,headers:cors});
 try {
  const raw=await req.text();if(raw.length>32768)throw new Error('Solicitud demasiado grande');
  const b=JSON.parse(raw) as Record<string,unknown>;let result:unknown;
  switch(b.action){
   case 'catalog_page': {
    const cursor=typeof b.cursor==='string'?b.cursor:'';result=await db(`products?select=sku,description,internal_name,weight_kg,description_review,weight_review,reference_description&order=sku.asc&limit=500${cursor?'&sku=gt.'+encodeURIComponent(cursor):''}`);break;
   }
   case 'stock_page': {
    const cursor=typeof b.cursor==='string'?b.cursor:'';result=await db(`stock?select=*&order=sku.asc&limit=500${cursor?'&sku=gt.'+encodeURIComponent(cursor):''}`);break;
   }
   case 'device_command': {
    const request=b.request as Record<string,unknown>;
    if(!request||typeof request!=='object'||!['move','pending','add_guide','create_package','add_line','prepare_line','remove_line','set_identifier'].includes(String(request.action)))throw new Error('Comando inválido');
    result=await db('rpc/apply_device_command','POST',{p_id:uuid(b.id),p_request:request});break;
   }
   case 'health': result={online:true,version:'0.4.2',stock_is_migrated:false,...await db('rpc/catalog_status','POST',{})};break;
   case 'lookup': {
    const code=text(b.scanned_code);const candidates=skuCandidates(code);const base=candidates.at(-1)!;
    let found=[];
    for(const candidate of candidates){found=await db(`products?sku=eq.${encodeURIComponent(candidate)}&select=*&limit=1`);if(found.length)break;}
    if(found.length){const stock=await db(`stock?sku=eq.${encodeURIComponent(found[0].sku)}&select=*&limit=1`);result={product:found[0],stock:stock[0]??null};}
    else {let staged=[];for(const candidate of candidates){staged=await db(`catalog_import?sku=eq.${encodeURIComponent(candidate)}&select=sku,requires_review&limit=1`);if(staged.length)break;}result={product:null,candidate:base,requires_review:staged.length>0};}
    break;
   }
   case 'product_search': {
    const query=text(b.query,80).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
    const terms=query.match(/[a-z0-9]+/gi)??[];if(!terms.length)throw new Error('Escribe una palabra del nombre o del SKU.');
    const filters=terms.map(term=>`or(description.ilike.*${term}*,internal_name.ilike.*${term}*,sku.ilike.*${term}*)`).join(',');
    result=await db(`products?and=(${encodeURIComponent(filters)})&select=sku,description,internal_name,weight_kg,description_review,weight_review,reference_description&order=sku.asc&limit=50`);break;
   }
   case 'set_identifier': {
    result=await db('rpc/apply_device_command','POST',{p_id:uuid(b.operation_id),p_request:{action:'set_identifier',sku:text(b.sku),internal_name:typeof b.internal_name==='string'?b.internal_name.trim():''}});break;
   }
   case 'pending': {
    const code=text(b.scanned_code);result=await db('unknown_codes?on_conflict=original_code','POST',{original_code:code,candidate_sku:skuCandidates(code).at(-1)});break;
   }
   case 'move': {
    const kind=text(b.kind);if(!['in','out','relocate'].includes(kind))throw new Error('Movimiento inválido');
    result=await db('rpc/record_movement','POST',{p_operation_id:uuid(b.operation_id),p_sku:text(b.sku),p_kind:kind,p_units:integer(b.units,kind==='relocate'?0:1,100000),...(kind==='in'||kind==='relocate'?location(b):{}),p_original_code:text(b.scanned_code??b.sku)});break;
   }
   case 'guides': result=await db('receipt_guides?select=*&order=recorded_at.desc&limit=100');break;
   case 'add_guide': {
    const date=text(b.date,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>new Date().toISOString().slice(0,10))throw new Error('Fecha inválida');
    result=await db('receipt_guides','POST',{guide:text(b.guide),received_on:date});break;
   }
   case 'picking': result=await db('picking_packages?select=*,picking_lines(*)&order=created_at.desc&limit=100');break;
   case 'create_package': result=await db('picking_packages','POST',{label:text(b.label,100)});break;
   case 'add_line': result=await db('picking_lines','POST',{package_id:uuid(b.package_id),sku:text(b.sku),quantity:integer(b.quantity,1,100000)});break;
   case 'prepare_line': result=await db(`picking_lines?id=eq.${uuid(b.line_id)}`,'PATCH',{prepared:b.prepared===true});break;
   case 'remove_line': result=await db(`picking_lines?id=eq.${uuid(b.line_id)}`,'DELETE');break;
   case 'history': result=await db('movements?select=*&order=created_at.desc&limit=100');break;
   case 'owner_login': result=await db('rpc/owner_login','POST',{p_pin:text(b.pin,20)});break;
   case 'owner_pending': await owner(b);result=await db('unknown_codes?resolved_at=is.null&select=*&order=created_at.desc&limit=200');break;
   case 'owner_resolve': {
    await owner(b);
    result=await db('rpc/resolve_pending','POST',{p_id:uuid(b.id),p_sku:text(b.sku),p_description:text(b.description,2000),p_internal_name:typeof b.internal_name==='string'?b.internal_name.trim():null});break;
   }
   default:throw new Error('Acción desconocida');
  }
  return new Response(JSON.stringify({data:result}),{headers:cors});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:'Error de operación'}),{status:400,headers:cors});}
});
