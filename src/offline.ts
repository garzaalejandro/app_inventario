import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import {remote,TransportError,type Product,type Stock,type Package,type Guide} from './transport';
import {baseCandidate,skuCandidates,positiveUnits,validateLocation,validateInternalName} from './domain.mjs';
const db=SQLite.openDatabaseSync('andromeda-v1.db');
db.execSync(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
CREATE TABLE IF NOT EXISTS products(sku TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS stock(sku TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,request TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',error TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS download(sku TEXT PRIMARY KEY,data TEXT NOT NULL);`);
type Request=Record<string,any>;
type Command={seq:number;id:string;request:string;status:string;error:string|null;created_at:string};
const read=<T>(key:string,fallback:T):T=>{const row=db.getFirstSync<{data:string}>('SELECT data FROM meta WHERE key=?',key);return row?JSON.parse(row.data):fallback;};
const save=(key:string,data:unknown)=>db.runSync('INSERT OR REPLACE INTO meta VALUES (?,?)',key,JSON.stringify(data));
const commands=()=>db.getAllSync<Command>('SELECT * FROM outbox ORDER BY seq');
export const offlineStatus=()=>({ready:read('ready',false),lastSync:read<string|null>('lastSync',null),pending:commands().length,conflicts:commands().filter(c=>c.status==='conflict'),online:connected,catalogCount:db.getFirstSync<{total:number}>('SELECT count(*) AS total FROM products')?.total??0});
let connected=false;let syncing:Promise<void>|null=null;
export let lastReceipt='';
function projectedStock(sku:string):Stock|null {
 const row=db.getFirstSync<{data:string}>('SELECT data FROM stock WHERE sku=?',sku);
 let s:Stock|null=row?JSON.parse(row.data):null;
 for(const c of commands()) {const p=JSON.parse(c.request);if(p.action!=='move'||p.sku!==sku)continue;
  s={quantity:s?.quantity??0,row_number:p.row??s?.row_number??1,position:p.position??s?.position??'A',level:p.level??s?.level??1};
  if(p.kind==='in')s.quantity+=p.units;if(p.kind==='out')s.quantity-=p.units;
 }
 return s;
}
function packages():Package[]{
 const list=read<Package[]>('picking',[]);
 for(const c of commands()) {const p=JSON.parse(c.request);
  if(p.action==='create_package')list.unshift({id:p.id,label:p.label,picking_lines:[]});
  if(p.action==='add_line')list.find(x=>x.id===p.package_id)?.picking_lines.push({id:p.id,sku:p.sku,quantity:p.quantity,prepared:false});
  if(p.action==='prepare_line')for(const pkg of list){const line=pkg.picking_lines.find(x=>x.id===p.line_id);if(line)line.prepared=p.prepared;}
  if(p.action==='remove_line')for(const pkg of list)pkg.picking_lines=pkg.picking_lines.filter(x=>x.id!==p.line_id);
 }
 return list;
}
function acknowledge(c:Command,answer:any){
 const p=JSON.parse(c.request);
 db.withTransactionSync(()=>{
  if(p.action==='move'){
   db.runSync('INSERT OR REPLACE INTO stock VALUES (?,?)',p.sku,JSON.stringify(answer.stock));
  }
  if(p.action==='set_identifier'&&answer.product)db.runSync('INSERT OR REPLACE INTO products VALUES (?,?)',p.sku,JSON.stringify(answer.product));
  if(p.action==='add_guide'){const list=read<Guide[]>('guides',[]);if(!list.some(g=>g.guide===p.guide))list.unshift({id:c.id,guide:p.guide,received_on:p.date});save('guides',list);}
  const list=read<Package[]>('picking',[]);
  if(p.action==='create_package')list.unshift({id:p.id,label:p.label,picking_lines:[]});
  if(p.action==='add_line')list.find(x=>x.id===p.package_id)?.picking_lines.push({id:p.id,sku:p.sku,quantity:p.quantity,prepared:false});
  if(p.action==='prepare_line')for(const pkg of list){const line=pkg.picking_lines.find(x=>x.id===p.line_id);if(line)line.prepared=p.prepared;}
  if(p.action==='remove_line')for(const pkg of list)pkg.picking_lines=pkg.picking_lines.filter(x=>x.id!==p.line_id);
  if(['create_package','add_line','prepare_line','remove_line'].includes(p.action))save('picking',list);
  if(p.action==='move')save('history',[{...p,id:c.id,created_at:c.created_at},...read<any[]>('history',[])]);

  db.runSync('DELETE FROM outbox WHERE id=?',c.id);
 });
}
async function pages(action:string,table:'products'|'stock'|'download'){
 let cursor='';let total=0;
 for(;;){const rows=await remote<any[]>(action,{cursor});
  db.withTransactionSync(()=>{for(const row of rows)db.runSync(`INSERT OR REPLACE INTO ${table} VALUES (?,?)`,row.sku,JSON.stringify(row));});
  total+=rows.length;if(rows.length<500)return total;cursor=rows[rows.length-1].sku;
 }
}
export function synchronize(forceCatalog=false):Promise<void>{
 if(syncing)return syncing;
 syncing=(async()=>{
  const health=await remote<{catalog_count?:number;catalog_revision?:number}>('health');connected=true;
  for(const c of commands()){
   if(c.status==='conflict')throw new Error('Hay un conflicto pendiente. Revisa Sincronización antes de continuar.');
   try{const answer=await remote('device_command',{id:c.id,request:JSON.parse(c.request)});acknowledge(c,answer);}
   catch(e){if(e instanceof TransportError&&!e.retryable)db.runSync("UPDATE outbox SET status='conflict',error=? WHERE id=?",e.message,c.id);throw e;}
  }
  if(forceCatalog||!read('ready',false)||read('catalogRevision',0)!==(health.catalog_revision??1)||Date.now()-read('catalogAt',0)>86400000){
   db.execSync('DELETE FROM download');const downloaded=await pages('catalog_page','download');
   if(health.catalog_count!==undefined&&downloaded!==health.catalog_count)throw new Error('La descarga del catálogo quedó incompleta. Conservamos los datos anteriores; vuelve a sincronizar.');
   db.withTransactionSync(()=>{db.execSync('DELETE FROM products; INSERT INTO products SELECT * FROM download; DELETE FROM download;');save('ready',true);save('catalogAt',Date.now());save('catalogRevision',health.catalog_revision??1);});
  }
  db.execSync('DELETE FROM download');await pages('stock_page','download');
  db.withTransactionSync(()=>{db.execSync('DELETE FROM stock; INSERT INTO stock SELECT * FROM download; DELETE FROM download;');});
  for(const action of ['guides','picking','history'])save(action,await remote(action));
  save('lastSync',new Date().toISOString());
 })().catch(e=>{if(!(e instanceof TransportError)||e.retryable)connected=false;throw e;}).finally(()=>{syncing=null;});
 return syncing;
}
export async function localApi<T>(action:string,payload:Request={}):Promise<T>{
 if(action.startsWith('owner_'))return remote<T>(action,payload);
 if(action==='health')return {online:connected} as T;
 if(action==='lookup'){
  if(!read('ready',false))throw new Error('Primero descarga el catálogo con Internet desde Sincronizar.');
  const code=String(payload.scanned_code).trim();let row:null|{data:string}=null;
  for(const candidate of skuCandidates(code)){row=db.getFirstSync<{data:string}>('SELECT data FROM products WHERE sku=?',candidate);if(row)break;}
  let product:Product|null=row?JSON.parse(row.data):null;
  if(!product&&connected){
   try {const found=await remote<{product:Product|null;stock?:Stock|null}>('lookup',{scanned_code:code});
    product=found.product;if(product){db.withTransactionSync(()=>{db.runSync('INSERT OR REPLACE INTO products VALUES (?,?)',product!.sku,JSON.stringify(product));if(found.stock)db.runSync('INSERT OR REPLACE INTO stock VALUES (?,?)',product!.sku,JSON.stringify(found.stock));});}
   }catch{connected=false;}
  }
  if(product)for(const c of commands()){const p=JSON.parse(c.request);if(p.action==='set_identifier'&&p.sku===product.sku)product.internal_name=p.internal_name||null;}
  return {product,stock:product?projectedStock(product.sku):null,candidate:baseCandidate(code),local_only:!connected} as T;
 }
 if(action==='product_search'){
  if(!read('ready',false))throw new Error('Primero descarga el catálogo con Internet desde Sincronizar.');
  const query=String(payload.query??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const terms=query.match(/[a-z0-9]+/g)??[];
  if(!terms.length)throw new Error('Escribe una palabra del nombre o del SKU.');
  const where=terms.map(()=>`lower(data) LIKE ?`).join(' AND ');
  const matches=db.getAllSync<{data:string}>(`SELECT data FROM products WHERE ${where} ORDER BY sku LIMIT 50`,...terms.map(term=>`%${term}%`));
  return matches.map(row=>JSON.parse(row.data)) as T;
 }
 if(action==='picking')return packages() as T;
 if(action==='guides'){
  const list=read<Guide[]>('guides',[]);for(const c of commands()){const p=JSON.parse(c.request);if(p.action==='add_guide')list.unshift({id:c.id,guide:p.guide,received_on:p.date});}return list as T;
 }
 if(action==='history')return [...commands().filter(c=>JSON.parse(c.request).action==='move').map(c=>({...JSON.parse(c.request),id:c.id,created_at:c.created_at})),...read<any[]>('history',[])] as T;
 if(!['move','pending','add_guide','create_package','add_line','prepare_line','remove_line','set_identifier'].includes(action))throw new Error('Acción no disponible sin conexión.');
 if(syncing)throw new Error('Sincronización en curso; espera a que termine antes de guardar.');
 if(commands().some(c=>c.status==='conflict'))throw new Error('Resuelve el conflicto de sincronización antes de registrar más operaciones.');
 const p:Request={...payload,action};const id=String(payload.operation_id??Crypto.randomUUID());
 if(action==='set_identifier'){p.internal_name=validateInternalName(p.internal_name);if(!db.getFirstSync('SELECT sku FROM products WHERE sku=?',p.sku))throw new Error('Primero consulta un producto del catálogo.');}
 if(action==='move'){
  if(!['in','out','relocate'].includes(p.kind))throw new Error('Movimiento inválido');
  if(p.kind!=='relocate')p.units=positiveUnits(p.units);
  if(p.kind!=='out')validateLocation(p.row,p.position,p.level);
  const stock=projectedStock(p.sku);if(p.kind==='in'&&stock&&(stock.row_number!==p.row||stock.position!==p.position||stock.level!==p.level))throw new Error('Para cambiar la ubicación utiliza Reacomodo.');if(p.kind==='out'&&(stock?.quantity??0)<p.units)throw new Error('Existencia local insuficiente. Sincroniza para comprobar.');
  if(p.kind==='relocate'&&!stock)throw new Error('Producto sin ubicación registrada.');
 }
 if(action==='add_guide'){
  p.guide=String(p.guide).trim();if(!p.guide||!/^\d{4}-\d{2}-\d{2}$/.test(p.date))throw new Error('Guía o fecha inválida.');
  const existing=await localApi<Guide[]>('guides');if(existing.some(g=>g.guide===p.guide))throw new Error('Esta guía ya está registrada en el equipo.');
 }
 if(action==='create_package'||action==='add_line')p.id=Crypto.randomUUID();
 if(action==='add_line'){p.quantity=positiveUnits(p.quantity);if(packages().find(x=>x.id===p.package_id)?.picking_lines.some(l=>l.sku===p.sku))throw new Error('SKU ya incluido en este paquete.');}
 const old=db.getFirstSync<{request:string}>('SELECT request FROM outbox WHERE id=?',id);
 if(old&&old.request!==JSON.stringify(p))throw new Error('Operación reutilizada con otros datos.');
 db.runSync('INSERT OR IGNORE INTO outbox(id,request,created_at) VALUES (?,?,?)',id,JSON.stringify(p),new Date().toISOString());
 lastReceipt='Guardado en este equipo · pendiente de sincronizar con la nube.';
 if(action==='create_package')return [{id:p.id,label:p.label,picking_lines:[]}] as T;
 return {queued:true} as T;
}
// Conflicts are retained, never automatically discarded. Retry after owner corrects cloud stock.
export function retryConflict(){db.runSync("UPDATE outbox SET status='pending',error=NULL WHERE status='conflict'");}
