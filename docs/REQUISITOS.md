# ANDROMEDA 2.0 — registro de requisitos

Referencia: conversaciones y transcripciones aportadas por Yamileth y Alejandro.
La app anterior sirve solo como ejemplo; todo el desarrollo es nuevo.

## Confirmados
- Proyecto y repositorio independientes, propiedad del cliente.
- App activa: Expo/React Native; repositorio garzaalejandro/app_inventario.
- Android Honeywell 11/13; APK fuera de Play, actualizaciones desde la nube.
- Internet obligatorio; no confirmar movimientos sin respuesta del servidor.
- Acceso general sin usuario/contraseña. Solo dueño con PIN para administración,
  nombrar pendientes y mantener calidad del catálogo.
- Lectura por QR y código de barras con teclado/Enter; no confundir guía con SKU.
- Buscar exacto primero. Si no existe, candidato quitando solo sufijo final
  -S<n>(-V<n>)* sin distinguir mayúsculas en esos sufijos. Conservar guiones,
  puntos, barras y V0/V1 legítimos del SKU, así como lectura original.
- Cinco hojas A–E: 76,303 apariciones, 27,388 SKU distintos, 48,915 repeticiones.
  8,053 SKU tienen diferencias entre fuentes: no decidir silenciosamente.
- Importar catálogo no crea existencias. Stock actual requiere exportación propia.
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
3. Exportación autorizada de stock/ubicaciones actual si desea migrarla;
   nunca inferir cantidad a partir de repeticiones de catálogo.
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
