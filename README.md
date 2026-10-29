# ANDROMEDA 2.0

## Descargar APK para Android

### [⬇ Descargar ANDROMEDA — APK de prueba](https://github.com/garzaalejandro/app_inventario/releases/download/apk-prueba/ANDROMEDA-prueba.apk)

El enlace estará disponible después de la primera compilación y publicación correcta.
Si muestra 404, la APK aún no se ha publicado. No indica que la compilación terminó.

[Ver estado de compilación](https://github.com/garzaalejandro/app_inventario/actions/workflows/android.yml) · [Ver versión de prueba](https://github.com/garzaalejandro/app_inventario/releases/tag/apk-prueba)

APK con firma de prueba para revisión en Honeywell CT60 Android 11 y 13.
El workflow actualiza este mismo enlace cuando publica una nueva APK correcta.


Aplicación nueva de almacén con Expo SDK 54, React Native y TypeScript.
Backend independiente en Supabase. El código anterior Flutter fue referencia,
no es la aplicación activa de este repositorio.

## Versión 0.4.0 — almacenamiento sin conexión

Catálogo y existencias locales en SQLite, cola persistente para entradas, salidas,
reacomodos, guías, pendientes y paquetes; reintentos con el mismo identificador.
La primera descarga y la administración del dueño requieren Internet.
El stock local incluye operaciones pendientes y no garantiza el stock de otras terminales.
Los conflictos se conservan para revisión; nunca se descartan automáticamente.
No desinstalar ni borrar los datos del equipo con operaciones por sincronizar.

**Requiere una APK nueva**, porque incorpora SQLite. No es una OTA compatible con 0.3.0.
Estado: validación técnica, aún pendiente aceptación física y firma definitiva del cliente.
Ver docs/ENTREGA.md.

## Preparar y ejecutar

Node 22 LTS. Instalar con `npm ci`, copiar `.env.example` a `.env` y configurar
las variables públicas del proyecto NUEVO. Nunca usar service_role en Expo.

```
npm run typecheck
npm test
npm start
```

El lector Honeywell se recibe como teclado con Enter. Debe probarse en las
terminales físicas Android 11/13. `npm run web` permite revisar la interfaz y
preparar paquetes desde una computadora durante desarrollo; hosting web pendiente.

## APK y actualizaciones

`eas.json` genera APK instalables fuera de Google Play. Antes de compilar:
1. Vincular este código con el proyecto real de Expo del cliente.
2. Configurar `EAS_PROJECT_ID` con el UUID real, sin inventarlo.
3. Configurar las variables de `.env.example` en el entorno preview de EAS.
4. Iniciar sesión en EAS o configurar `EXPO_TOKEN` para GitHub Actions.
5. Configurar credenciales de firma Android en EAS.

```
npx eas-cli build --platform android --profile preview
```

El workflow manual `APK Expo - manual` requiere los secretos/variables indicados.
El workflow Validate sí funciona sin Expo Token y no genera una APK.
Una exportación Metro no sustituye una compilación Android.

EAS Update está preparado condicionalmente para el UUID real de Expo. Después de
vincular y generar la APK, los cambios JS/assets compatibles pueden publicarse
con `eas update --channel preview --environment preview`. Cambios nativos,
permisos o SDK requieren otra APK. Mantener firma y package estables.
El UUID EAS debe verificarse y configurarse en GitHub antes de habilitar OTA. La APK descargable puede corresponder a una versión anterior hasta completar el nuevo build.

## Implementado para la primera revisión

- Consulta de solo lectura por QR/código, coincidencia exacta y sufijos finales.
- Registrar unidades, ubicación fila 1–13, posición A–R, nivel 1–7.
- Reacomodo sin cambio de cantidad. Salida por SKU con confirmación física.
- Pendientes desconocidos y administración del dueño mediante PIN del servidor.
- Guías con fecha, listas de preparación por paquete y marcado de preparación.
- Quitar una línea de preparación no descuenta existencias ni registra devolución.
- Historial reciente, guardado local durable y sincronización de movimientos offline.
- Pruebas de dominio para sufijos, cantidades, ubicaciones y paquetes 2 + 1.

Servicio Supabase implementado en `supabase/functions/inventory/index.ts`.
SQL versionado en database; no ejecutar contra la base anterior.
27,388 SKU en staging; 19,335 sin diferencias disponibles para consulta y
8,053 en revisión. No se ha migrado el stock físico. El catálogo/Excel del cliente
no se sube a este repositorio público. No contiene PIN ni claves privadas.

## Pendiente

Ver docs/REQUISITOS.md: etiquetas imprimibles/compartidas, reportes con filtros,
importación periódica y revisión de discrepancias, salida en lote de varios SKU,
pruebas reales Honeywell, enlace EAS y distribución final de APK.
PIN definitivo del dueño aún sin configurar. No existe un PIN por defecto.
Drive, hojas originales y Firebase anterior permanecen intactos.

## Validación de este avance

TypeScript sin errores; cinco pruebas de dominio aprobadas; dependencias
compatibles según Expo; exportación Android Metro/Hermes completada.
La compilación de la APK 0.4.0 y la prueba física de Honeywell deben verificarse antes de entregar.
