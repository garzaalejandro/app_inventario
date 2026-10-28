import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,KeyboardAvoidingView,Modal,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import * as Updates from 'expo-updates';
import {api,configured,type Guide,type Lookup,type Movement,type Package,type Pending} from './src/api';
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
function Field({label,value,onChange,number=false,secret=false,onSubmit,inputRef}:{label:string;value:string;onChange:(v:string)=>void;number?:boolean;secret?:boolean;onSubmit?:()=>void;inputRef?:React.RefObject<TextInput|null>}){
 return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput ref={inputRef} style={s.input} accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType={number?'number-pad':'default'} secureTextEntry={secret} autoCorrect={false} autoCapitalize="none" onSubmitEditing={onSubmit} returnKeyType="done"/></View>;
}
export default function App(){
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
 useEffect(()=>{let active=true;const check=()=>api<{online:boolean}>('health').then(r=>{if(active)setOnline(r.online);}).catch(()=>{if(active)setOnline(false);});void check();const id=setInterval(check,30000);return()=>{active=false;clearInterval(id);};},[]);
 const run=useCallback(async<T,>(fn:()=>Promise<T>):Promise<T|undefined>=>{
  if(busyRef.current)return;busyRef.current=true;setBusy(true);setMessage('');
  try{return await fn();}catch(e){setMessage(e instanceof Error?e.message:'No se completó la operación.');return undefined;}
  finally{busyRef.current=false;setBusy(false);}
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
 async function search(){
  const scanned=code.trim();if(!scanned)return;setLookup(null);
  await run(async()=>{const result=await api<Lookup>('lookup',{scanned_code:scanned});setLookup(result);setOperation(Crypto.randomUUID());
   if(result.stock){setRow(String(result.stock.row_number));setPosition(result.stock.position);setLevel(String(result.stock.level));}
   else{setRow('1');setPosition('A');setLevel('1');}
  });
 }
 function requestMove(){
  if(!lookup?.product)return;const product=lookup.product;
  try{
   const kind=screen==='Salidas'?'out':screen==='Reacomodo'?'relocate':'in';
   const quantity=kind==='relocate'?0:positiveUnits(units);
   const loc=kind==='out'?{}:validateLocation(Number(row),position,Number(level));
   const payload={operation_id:operation,sku:product.sku,scanned_code:code.trim(),kind,units:quantity,...loc};
   setConfirmation({text:kind==='out'?`Despachar ${quantity} unidades de ${product.sku}. Se descontarán del stock.`:kind==='in'?`Agregar ${quantity} unidades de ${product.sku}.`:`Mover todas las unidades de ${product.sku} a fila ${row}, posición ${position}, nivel ${level}.`,run:async()=>{
    await run(async()=>{await api('move',payload);setMessage('Movimiento confirmado en la nube.');setLookup(null);setCode('');setOperation(Crypto.randomUUID());scanRef.current?.focus();});
   }});
  }catch(e){setMessage((e as Error).message);}
 }
 async function checkUpdates(){await run(async()=>{
  if(!Updates.isEnabled){setMessage('Las actualizaciones se habilitan en la APK vinculada al proyecto de Expo.');return;}
  const update=await Updates.checkForUpdateAsync();if(!update.isAvailable){setMessage('La aplicación está actualizada.');return;}
  await Updates.fetchUpdateAsync();setConfirmation({text:'Actualización descargada. ¿Reiniciar la app para aplicarla?',run:async()=>{await Updates.reloadAsync();}});
 });}
 const showScanner=['Consultar','Productos','Reacomodo','Salidas','Para enviar'].includes(screen);
 const product=lookup?.product;const disabled=busy||online!==true;
 return <SafeAreaProvider><SafeAreaView style={s.root}><KeyboardAvoidingView style={s.root} behavior={Platform.OS==='ios'?'padding':undefined}>
 <StatusBar style="dark"/>
 <View style={s.header}><View><Text style={s.brand}>ANDROMEDA <Text style={s.brandLight}>2.0</Text></Text><Text style={s.subtitle}>Control de almacén</Text></View><Pressable accessibilityRole="button" onPress={()=>navigate(screen==='Inicio'?'Dueño':'Inicio')}><Text style={s.headerAction}>{screen==='Inicio'?'Dueño':'Inicio'}</Text></Pressable></View>
 <View style={[s.connection,online===false&&s.offline]}><Text style={s.connectionText}>{!configured?'Conexión pendiente de configurar':online===null?'Comprobando conexión…':online?'Conectado · entorno de prueba':'Sin Internet · operaciones bloqueadas'}</Text></View>
 <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
 {screen==='Inicio'?<><Text style={s.title}>Tu almacén, en orden.</Text><Text style={s.muted}>Escanea, localiza y registra cada movimiento. Las existencias anteriores aún no se han migrado.</Text><View style={s.grid}>{modules.map(m=><Pressable accessibilityRole="button" key={m.name} style={s.module} onPress={()=>navigate(m.name)}><Text style={s.moduleIcon}>{m.icon}</Text><Text style={s.moduleTitle}>{m.name}</Text><Text style={s.muted}>{m.hint}</Text></Pressable>)}</View><Button title="Buscar actualización" onPress={()=>void checkUpdates()} disabled={disabled} secondary/></>:<><Text style={s.title}>{screen==='Dueño'?'Administración del dueño':screen}</Text>
 {screen==='Consultar'&&<Text style={s.muted}>Consulta de solo lectura.</Text>}
 {screen==='Para enviar'&&<><Text style={s.muted}>Preparar no descuenta existencias. Mantén separados los paquetes de 2 y 1 piezas.</Text><Field label="Nombre de paquete / pedido" value={label} onChange={setLabel}/><Button title="Crear paquete" disabled={disabled||!label.trim()} onPress={()=>void run(async()=>{const p=await api<Package[]>('create_package',{label});setPackageId(p[0].id);setPackages(await api('picking'));setLabel('');})}/><Text style={s.label}>Paquete seleccionado</Text><View style={s.chips}>{packages.map(p=><Pressable accessibilityRole="button" key={p.id} onPress={()=>setPackageId(p.id)} style={[s.chip,packageId===p.id&&s.selected]}><Text style={packageId===p.id?s.chipSelected:s.chipText}>{p.label}</Text></Pressable>)}</View></>}
 {showScanner&&<><Field label="QR o código de barras" value={code} inputRef={scanRef} onChange={v=>{setCode(v);setLookup(null);}} onSubmit={()=>void search()}/><Button title="Buscar producto" onPress={()=>void search()} disabled={disabled||!code.trim()}/>
 {lookup&&(!product?<View style={s.card}><Text style={s.cardTitle}>{lookup.requires_review?'SKU pendiente de revisar en el catálogo':'Código no encontrado'}</Text><Text selectable>{code}</Text><Text style={s.muted}>Candidato: {baseCandidate(code)}</Text><Button title="Guardar en pendientes" disabled={disabled} secondary onPress={()=>void run(async()=>{await api('pending',{scanned_code:code.trim()});setMessage('Código guardado en pendientes.');})}/></View>:<View style={s.card}><Text selectable style={s.cardTitle}>{product.sku}</Text><Text>{product.description}</Text><Text style={s.muted}>Identificador: {product.internal_name||'Sin identificador'}</Text><Text style={s.muted}>Peso: {product.weight_kg??'No disponible'} kg</Text><Text style={s.stock}>{lookup.stock?`${lookup.stock.quantity} unidades`:'Sin existencias registradas'}</Text>{lookup.stock&&<Text>Fila {lookup.stock.row_number} · Posición {lookup.stock.position} · Nivel {lookup.stock.level}</Text>}
 {screen!=='Consultar'&&<>{screen!=='Reacomodo'&&<Field label="Unidades" value={units} onChange={setUnits} number/>}{['Productos','Reacomodo'].includes(screen)&&<><Field label="Fila (1–13)" value={row} onChange={setRow} number/><Field label="Posición (A–R)" value={position} onChange={v=>setPosition(v.toUpperCase())}/><Field label="Nivel (1–7)" value={level} onChange={setLevel} number/></>}
 <Button title={screen==='Para enviar'?'Agregar al paquete sin descontar':screen==='Salidas'?'Revisar salida':screen==='Reacomodo'?'Revisar reacomodo':'Revisar ingreso'} disabled={disabled||(screen==='Para enviar'&&!packageId)} onPress={()=>{
  if(screen==='Para enviar'){void run(async()=>{await api('add_line',{package_id:packageId,sku:product.sku,quantity:positiveUnits(units)});setPackages(await api('picking'));setLookup(null);setCode('');});}else requestMove();
 }}/></>}
 </View>)}</>}
 {screen==='Para enviar'&&packages.map(p=><View key={p.id} style={s.card}><Text style={s.cardTitle}>{p.label}</Text>{p.picking_lines?.map(line=><View key={line.id} style={s.line}><View style={s.flex}><Text selectable>{line.sku}</Text><Text style={s.stock}>{line.quantity} piezas</Text><Text>{line.prepared?'Preparado':'Por localizar'}</Text></View><View><Button title={line.prepared?'Desmarcar':'Preparado'} secondary disabled={disabled} onPress={()=>void run(async()=>{await api('prepare_line',{line_id:line.id,prepared:!line.prepared});setPackages(await api('picking'));})}/><Button title="Quitar de lista" secondary disabled={disabled} onPress={()=>setConfirmation({text:'Quitar esta línea de preparación. No modifica el stock.',run:async()=>{await run(async()=>{await api('remove_line',{line_id:line.id});setPackages(await api('picking'));});}})}/></View></View>)}</View>)}
 {screen==='Guías'&&<><Text style={s.muted}>Registrar una guía no suma existencias.</Text><Field label="Número de guía" value={code} onChange={setCode}/><Field label="Fecha de recepción (AAAA-MM-DD)" value={date} onChange={setDate}/><Button title="Registrar guía" disabled={disabled||!code.trim()} onPress={()=>void run(async()=>{await api('add_guide',{guide:code.trim(),date});setGuides(await api('guides'));setCode('');})}/>{guides.map(g=><View style={s.card} key={g.id}><Text style={s.cardTitle}>{g.guide}</Text><Text>{g.received_on}</Text></View>)}</>}
 {screen==='Historial'&&history.map(m=><View style={s.card} key={m.id}><Text style={s.cardTitle}>{m.sku}</Text><Text>{m.kind==='in'?'Ingreso':m.kind==='out'?'Salida':'Reacomodo'} · {m.units} unidades</Text><Text style={s.muted}>{new Date(m.created_at).toLocaleString()}</Text></View>)}
 {screen==='Dueño'&&(!ownerToken?<><Text style={s.muted}>Solo el dueño nombra y registra productos desconocidos en el catálogo.</Text><Field label="PIN del dueño" value={pin} onChange={setPin} secret number onSubmit={()=>void run(async()=>{const r=await api<{owner_token:string}>('owner_login',{pin});setOwnerToken(r.owner_token);setPin('');setPending(await api('owner_pending',{owner_token:r.owner_token}));})}/><Button title="Ingresar" disabled={disabled||!pin} onPress={()=>void run(async()=>{const r=await api<{owner_token:string}>('owner_login',{pin});setOwnerToken(r.owner_token);setPin('');setPending(await api('owner_pending',{owner_token:r.owner_token}));})}/></>:<><Text style={s.muted}>Pendientes · Catalogar no suma stock.</Text>{pending.map(p=><Pressable accessibilityRole="button" style={s.card} key={p.id} onPress={()=>{setEditing(p);setOfficialSku(p.candidate_sku);setDescription('');setInternalName('');}}><Text style={s.cardTitle}>{p.original_code}</Text><Text>Nombrar producto</Text></Pressable>)}{!pending.length&&<Text>No hay pendientes.</Text>}<Button title="Cerrar administración" secondary onPress={()=>{setOwnerToken('');setPending([]);}}/></>)}
 {['Para enviar','Guías','Historial'].includes(screen)&&<Button title="Actualizar lista" onPress={()=>void refresh()} disabled={disabled} secondary/>}
 </>}
 {busy&&<ActivityIndicator size="large" color="#3e663f"/>}{!!message&&<View style={s.notice}><Text accessibilityLiveRegion="polite">{message}</Text></View>}
 <Text style={s.footer}>ANDROMEDA 2.0 · Prueba 0.3.0</Text>
 </ScrollView>
 <Modal visible={!!confirmation} transparent animationType="fade" onRequestClose={()=>{if(!busy)setConfirmation(null);}}><View style={s.overlay}><View style={s.dialog}><Text style={s.cardTitle}>Confirmar</Text><Text>{confirmation?.text}</Text><Button title="Confirmar" disabled={busy} onPress={()=>{const fn=confirmation?.run;setConfirmation(null);void fn?.();}}/><Button title="Volver" secondary disabled={busy} onPress={()=>setConfirmation(null)}/></View></View></Modal>
 <Modal visible={!!editing} transparent animationType="fade" onRequestClose={()=>{if(!busy)setEditing(null);}}><View style={s.overlay}><ScrollView contentContainerStyle={s.dialog}><Text style={s.cardTitle}>Nombrar producto</Text><Text>{editing?.original_code}</Text>{!!message&&<Text>{message}</Text>}<Field label="SKU oficial" value={officialSku} onChange={setOfficialSku}/><Field label="Descripción" value={description} onChange={setDescription}/><Field label="Identificador en español (opcional)" value={internalName} onChange={setInternalName}/><Button title="Guardar en catálogo" disabled={busy||!description.trim()||!officialSku.trim()} onPress={()=>void run(async()=>{await api('owner_resolve',{owner_token:ownerToken,id:editing?.id,sku:officialSku.trim(),description:description.trim(),internal_name:internalName.trim()});setPending(await api('owner_pending',{owner_token:ownerToken}));setEditing(null);setMessage('Producto agregado al catálogo. Etiqueta imprimible pendiente de implementar.');})}/><Button title="Volver" disabled={busy} secondary onPress={()=>setEditing(null)}/></ScrollView></View></Modal>
 </KeyboardAvoidingView></SafeAreaView></SafeAreaProvider>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#f7f6f1'},header:{paddingTop:16,paddingHorizontal:22,paddingBottom:20,backgroundColor:'#fff',flexDirection:'row',justifyContent:'space-between',alignItems:'center'},brand:{fontSize:23,fontWeight:'800',color:'#253d29',letterSpacing:1},brandLight:{fontWeight:'400'},subtitle:{color:'#687368',marginTop:3},headerAction:{color:'#426644',fontWeight:'700',padding:10},connection:{backgroundColor:'#e6eee2',padding:9},offline:{backgroundColor:'#f6ded4'},connectionText:{fontSize:12,textAlign:'center',color:'#334c36'},content:{padding:20,paddingBottom:45,maxWidth:1000,width:'100%',alignSelf:'center'},title:{fontSize:29,fontWeight:'700',color:'#233c28',marginBottom:10},muted:{color:'#647066',lineHeight:21,marginVertical:5},grid:{flexDirection:'row',flexWrap:'wrap',gap:12,marginVertical:22},module:{backgroundColor:'#fff',padding:18,borderRadius:18,flexGrow:1,flexBasis:200,borderWidth:1,borderColor:'#e5e7df'},moduleIcon:{fontSize:30,color:'#53784c',marginBottom:12},moduleTitle:{fontSize:19,fontWeight:'700',color:'#263e2b'},field:{marginVertical:10},label:{fontSize:14,fontWeight:'600',color:'#435646',marginBottom:7},input:{backgroundColor:'#fff',borderColor:'#cbd4c7',borderWidth:1,borderRadius:10,padding:13,fontSize:16,minHeight:50,color:'#24382a'},button:{backgroundColor:'#426644',borderRadius:11,paddingVertical:14,paddingHorizontal:17,alignItems:'center',marginVertical:7,minHeight:48},buttonText:{color:'#fff',fontSize:15,fontWeight:'700'},secondary:{backgroundColor:'#edf1e8',borderWidth:1,borderColor:'#cdd9c8'},secondaryText:{color:'#365b39'},disabled:{opacity:0.45},card:{backgroundColor:'#fff',borderRadius:16,padding:18,marginTop:16,borderWidth:1,borderColor:'#e2e6dc',gap:8},cardTitle:{fontSize:17,fontWeight:'700',color:'#2c4430',marginBottom:7},stock:{fontSize:21,fontWeight:'700',color:'#426644',marginVertical:6},chips:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:10},chip:{borderWidth:1,borderColor:'#b9c9b3',borderRadius:20,padding:10,backgroundColor:'#fff'},selected:{backgroundColor:'#426644'},chipSelected:{color:'#fff'},chipText:{color:'#426644'},line:{flexDirection:'row',gap:10,alignItems:'center',borderTopWidth:1,borderTopColor:'#e8eae5',paddingVertical:12},flex:{flex:1},notice:{backgroundColor:'#fff3d8',padding:16,borderRadius:12,marginTop:16},footer:{color:'#778174',textAlign:'center',marginTop:30,fontSize:12},overlay:{flex:1,backgroundColor:'rgba(20,32,23,.55)',justifyContent:'center',padding:22},dialog:{backgroundColor:'#fff',padding:24,borderRadius:18,maxWidth:600,width:'100%',alignSelf:'center',gap:10},
});
