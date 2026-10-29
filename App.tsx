import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Image,KeyboardAvoidingView,Modal,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import * as Updates from 'expo-updates';
import {api,configured,offlineStatus,synchronize,lastReceipt,retryConflict,type Guide,type Lookup,type Movement,type Package,type Pending} from './src/api';
import {baseCandidate,positiveUnits,validateLocation} from './src/domain.mjs';

type Screen='Inicio'|'Consultar'|'Productos'|'Reacomodo'|'Salidas'|'Para enviar'|'Guías'|'Historial'|'Dueño';
const modules:{name:Screen;hint:string;icon:string}[]=[
 {name:'Consultar',hint:'Ubicación y existencias · solo lectura',icon:'⌕'},
 {name:'Productos',hint:'Registrar unidades que ingresan',icon:'+'},
 {name:'Reacomodo',hint:'Mover todas las unidades del SKU',icon:'↔'},
 {name:'Para enviar',hint:'Preparar por paquete sin descontar',icon:'▣'},
 {name:'Salidas',hint:'Confirmar el despacho físico',icon:'↗'},
 {name:'Guías',hint:'Fecha y número de recepción',icon:'≡'},
 {name:'Historial',hint:'Movimientos confirmados',icon:'◷'},
];
function Button({title,onPress,disabled=false,secondary=false}:{title:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}){
 return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button,secondary&&s.secondary,disabled&&s.disabled]}><Text style={[s.buttonText,secondary&&s.secondaryText]}>{title}</Text></Pressable>;
}
function Field({label,value,onChange,number=false,secret=false,onSubmit,inputRef}:{label:string;value:string;onChange:(v:string)=>void;number?:boolean;secret?:boolean;onSubmit?:(text:string)=>void;inputRef?:React.RefObject<TextInput|null>}){
 const settle=useRef<ReturnType<typeof setTimeout>|null>(null);
 const submitRef=useRef(onSubmit);submitRef.current=onSubmit;
 useEffect(()=>()=>{if(settle.current)clearTimeout(settle.current);},[]);
 const submit=(text:string)=>{if(settle.current)clearTimeout(settle.current);submitRef.current?.(text);};
 return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput ref={inputRef} style={s.input} accessibilityLabel={label} value={value} onChangeText={text=>{if(settle.current)clearTimeout(settle.current);const clean=text.replace(/[\r\n]+/g,'');onChange(clean);if(/[\r\n]/.test(text))submit(clean);else if(inputRef&&clean.length>=4&&Math.abs(clean.length-value.length)>=4)settle.current=setTimeout(()=>submit(clean),250);}} keyboardType={number?'number-pad':'default'} secureTextEntry={secret} autoCorrect={false} autoCapitalize="none" onSubmitEditing={e=>submit(e.nativeEvent.text)} submitBehavior="submit" autoFocus={!!inputRef} selectTextOnFocus={!!inputRef} returnKeyType="done"/></View>;
}
export default function App(){
 const [syncState,setSyncState]=useState(()=>offlineStatus());
 const [syncBusy,setSyncBusy]=useState(false);const [syncDetails,setSyncDetails]=useState(false);
 const [screen,setScreen]=useState<Screen>('Inicio');
 const [busy,setBusy]=useState(false);const busyRef=useRef(false);
 const [online,setOnline]=useState<boolean|null>(null);const [message,setMessage]=useState('');
 const [code,setCode]=useState('');const [lookup,setLookup]=useState<Lookup|null>(null);
 const [units,setUnits]=useState('1');const [row,setRow]=useState('1');const [position,setPosition]=useState('A');const [level,setLevel]=useState('1');
 const [operation,setOperation]=useState(()=>Crypto.randomUUID());
 const [packages,setPackages]=useState<Package[]>([]);const [packageId,setPackageId]=useState('');const [label,setLabel]=useState('');
 const [guides,setGuides]=useState<Guide[]>([]);const [history,setHistory]=useState<Movement[]>([]);
 const [date,setDate]=useState(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;});
 const [pin,setPin]=useState('');const [ownerToken,setOwnerToken]=useState('');const [pending,setPending]=useState<Pending[]>([]);
 const [editing,setEditing]=useState<Pending|null>(null);const [officialSku,setOfficialSku]=useState('');const [description,setDescription]=useState('');const [internalName,setInternalName]=useState('');
 const [confirmation,setConfirmation]=useState<{text:string;run:()=>Promise<void>}|null>(null);
 const scanRef=useRef<TextInput>(null);
 useEffect(()=>{let active=true;
  const check=async()=>{if(!active)return;setSyncBusy(true);try{await synchronize();}catch{}finally{if(active){setSyncState(offlineStatus());setOnline(offlineStatus().online);setSyncBusy(false);}}};
  void check();const id=setInterval(()=>void check(),30000);return()=>{active=false;clearInterval(id);};},[]);
 async function syncNow(){setSyncBusy(true);try{await synchronize(true);setMessage('Catálogo y movimientos sincronizados.');}catch(e){setMessage((e as Error).message);}finally{setSyncState(offlineStatus());setOnline(offlineStatus().online);setSyncBusy(false);}}
 useEffect(()=>{if(['Consultar','Productos','Reacomodo','Salidas','Para enviar','Guías'].includes(screen))scanRef.current?.focus();},[screen]);

 const run=useCallback(async<T,>(fn:()=>Promise<T>):Promise<T|undefined>=>{
  if(busyRef.current)return;busyRef.current=true;setBusy(true);setMessage('');
  try{return await fn();}catch(e){setMessage(e instanceof Error?e.message:'No se completó la operación.');return undefined;}
  finally{busyRef.current=false;setBusy(false);setSyncState(offlineStatus());}
 },[]);
 async function refresh(target=screen){
  await run(async()=>{
   if(target==='Para enviar')setPackages(await api<Package[]>('picking'));
   if(target==='Guías')setGuides(await api<Guide[]>('guides'));
   if(target==='Historial')setHistory(await api<Movement[]>('history'));
   if(target==='Dueño'&&ownerToken)setPending(await api<Pending[]>('owner_pending',{owner_token:ownerToken}));
  });
 }
 function navigate(next:Screen){
  if(busyRef.current)return;
  setScreen(next);setMessage('');setCode('');setLookup(null);setUnits('1');
  if(next!=='Dueño'){setOwnerToken('');setPin('');setPending([]);}
  void refresh(next);
 }
 async function registerGuide(scannedText=code){
  const guide=scannedText.trim();if(!guide||busyRef.current)return;
  await run(async()=>{
   await api('add_guide',{guide,date});
   setCode('');setMessage(lastReceipt+' Lista para la siguiente lectura.');
   scanRef.current?.focus();setGuides(await api<Guide[]>('guides'));
  });
 }
 async function search(scannedText=code){
  const scanned=scannedText.trim();if(!scanned)return;setCode(scanned);setLookup(null);
  await run(async()=>{const result=await api<Lookup>('lookup',{scanned_code:scanned});setLookup(result);setOperation(Crypto.randomUUID());
   if(result.stock){setRow(String(result.stock.row_number));setPosition(result.stock.position);setLevel(String(result.stock.level));}
   else{setRow('1');setPosition('A');setLevel('1');}
   scanRef.current?.setNativeProps({selection:{start:0,end:scanned.length}});
  });
 }
 function requestMove(){
  if(!lookup?.product)return;const product=lookup.product;
  try{
   const kind=screen==='Salidas'?'out':screen==='Reacomodo'?'relocate':'in';
   const quantity=kind==='relocate'?0:positiveUnits(units);
   const loc=kind==='out'?{}:validateLocation(Number(row),position,Number(level));
   const payload={operation_id:operation,sku:product.sku,scanned_code:code.trim(),kind,units:quantity,...loc};
   setConfirmation({text:kind==='out'?`Despachar ${quantity} unidades de ${product.sku}. Se guardará en este equipo; debe sincronizarse para confirmar existencias globales.`:kind==='in'?`Agregar ${quantity} unidades de ${product.sku}.`:`Mover todas las unidades de ${product.sku} a fila ${row}, posición ${position}, nivel ${level}.`,run:async()=>{
    await run(async()=>{await api('move',payload);setMessage(lastReceipt);setLookup(null);setCode('');setOperation(Crypto.randomUUID());scanRef.current?.focus();});
   }});
  }catch(e){setMessage((e as Error).message);}
 }
 async function checkUpdates(){await run(async()=>{
  if(!Updates.isEnabled){setMessage('Las actualizaciones se habilitan en la APK vinculada al proyecto de Expo.');return;}
  const update=await Updates.checkForUpdateAsync();if(!update.isAvailable){setMessage('La aplicación está actualizada.');return;}
  await Updates.fetchUpdateAsync();setConfirmation({text:'Actualización descargada. ¿Reiniciar la app para aplicarla?',run:async()=>{await Updates.reloadAsync();}});
 });}
 const showScanner=['Consultar','Productos','Reacomodo','Salidas','Para enviar'].includes(screen);
 const product=lookup?.product;const disabled=busy||syncBusy;
 return <SafeAreaProvider><SafeAreaView style={s.root}><KeyboardAvoidingView style={s.root} behavior={Platform.OS==='ios'?'padding':undefined}>
 <StatusBar style="light"/>
 <View style={s.header}><Image source={require('./assets/andromeda-icon.png')} style={s.logo} accessibilityLabel="Andromeda"/><View style={s.brandBlock}><Text style={s.brand}>ANDROMEDA</Text><Text style={s.subtitle}>WAREHOUSE · 2.0</Text></View><Pressable accessibilityRole="button" onPress={()=>navigate(screen==='Inicio'?'Dueño':'Inicio')}><Text style={s.headerAction}>{screen==='Inicio'?'ADMIN':'INICIO'}</Text></Pressable></View>
 <View style={[s.connection,online===false&&s.offline]}><Text style={s.connectionText}>{!configured?'Conexión pendiente de configurar':online===null?'Comprobando conexión…':online?'Conectado':'Sin Internet · trabajando en este equipo'}</Text></View>
 <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
 <View style={s.syncCard}><View style={s.syncRow}><View style={s.flex}><Text style={s.syncTitle}>{syncBusy?'Sincronizando datos':syncState.ready?'Listo para trabajar':'Descarga inicial pendiente'}</Text><Text style={s.syncCaption}>{syncState.pending} movimientos por enviar</Text></View><Pressable accessibilityRole="button" onPress={()=>setSyncDetails(!syncDetails)}><Text style={s.detailLink}>{syncDetails?'Ocultar':'Detalles'}</Text></Pressable></View>
 {(syncDetails||!syncState.ready)&&<><Text style={s.muted}>Última sincronización: {syncState.lastSync?new Date(syncState.lastSync).toLocaleString():'Nunca'}. Las existencias locales pueden diferir de otros equipos.</Text><Button title={syncBusy?'Sincronizando…':'Sincronizar ahora'} onPress={()=>void syncNow()} disabled={busy||syncBusy} secondary/></>}
 </View>
 {syncState.conflicts.map(c=><View style={s.notice} key={c.id}><Text selectable>Conflicto conservado: {c.id}</Text><Text>{c.error}</Text><Text>Requiere revisión del dueño. No se ha descartado el movimiento.</Text></View>)}
 {ownerToken&&syncState.conflicts.length>0&&<Button title="Reintentar tras revisar el conflicto" onPress={()=>{retryConflict();void syncNow();}} disabled={disabled}/>}

 {screen==='Inicio'?<><View style={s.hero}><Text style={s.eyebrow}>TU CENTRO DE OPERACIONES</Text><Text style={s.heroTitle}>Todo bajo control.</Text><Text style={s.heroText}>Cada producto, en su lugar. Registra y consulta tu almacén, incluso sin conexión.</Text><Pressable accessibilityRole="button" style={s.heroAction} onPress={()=>navigate('Productos')}><Text style={s.heroActionText}>＋  Registrar un ingreso</Text><Text style={s.heroArrow}>↗</Text></Pressable></View><View style={s.sectionRow}><Text style={s.sectionTitle}>Operaciones</Text><Text style={s.sectionMeta}>ALMACÉN</Text></View><View style={s.grid}>{modules.map(m=><Pressable accessibilityRole="button" key={m.name} style={s.module} onPress={()=>navigate(m.name)}><Text style={s.moduleIcon}>{m.icon}</Text><Text style={s.moduleTitle}>{m.name}</Text><Text style={s.moduleHint}>{m.hint}</Text><Text style={s.moduleArrow}>↗</Text></Pressable>)}</View><Button title="Buscar actualización" onPress={()=>void checkUpdates()} disabled={disabled} secondary/></>:<><Text style={s.title}>{screen==='Dueño'?'Administración del dueño':screen}</Text>
 {screen==='Consultar'&&<Text style={s.muted}>Consulta de solo lectura.</Text>}
 {screen==='Para enviar'&&<><Text style={s.muted}>Preparar no descuenta existencias. Mantén separados los paquetes de 2 y 1 piezas.</Text><Field label="Nombre de paquete / pedido" value={label} onChange={setLabel}/><Button title="Crear paquete" disabled={disabled||!label.trim()} onPress={()=>void run(async()=>{const p=await api<Package[]>('create_package',{label});setPackageId(p[0].id);setPackages(await api('picking'));setLabel('');})}/><Text style={s.label}>Paquete seleccionado</Text><View style={s.chips}>{packages.map(p=><Pressable accessibilityRole="button" key={p.id} onPress={()=>setPackageId(p.id)} style={[s.chip,packageId===p.id&&s.selected]}><Text style={packageId===p.id?s.chipSelected:s.chipText}>{p.label}</Text></Pressable>)}</View></>}
 {showScanner&&<><Field label="QR o código de barras" value={code} inputRef={scanRef} onChange={v=>{setCode(v);setLookup(null);}} onSubmit={text=>void search(text)}/><Button title="Buscar producto" onPress={()=>void search()} disabled={disabled||!code.trim()}/>
 {lookup&&(!product?<View style={s.card}><Text style={s.cardTitle}>{lookup.requires_review?'SKU pendiente de revisar en el catálogo':'Código no encontrado'}</Text><Text selectable>{code}</Text><Text style={s.muted}>Candidato: {baseCandidate(code)}</Text><Button title="Guardar en pendientes" disabled={disabled} secondary onPress={()=>void run(async()=>{await api('pending',{scanned_code:code.trim()});setMessage(lastReceipt);})}/></View>:<View style={s.card}><Text selectable style={s.cardTitle}>{product.sku}</Text><Text>{product.description}</Text><Text style={s.muted}>Identificador: {product.internal_name||'Sin identificador'}</Text><Text style={s.muted}>Peso: {product.weight_kg??'No disponible'} kg</Text><Text style={s.stock}>{lookup.stock?`${lookup.stock.quantity} unidades`:'Sin existencias registradas'}</Text>{lookup.stock&&<Text>Fila {lookup.stock.row_number} · Posición {lookup.stock.position} · Nivel {lookup.stock.level}</Text>}
 {screen!=='Consultar'&&<>{screen!=='Reacomodo'&&<Field label="Unidades" value={units} onChange={setUnits} number/>}{['Productos','Reacomodo'].includes(screen)&&<><Field label="Fila (1–13)" value={row} onChange={setRow} number/><Field label="Posición (A–R)" value={position} onChange={v=>setPosition(v.toUpperCase())}/><Field label="Nivel (1–7)" value={level} onChange={setLevel} number/></>}
 <Button title={screen==='Para enviar'?'Agregar al paquete sin descontar':screen==='Salidas'?'Revisar salida':screen==='Reacomodo'?'Revisar reacomodo':'Revisar ingreso'} disabled={disabled||(screen==='Para enviar'&&!packageId)} onPress={()=>{
  if(screen==='Para enviar'){void run(async()=>{await api('add_line',{package_id:packageId,sku:product.sku,quantity:positiveUnits(units)});setPackages(await api('picking'));setLookup(null);setCode('');});}else requestMove();
 }}/></>}
 </View>)}</>}
 {screen==='Para enviar'&&packages.map(p=><View key={p.id} style={s.card}><Text style={s.cardTitle}>{p.label}</Text>{p.picking_lines?.map(line=><View key={line.id} style={s.line}><View style={s.flex}><Text selectable>{line.sku}</Text><Text style={s.stock}>{line.quantity} piezas</Text><Text>{line.prepared?'Preparado':'Por localizar'}</Text></View><View><Button title={line.prepared?'Desmarcar':'Preparado'} secondary disabled={disabled} onPress={()=>void run(async()=>{await api('prepare_line',{line_id:line.id,prepared:!line.prepared});setPackages(await api('picking'));})}/><Button title="Quitar de lista" secondary disabled={disabled} onPress={()=>setConfirmation({text:'Quitar esta línea de preparación. No modifica el stock.',run:async()=>{await run(async()=>{await api('remove_line',{line_id:line.id});setPackages(await api('picking'));});}})}/></View></View>)}</View>)}
 {screen==='Guías'&&<><Text style={s.muted}>Registrar una guía no suma existencias.</Text><Field label="Número de guía" value={code} inputRef={scanRef} onChange={setCode} onSubmit={text=>void registerGuide(text)}/><Field label="Fecha de recepción (AAAA-MM-DD)" value={date} onChange={setDate}/><Button title="Registrar guía" disabled={disabled||!code.trim()} onPress={()=>void registerGuide()}/>{guides.map(g=><View style={s.card} key={g.id}><Text style={s.cardTitle}>{g.guide}</Text><Text>{g.received_on}</Text></View>)}</>}
 {screen==='Historial'&&history.map(m=><View style={s.card} key={m.id}><Text style={s.cardTitle}>{m.sku}</Text><Text>{m.kind==='in'?'Ingreso':m.kind==='out'?'Salida':'Reacomodo'} · {m.units} unidades</Text><Text style={s.muted}>{new Date(m.created_at).toLocaleString()}</Text></View>)}
 {screen==='Dueño'&&(!ownerToken?<><Text style={s.muted}>Solo el dueño nombra y registra productos desconocidos en el catálogo.</Text><Field label="PIN del dueño" value={pin} onChange={setPin} secret number onSubmit={()=>void run(async()=>{const r=await api<{owner_token:string}>('owner_login',{pin});setOwnerToken(r.owner_token);setPin('');setPending(await api('owner_pending',{owner_token:r.owner_token}));})}/><Button title="Ingresar" disabled={disabled||!pin} onPress={()=>void run(async()=>{const r=await api<{owner_token:string}>('owner_login',{pin});setOwnerToken(r.owner_token);setPin('');setPending(await api('owner_pending',{owner_token:r.owner_token}));})}/></>:<><Text style={s.muted}>Pendientes · Catalogar no suma stock.</Text>{pending.map(p=><Pressable accessibilityRole="button" style={s.card} key={p.id} onPress={()=>{setEditing(p);setOfficialSku(p.candidate_sku);setDescription('');setInternalName('');}}><Text style={s.cardTitle}>{p.original_code}</Text><Text>Nombrar producto</Text></Pressable>)}{!pending.length&&<Text>No hay pendientes.</Text>}<Button title="Cerrar administración" secondary onPress={()=>{setOwnerToken('');setPending([]);}}/></>)}
 {['Para enviar','Guías','Historial'].includes(screen)&&<Button title="Actualizar lista" onPress={()=>void refresh()} disabled={disabled} secondary/>}
 </>}
 {busy&&<ActivityIndicator size="large" color="#087E83"/>}{!!message&&<View style={s.notice}><Text accessibilityLiveRegion="polite">{message}</Text></View>}
 <Text style={s.footer}>ANDROMEDA 2.0 · Versión 0.4.0 · Sincronización local</Text>
 </ScrollView>
 <Modal visible={!!confirmation} transparent animationType="fade" onRequestClose={()=>{if(!busy)setConfirmation(null);}}><View style={s.overlay}><View style={s.dialog}><Text style={s.cardTitle}>Confirmar</Text><Text>{confirmation?.text}</Text><Button title="Confirmar" disabled={busy} onPress={()=>{const fn=confirmation?.run;setConfirmation(null);void fn?.();}}/><Button title="Volver" secondary disabled={busy} onPress={()=>setConfirmation(null)}/></View></View></Modal>
 <Modal visible={!!editing} transparent animationType="fade" onRequestClose={()=>{if(!busy)setEditing(null);}}><View style={s.overlay}><ScrollView contentContainerStyle={s.dialog}><Text style={s.cardTitle}>Nombrar producto</Text><Text>{editing?.original_code}</Text>{!!message&&<Text>{message}</Text>}<Field label="SKU oficial" value={officialSku} onChange={setOfficialSku}/><Field label="Descripción" value={description} onChange={setDescription}/><Field label="Identificador en español (opcional)" value={internalName} onChange={setInternalName}/><Button title="Guardar en catálogo" disabled={busy||!description.trim()||!officialSku.trim()} onPress={()=>void run(async()=>{await api('owner_resolve',{owner_token:ownerToken,id:editing?.id,sku:officialSku.trim(),description:description.trim(),internal_name:internalName.trim()});setPending(await api('owner_pending',{owner_token:ownerToken}));setEditing(null);setMessage('Producto agregado al catálogo. Etiqueta imprimible pendiente de implementar.');})}/><Button title="Volver" disabled={busy} secondary onPress={()=>setEditing(null)}/></ScrollView></View></Modal>
 </KeyboardAvoidingView></SafeAreaView></SafeAreaProvider>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#101E32'},
 header:{paddingVertical:14,paddingHorizontal:18,backgroundColor:'#101E32',flexDirection:'row',alignItems:'center',gap:10},
 logo:{width:48,height:48,borderRadius:14},brandBlock:{flex:1},brand:{fontSize:19,fontWeight:'800',color:'#F5FAFF',letterSpacing:1.6},brandLight:{fontWeight:'400'},subtitle:{color:'#9CACC0',fontSize:10,letterSpacing:2,marginTop:5},headerAction:{color:'#46DDD0',fontSize:11,fontWeight:'800',letterSpacing:1,paddingVertical:10,paddingHorizontal:12,borderRadius:10,borderWidth:1,borderColor:'#284356'},
 connection:{backgroundColor:'#DFF6F0',padding:8},offline:{backgroundColor:'#FFF0D8'},connectionText:{fontSize:12,fontWeight:'600',textAlign:'center',color:'#244957'},
 content:{padding:18,paddingBottom:40,maxWidth:1000,width:'100%',alignSelf:'center',backgroundColor:'#F1F5F9',flexGrow:1},
 syncCard:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#E0E8EF',borderRadius:16,padding:14,marginBottom:18},syncRow:{flexDirection:'row',alignItems:'center',gap:12},syncTitle:{fontSize:13,fontWeight:'700',color:'#1A3348'},syncCaption:{fontSize:12,color:'#65788B',marginTop:4},detailLink:{fontSize:12,fontWeight:'700',color:'#087E83',padding:8},
 hero:{backgroundColor:'#152A43',borderRadius:22,padding:22,marginBottom:24},eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.8,color:'#52DED0',marginBottom:12},heroTitle:{fontSize:30,lineHeight:36,fontWeight:'800',color:'#FFF',letterSpacing:-.8},heroText:{fontSize:14,lineHeight:22,color:'#BFCCDB',marginTop:10,marginBottom:20},heroAction:{backgroundColor:'#36D4C3',borderRadius:12,padding:15,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},heroActionText:{color:'#0D2C38',fontSize:14,fontWeight:'800'},heroArrow:{fontSize:20,color:'#0D2C38'},
 sectionRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:14},sectionTitle:{fontSize:20,fontWeight:'800',color:'#152A43'},sectionMeta:{fontSize:10,fontWeight:'700',color:'#7D8FA3',letterSpacing:1.6},
 title:{fontSize:28,fontWeight:'800',color:'#152A43',marginBottom:12,letterSpacing:-.6},muted:{color:'#64778A',fontSize:13,lineHeight:20,marginVertical:5},
 grid:{flexDirection:'row',flexWrap:'wrap',gap:12,marginBottom:18},module:{backgroundColor:'#FFF',padding:16,borderRadius:18,flexGrow:1,flexBasis:140,minHeight:162,borderWidth:1,borderColor:'#E0E8EF'},moduleIcon:{fontSize:24,fontWeight:'600',color:'#087E83',backgroundColor:'#E6F8F4',width:42,height:42,textAlign:'center',lineHeight:42,borderRadius:12,marginBottom:13},moduleTitle:{fontSize:17,fontWeight:'800',color:'#172F46'},moduleHint:{fontSize:12,lineHeight:18,color:'#6B7D90',marginTop:6,paddingBottom:18},moduleArrow:{position:'absolute',right:14,bottom:10,fontSize:19,color:'#8DA1B2'},
 field:{marginVertical:10},label:{fontSize:13,fontWeight:'700',color:'#314B62',marginBottom:8},input:{backgroundColor:'#FFF',borderColor:'#CCD9E4',borderWidth:1,borderRadius:12,padding:14,fontSize:16,minHeight:52,color:'#132D43'},
 button:{backgroundColor:'#087E83',borderRadius:12,paddingVertical:15,paddingHorizontal:17,alignItems:'center',marginVertical:7,minHeight:50},buttonText:{color:'#FFF',fontSize:14,fontWeight:'800'},secondary:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#CCD9E4'},secondaryText:{color:'#20475D'},disabled:{opacity:.45},
 card:{backgroundColor:'#FFF',borderRadius:18,padding:18,marginTop:16,borderWidth:1,borderColor:'#DDE6EE',gap:8},cardTitle:{fontSize:17,fontWeight:'800',color:'#18334B',marginBottom:7},stock:{fontSize:26,fontWeight:'800',color:'#087E83',marginVertical:6},
 chips:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:10},chip:{borderWidth:1,borderColor:'#CCD9E4',borderRadius:12,padding:12,backgroundColor:'#FFF'},selected:{backgroundColor:'#152A43',borderColor:'#152A43'},chipSelected:{color:'#FFF',fontWeight:'700'},chipText:{color:'#314B62'},
 line:{flexDirection:'row',gap:10,alignItems:'center',borderTopWidth:1,borderTopColor:'#E7EDF3',paddingVertical:12},flex:{flex:1},notice:{backgroundColor:'#FFF0D8',padding:16,borderRadius:14,marginTop:16,borderWidth:1,borderColor:'#F1D5A8'},footer:{color:'#8B9BAC',textAlign:'center',marginTop:28,fontSize:10,letterSpacing:.4},overlay:{flex:1,backgroundColor:'rgba(9,22,39,.75)',justifyContent:'center',padding:22},dialog:{backgroundColor:'#F8FAFC',padding:24,borderRadius:22,maxWidth:600,width:'100%',alignSelf:'center',gap:10},
});
