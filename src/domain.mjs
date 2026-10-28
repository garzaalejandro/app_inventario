export function baseCandidate(code) {
  return String(code).trim().replace(/-s\d+(?:-v\d+)*$/i, '');
}
export function resolveSku(code, catalog) {
  const raw = String(code).trim();
  if (catalog.includes(raw)) return raw;
  const candidate = baseCandidate(raw);
  return catalog.includes(candidate) ? candidate : null;
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
