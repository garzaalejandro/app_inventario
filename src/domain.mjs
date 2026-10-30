export function baseCandidate(code) {
  return skuCandidates(code).at(-1) ?? String(code).trim();
}
// Prefer the scanned SKU exactly. Only then remove recognized trailing
// packaging segments, one at a time, so a real SKU ending in -S1 still wins.
export function skuCandidates(code) {
  const candidates = [String(code).trim()];
  while (/-[sv]\d+$/i.test(candidates.at(-1))) {
    candidates.push(candidates.at(-1).replace(/-[sv]\d+$/i, ''));
  }
  return [...new Set(candidates)];
}
export function resolveSku(code, catalog) {
  return skuCandidates(code).find(candidate => catalog.includes(candidate)) ?? null;
}
export function positiveUnits(value) {
  if (!/^\d+$/.test(String(value).trim())) throw new Error('Introduce unidades enteras positivas.');
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > 100000) throw new Error('Cantidad fuera de rango.');
  return n;
}
export function validateLocation(row, position, level) {
  if (!Number.isInteger(row) || row < 1 || row > 13 ||
      !/^[A-R]$/.test(position) || !Number.isInteger(level) || level < 1 || level > 7) {
    throw new Error('Ubicación inválida: fila 1–13, posición A–R y nivel 1–7.');
  }
  return { row, position, level };
}
export function packageTotals(lines) {
  const totals = new Map();
  for (const line of lines) {
    const n = positiveUnits(line.quantity);
    totals.set(line.sku, (totals.get(line.sku) ?? 0) + n);
  }
  return Object.fromEntries(totals);
}

// New scan and saved movement always start a fresh quantity of one.
export function intakeDefaults(stock) {
 return {units:'1',row:String(stock?.row_number??1),position:stock?.position??'A',level:String(stock?.level??1)};
}
export const warehouseRows=Array.from({length:13},(_,i)=>String(i+1));
export const warehousePositions=Array.from({length:18},(_,i)=>String.fromCharCode(65+i));
export const warehouseLevels=Array.from({length:7},(_,i)=>String(i+1));
export function validateInternalName(value) {
 const name=String(value).trim();if(name.length>120)throw new Error('El identificador admite hasta 120 caracteres.');return name;
}
export function userMessage(error) {
 const message=error instanceof Error?error.message:String(error);
 const known={
 'Insufficient stock':'No hay existencias suficientes en la nube. Revisa el movimiento con el dueño.',
 'Product has no stock location':'El producto todavía no tiene una ubicación registrada.',
 'Invalid operation':'El tipo de movimiento no es válido.',
 'Invalid units':'Introduce una cantidad entera positiva.',
 'Idempotency mismatch':'El identificador del movimiento se reutilizó con otros datos. Revisa el movimiento.',
 'JWT expired':'La conexión requiere actualizar las credenciales de la app.',
 'Invalid JWT':'La conexión requiere revisar las credenciales de la app.',
 };
 if(known[message])return known[message];
 if(/unique constraint|duplicate key/i.test(message))return 'Ese registro ya existe. Actualiza la lista antes de repetirlo.';
 if(/foreign key/i.test(message))return 'El producto o paquete aún no está disponible en la nube. Sincroniza y revisa el registro.';
 if(/SQLITE_FULL|disk is full/i.test(message))return 'El equipo no tiene espacio para guardar. No borres los datos de la app; libera espacio y vuelve a intentar.';
 if(/SQLITE|database is locked|database disk image/i.test(message))return 'No se pudo acceder a los datos locales. Conserva los datos de la app y comunica el error.';
 return message;
}
