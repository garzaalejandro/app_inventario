# ANDROMEDA 2.0 — registro de requisitos

Referencia: conversaciones y transcripciones aportadas por Yamileth y Alejandro.
La app anterior sirve solo como ejemplo; todo el desarrollo es nuevo.

## Confirmados
- Proyecto y repositorio independientes, propiedad del cliente.
- App activa: Expo/React Native; repositorio garzaalejandro/app_inventario.
- Android Honeywell 11/13; APK fuera de Play, actualizaciones desde la nube.
- Debe trabajar sin Internet después de descargar el catálogo; en modo sin conexión,
  guardar movimientos en el equipo y sincronizarlos al recuperar conexión.
- Acceso general sin usuario/contraseña. Solo dueño con PIN para administración,
  nombrar pendientes y mantener calidad del catálogo.
- Lectura por QR y código de barras con teclado/Enter; no confundir guía con SKU.
- Buscar el código completo primero para preservar SKU que incluyen `-S1` u otros
  sufijos legítimos. Si no existe, retirar de derecha a izquierda los segmentos
  finales reconocidos `-S<n>` y `-V<n>` (por ejemplo, `...-S1-V01` prueba primero
  `...-S1` y después el SKU base). No cortar guiones internos arbitrarios ni
  modificar el SKU guardado o el código original del escaneo.
- Cinco hojas A–E: 76,303 apariciones, 27,388 SKU distintos, 48,915 repeticiones.
  8,053 SKU tienen diferencias entre fuentes: no decidir silenciosamente.
- Importar catálogo no crea existencias. Inicio con stock cero, sin migrar existencias anteriores; el dueño registrará manualmente los ingresos físicos.
- Productos: alta de unidades configurable, identificación interna opcional en
  español, descripción original, ubicación única por SKU.
- Ubicación: un almacén, fila 1–13, posición A–R, nivel 1–7.
- Consulta solo lectura: SKU, descripción, identificador, ubicación, cantidad.
- Desconocidos a Pendientes; dueño asigna descripción y genera etiqueta Code128
  compartible/imprimible. Evitar duplicados y confirmar guardado.
- Guías: una o varias, fecha actual o anterior, historial; no incrementan stock.
- Reacomodo traslada todas las unidades sin cambiar cantidad y guarda historial.
- Preparación desde computadora: lista SKU/cantidad y paquetes separados 2 + 1.
  Localizar/preparar nunca descuenta stock. Quitar una caja no genera devolución.
- No módulo de cancelaciones. Despacho confirmado en Salidas es definitivo.
- Salidas: solo aquí se descuenta; cantidades positivas, stock no negativo,
  idempotencia y operación atómica con historial.
- Actualizar APK manteniendo applicationId/firma; instalación con autorización
  Android cuando corresponda, sin prometer actualización silenciosa.
- Drive, hojas originales y Firebase anterior no se modifican.

## Pendientes para preguntar después, sin frenar la primera prueba
1. Modelos exactos de terminales y ajustes del lector (sufijo Enter).
2. Reglas para elegir descripción/peso en los 8,053 SKU con diferencias.
3. Validar con el dueño la primera entrada manual y su ubicación; no solicitar migración del stock anterior.
4. Contenido y tamaño de etiqueta, impresora y si conserva el código original.
5. Reportes: columnas, rangos de fechas y formato de descarga.
6. Identificación de paquete/pedido y cómo limpiar la lista preparada.
7. PIN definitivo del dueño mediante configuración protegida, no en el código.
8. Logo/nombre final y distribución del enlace APK.

## Prueba de aceptación
Escanear exacto y con sufijo; código desconocido; sumar 1 + 2 = 3; localizar;
consultar sin editar; reubicar sin cambiar stock; preparar 2 + 1 sin descontar;
salida y reintento sin doble descuento; dos terminales compitiendo por última
unidad; apagar Internet y verificar que no confirme ninguna operación.

## Alta de productos desde Google Sheets (dueño)

1. En la computadora, abre la pestaña `unique` y selecciona únicamente las columnas A:C (SKU, descripción y peso) de las filas nuevas debajo del rótulo de productos nuevos.
2. En ANDROMEDA, entra a **Dueño** e inicia sesión con el PIN del dueño.
3. Pega las filas copiadas en **Agregar productos nuevos desde Google Sheets** y pulsa **Importar productos nuevos**.
4. La app informa cuántos SKU se agregaron, cuántos ya existían y cuántas filas se omitieron; después sincroniza el catálogo.

La importación requiere Internet y el PIN del dueño. Solo inserta SKU inexistentes: no sobrescribe descripciones, identificadores, existencias ni ubicaciones. El catálogo se actualiza al sincronizar los dispositivos.
