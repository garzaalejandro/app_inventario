# Estado de entrega 0.4.0

No etiquetar como producción aprobada sin completar los puntos siguientes.

## Cambios comprobados
- SQLite con transacciones y cola persistente que sobrevive a reinicios.
- Descarga completa del catálogo mediante paginación, reemplazo atómico.
- Entradas, salidas y reacomodos con control de cantidades local y validación del servidor.
- Guías, desconocidos y paquetes persistidos para envío posterior.
- Replay de comandos con un identificador único y comprobación de payload.
- Rechazos del servidor conservados como conflictos, sin descarte automático.
- Catálogo de 27,388 SKU; los datos discordantes permanecen en revisión.
- Diez pruebas automatizadas y comprobación TypeScript. Export Android realizada.

## Antes de la primera operación
Instalar APK 0.4.0, conectar Wi-Fi y Sincronizar. Esperar la descarga completa.
Desactivar Internet solo cuando aparezca catálogo disponible y fecha de sincronización.
Confirmaciones indican guardado local; revisar contador de operaciones pendientes.
Sincronizar antes y después de cada turno. No borrar datos ni desinstalar con cola pendiente.
Los equipos desconectados no conocen cambios del otro; un despacho puede generar conflicto global.
El dueño debe conciliar los movimientos físicos y la existencia real antes de reintentar un conflicto.
El panel de dueño necesita conexión y un PIN configurado por vía protegida; no hay PIN por defecto.

## Aceptación en los dos Honeywell CT60
1. Barras y QR reales, SKU exacto y sufijos S1/S2/S4 y V01/V02.
2. Escaneo con Enter automático; guías consecutivas sin duplicación.
3. Modo avión: ingreso 3, salida 2, consulta 1; reubicar sin cambiar cantidad.
4. Cerrar/reabrir: comprobar cola y cantidad local; reconectar: confirmar una sola aplicación.
5. Dos terminales compiten por la última unidad: comprobar rechazo conservado, nunca stock negativo.
6. Paquetes 2 + 1 y guías no alteran existencias; PIN solo dueño.
7. Actualización instalada sobre la anterior conserva base y cola.

## Bloqueos para una entrega definitiva
- Verificar la compilación nativa de 0.4.0 y ejecutar aceptación física en Android 11/13.
- Configurar y custodiar firma Android definitiva del cliente; el workflow actual tiene firma de prueba.
- Confirmar UUID EAS y publicar una actualización compatible de prueba; comprobarla en los terminales.
- Configurar PIN privado del dueño sin incluirlo en código/README.
- Completar etiquetas imprimibles/compartidas, reportes por fecha/exportación, y revisión administrativa de los 8,053 registros discordantes.
- Preparación web requiere conexión; almacenamiento offline implementado para Android.

No se ha modificado Drive ni Firebase anterior. Las pruebas SQL de existencias usan ROLLBACK.
