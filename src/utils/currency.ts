/**
 * Formatea un número como moneda HNL (Lempira hondureño)
 * Ej: 1250.5 → "L 1,250.50"
 */
export function formatHNL(amount: number): string {
  return new Intl.NumberFormat("es-HN", {
    style: "currency",
    currency: "HNL",
    currencyDisplay: "symbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace("HNL", "L");
}

/**
 * Formatea solo el número con separadores (sin símbolo)
 * Ej: 1250.5 → "1,250.50"
 */
export function formatNumber(amount: number): string {
  return new Intl.NumberFormat("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Parsea un string numérico al número (limpia comas y espacios)
 */
export function parseAmount(value: string): number {
  return parseFloat(value.replace(/,/g, "")) || 0;
}

/**
 * Formatea un monto como diferencia (+/-)
 */
export function formatDiff(amount: number): string {
  const prefix = amount >= 0 ? "+" : "";
  return `${prefix}${formatHNL(amount)}`;
}
