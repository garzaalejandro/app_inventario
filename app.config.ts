import type { ExpoConfig } from 'expo/config';
const projectId = process.env.EAS_PROJECT_ID;
const config: ExpoConfig = {
 name:'ANDROMEDA 2.0',slug:'app-inventario',owner:'ale14s-team',version:'0.3.0',
 orientation:'portrait',userInterfaceStyle:'light',
 android:{package:'com.andromeda.warehouse',versionCode:3},
 plugins:[],
 ...(projectId?{extra:{eas:{projectId}},updates:{url:`https://u.expo.dev/${projectId}`,requestHeaders:{'expo-channel-name':process.env.EAS_BUILD_CHANNEL||'preview'}},runtimeVersion:{policy:'appVersion' as const}}:{}),
};
export default config;
