import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
async function device(server,file=':memory:'){
 const native=new DatabaseSync(file);
 const db={execSync:s=>native.exec(s),getFirstSync:(s,...p)=>native.prepare(s).get(...p)??null,getAllSync:(s,...p)=>native.prepare(s).all(...p),runSync:(s,...p)=>native.prepare(s).run(...p),withTransactionSync:fn=>{native.exec('BEGIN');try{fn();native.exec('COMMIT');}catch(e){native.exec('ROLLBACK');throw e;}}};
 const context=vm.createContext({console,Date,JSON,Promise,Error,Map,Set});
 const mods={};
 class TransportError extends Error{constructor(message,retryable){super(message);this.retryable=retryable;}}
 function synth(name,exports){const m=new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v);},{context});mods[name]=m;return m;}
 synth('expo-sqlite',{openDatabaseSync:()=>db});synth('expo-crypto',{randomUUID});synth('./transport',{remote:async(action,payload)=>{if(!server.online)throw new TransportError('offline',true);if(server.fail&&action==='device_command')throw new TransportError('Insufficient stock',false);return server.call(action,payload);},TransportError});
 const domain=new vm.SourceTextModule(fs.readFileSync('src/domain.mjs','utf8'),{context});mods['./domain.mjs']=domain;
 const source=ts.transpileModule(fs.readFileSync('src/offline.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const m=new vm.SourceTextModule(source,{context});await m.link(name=>mods[name]);await m.evaluate();return {api:m.namespace,native};
}
function server(){return {online:true,fail:false,ledger:new Map(),stock:[],call(action,p){
 if(action==='health')return {online:true};
 if(action==='catalog_page')return [{sku:'ABC',description:'Product',weight_kg:null,internal_name:null}];
 if(action==='stock_page')return this.stock;
 if(['guides','picking','history'].includes(action))return [];
 if(action==='device_command'){
  if(this.ledger.has(p.id))return this.ledger.get(p.id);
  const r=p.request;let answer={};if(r.action==='move'){const quantity=(this.stock[0]?.quantity??0)+(r.kind==='in'?r.units:r.kind==='out'?-r.units:0);if(quantity<0)throw Error('negative');this.stock=[{sku:'ABC',quantity,row_number:1,position:'A',level:1}];answer={stock:this.stock[0]};}
  this.ledger.set(p.id,answer);return answer;
 }throw Error(action);
}};}
const input=(kind,units,id=randomUUID())=>({operation_id:id,sku:'ABC',kind,units,row:1,position:'A',level:1,scanned_code:'ABC-S2-V01'});
test('Offline: first download required, exact suffix lookup, queue and resync without duplication',async()=>{
 const s=server();const {api}=await device(s);
 await assert.rejects(api.localApi('lookup',{scanned_code:'ABC'}));await api.synchronize();s.online=false;
 await api.localApi('move',input('in',3));await api.localApi('move',input('out',2));
 assert.equal((await api.localApi('lookup',{scanned_code:'ABC-S4-V01-V02'})).stock.quantity,1);
 assert.equal(api.offlineStatus().pending,2);await assert.rejects(api.synchronize());assert.equal(api.offlineStatus().pending,2);
 s.online=true;await api.synchronize();await api.synchronize();assert.equal(api.offlineStatus().pending,0);assert.equal(s.stock[0].quantity,1);assert.equal(s.ledger.size,2);
});
test('Offline conflict is retained and blocks subsequent writes until reviewed',async()=>{
 const s=server();const {api}=await device(s);await api.synchronize();await api.localApi('move',input('in',1));s.fail=true;
 await assert.rejects(api.synchronize());assert.equal(api.offlineStatus().conflicts.length,1);assert.equal(api.offlineStatus().pending,1);await assert.rejects(api.localApi('pending',{scanned_code:'XYZ'}));
 s.fail=false;api.retryConflict();await api.synchronize();assert.equal(api.offlineStatus().pending,0);
});
test('Queue and projection survive process restart; insufficient local stock is rejected',async()=>{
 const file=`/tmp/andromeda-test-${randomUUID()}.sqlite`;const s=server();let d=await device(s,file);await d.api.synchronize();await d.api.localApi('move',input('in',2));d.native.close();
 d=await device(s,file);assert.equal(d.api.offlineStatus().pending,1);assert.equal((await d.api.localApi('lookup',{scanned_code:'ABC'})).stock.quantity,2);await assert.rejects(d.api.localApi('move',input('out',3)));d.native.close();fs.rmSync(file,{force:true});
});
test('Packages remain separate offline and preparing does not decrement units; guide duplicate blocked',async()=>{
 const s=server();const {api}=await device(s);await api.synchronize();const a=await api.localApi('create_package',{label:'2'});const b=await api.localApi('create_package',{label:'1'});
 await api.localApi('add_line',{package_id:a[0].id,sku:'ABC',quantity:2});await api.localApi('add_line',{package_id:b[0].id,sku:'ABC',quantity:1});
 const pk=await api.localApi('picking');assert.equal(pk.length,2);assert.equal(pk.reduce((n,p)=>n+p.picking_lines[0].quantity,0),3);assert.equal((await api.localApi('lookup',{scanned_code:'ABC'})).stock,null);
 await api.localApi('add_guide',{guide:'GUIDE1',date:'2026-10-29'});await assert.rejects(api.localApi('add_guide',{guide:'GUIDE1',date:'2026-10-29'}));
});
test('Committed request with lost response replays the same ID after restart without double stock',async()=>{
 const s=server();const real=s.call.bind(s);let lost=true;
 s.call=function(action,p){const result=real(action,p);if(action==='device_command'&&lost){lost=false;throw new TypeError('Network request failed');}return result;};
 const {api}=await device(s);await api.synchronize();await api.localApi('move',input('in',2));await assert.rejects(api.synchronize());assert.equal(s.stock[0].quantity,2);assert.equal(api.offlineStatus().pending,1);
 await api.synchronize();assert.equal(s.stock[0].quantity,2);assert.equal(s.ledger.size,1);assert.equal(api.offlineStatus().pending,0);
});
