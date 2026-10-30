# ANDROMEDA 2.0

### 📲 APK para Android · versión 0.4.2

## [⬇️ Descargar ANDROMEDA 2.0](https://github.com/garzaalejandro/app_inventario/releases/download/apk-prueba/ANDROMEDA-prueba.apk)

[Ver lanzamientos](https://github.com/garzaalejandro/app_inventario/releases/tag/apk-prueba) · [Ver compilación en GitHub Actions](https://github.com/garzaalejandro/app_inventario/actions/runs/40999581671)

Aplicación nueva de almacén en Expo, React Native y TypeScript, con Supabase.
La app Flutter anterior solo se tomó como referencia. No se modifica el Drive,
el inventario anterior ni Firebase.

## Descargar la APK

La APK se instala directamente en los Honeywell; no requiere Google Play. Esta
es una compilación de prueba con firma de prueba.

## Ejecutar en desarrollo

Requiere Node 22. Crear `.env` a partir de `.env.example` con la URL de Supabase
y su clave pública `anon`. Nunca incluir `service_role` en Expo ni en el APK.

```sh
npm ci
npm run typecheck
npm test
npm start
```

## Catálogo y coincidencia de códigos

Primero se busca el código escaneado completo. Si no existe, se prueban los
sufijos finales de empaque `-S1`, `-S4`, `-V01` y sus combinaciones, quitando
uno por vez desde el final. Un SKU exacto que termina en `-S1` conserva prioridad.
No se modifican el SKU del catálogo ni el código original del escaneo.
En **Consultar** también se puede buscar por palabras del nombre o por SKU dentro
del catálogo descargado, aunque el producto todavía no tenga existencias.

## Operación

- Interfaz en español; identificador interno editable por cualquier trabajador.
- El PIN del dueño solo protege la administración de productos desconocidos.
- Catálogo y existencias se descargan para permitir consulta y captura sin
  Internet. Las operaciones se guardan en el equipo y se sincronizan al volver
  la conexión; la app muestra pendientes y conserva conflictos para revisión.
- Las entradas inician en una unidad y permiten seleccionar fila 1–13,
  posición A–R y nivel 1–7. El stock no se migró; el dueño dará entrada física.
- Preparar paquetes no descuenta. Solo la salida confirmada modifica existencias.

## Estado y pendientes

El catálogo contiene 27,388 SKU; 8,053 conservan diferencias entre hojas y
requieren revisión. El archivo de inventario no está publicado en este repositorio.
Ver [requisitos](docs/REQUISITOS.md) y [estado de entrega](docs/ENTREGA.md).

La APK es una versión de revisión, no una entrega de producción firmada. Falta
configurar la firma definitiva, el PIN del dueño y terminar la aceptación física
en los dos terminales Honeywell. EAS Update requiere verificar el UUID y probar
una actualización en los dispositivos.
