import type { ExpoConfig } from 'expo/config';
const projectId = process.env.EAS_PROJECT_ID || '5724e919-fa37-46e4-98fd-0e75f146833a';
const config: ExpoConfig = {
 name:'ANDROMEDA 2.0',slug:'app-inventario',owner:'ale14s-team',version:'0.4.2',
 icon:'./assets/andromeda-icon.png',splash:{image:'./assets/andromeda-icon.png',resizeMode:'contain',backgroundColor:'#101E32'},
 orientation:'portrait',userInterfaceStyle:'light',
 android:{package:'com.andromeda.warehouse',versionCode:6},
 plugins:['expo-sqlite'],
 ...(projectId?{extra:{eas:{projectId}},updates:{url:`https://u.expo.dev/${projectId}`,requestHeaders:{'expo-channel-name':process.env.EAS_BUILD_CHANNEL||'preview'}},runtimeVersion:{policy:'appVersion' as const}}:{}),
};
export default config;
