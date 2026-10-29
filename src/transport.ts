export interface Product { sku:string; description:string; internal_name:string|null; weight_kg:number|null }
export interface Stock { quantity:number; row_number:number; position:string; level:number }
export interface Lookup { product:Product|null; stock?:Stock|null; requires_review?:boolean; candidate?:string }
export interface Line { id:string;sku:string;quantity:number;prepared:boolean }
export interface Package { id:string;label:string;picking_lines:Line[] }
export interface Pending { id:string;original_code:string;candidate_sku:string }
export interface Guide { id:string;guide:string;received_on:string }
export interface Movement { id:string;sku:string;kind:string;units:number;created_at:string }
const endpoint=process.env.EXPO_PUBLIC_API_URL;
const key=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const configured=Boolean(endpoint&&key);
export class TransportError extends Error { constructor(message:string,public retryable:boolean){super(message);} }
export async function remote<T>(action:string,payload:Record<string,unknown>={}):Promise<T>{
 if(!endpoint||!key)throw new Error('Falta configurar la conexión de esta versión de prueba.');
 if(!endpoint.startsWith('https://'))throw new Error('La conexión requiere HTTPS.');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
 try{
  const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`,apikey:key},body:JSON.stringify({action,...payload}),signal:controller.signal});
  const body=await res.json();
  if(!res.ok||body.error)throw new TransportError(body.error??'No se completó la operación.',res.status>=500||res.status===429);
  if(body.data?.error)throw new Error(body.data.error);
  return body.data as T;
 }catch(e){
  if(e instanceof Error&&(e.name==='AbortError'||e.message.includes('Network request failed')||e.message.includes('Failed to fetch')))throw new TransportError('Sin conexión. La operación permanece en el equipo.',true);
  throw e;
 }finally{clearTimeout(timer);}
}
