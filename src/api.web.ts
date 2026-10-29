// Desktop preparation uses the online gateway; SQLite offline storage is Android-only.
import {remote} from './transport';
export type {Product,Stock,Lookup,Line,Package,Pending,Guide,Movement} from './transport';
export {configured,remote as api} from './transport';
let connected=false;
export const lastReceipt='Confirmado en la nube.';
export const offlineStatus=()=>({ready:true,lastSync:null as string|null,pending:0,conflicts:[] as {id:string;error:string|null}[],online:connected});
export async function synchronize(_force=false){await remote('health');connected=true;}
export function retryConflict(){}
