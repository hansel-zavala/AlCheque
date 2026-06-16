import { format, formatDistanceToNow, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Formatea una fecha ISO a formato legible en español
 * Ej: "2024-01-15" → "15 de enero de 2024"
 */
export function formatFecha(date: string | Date): string {
  const parsed = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(parsed)) return "Fecha inválida";
  return format(parsed, "d 'de' MMMM 'de' yyyy", { locale: es });
}

/**
 * Formatea fecha corta
 * Ej: "2024-01-15" → "15/01/2024"
 */
export function formatFechaCorta(date: string | Date): string {
  const parsed = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(parsed)) return "";
  return format(parsed, "dd/MM/yyyy");
}

/**
 * Formatea fecha para inputs type="date"
 * Ej: Date → "2024-01-15"
 */
export function formatFechaInput(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Tiempo relativo en español
 * Ej: "hace 3 días"
 */
export function timeAgo(date: string | Date): string {
  const parsed = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(parsed)) return "";
  return formatDistanceToNow(parsed, { locale: es, addSuffix: true });
}

/**
 * Nombre del mes en español
 * Ej: 0 → "Enero"
 */
export function nombreMes(monthIndex: number): string {
  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  return meses[monthIndex] ?? "";
}

/**
 * Genera un array de los últimos N meses
 */
export function ultimosMeses(n: number): Array<{ año: number; mes: number; etiqueta: string }> {
  const result = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      año: d.getFullYear(),
      mes: d.getMonth() + 1,
      etiqueta: format(d, "MMM yyyy", { locale: es }),
    });
  }
  return result;
}

/**
 * Verifica si un pago está vencido (más de 30 días sin pagar)
 */
export function pagoVencido(ultimaFechaPago: string | null): boolean {
  if (!ultimaFechaPago) return true;
  const parsed = parseISO(ultimaFechaPago);
  if (!isValid(parsed)) return true;
  const diasDesde = Math.floor(
    (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diasDesde > 30;
}
