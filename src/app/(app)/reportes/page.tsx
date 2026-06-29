"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, BarChart3, Download, Scale } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useCentro } from "@/context/CentroContext";
import { ChartDonut } from "@/components/dashboard/ChartDonut";
import { formatHNL } from "@/utils/currency";
import { formatFechaCorta } from "@/utils/dates";
import type { TransaccionConRelaciones } from "@/types/database";

export default function ReportesPage() {
  const { centroActivo } = useCentro();
  const supabase = createClient();
  const centroId = centroActivo?.id;

  const now = new Date();
  const [fechaInicio, setFechaInicio] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  );
  const [fechaFin, setFechaFin] = useState(
    now.toISOString().split("T")[0]
  );

  const { data: transacciones = [], isLoading } = useQuery({
    queryKey: ["reporte", centroId, fechaInicio, fechaFin],
    queryFn: async () => {
      if (!centroId) return [];
      const { data } = await supabase
        .from("transacciones")
        .select("*, servicios(id, nombre), categorias(id, nombre, tipo), pacientes(id, nombre_completo)")
        .eq("centro_id", centroId)
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin)
        .order("fecha", { ascending: false });
      return (data ?? []) as unknown as TransaccionConRelaciones[];
    },
    enabled: !!centroId,
  });

  const ingresos = transacciones.filter((t) => t.tipo === "ingreso");
  const egresos = transacciones.filter((t) => t.tipo === "egreso");
  const totalIngresos = ingresos.reduce((s, t) => s + t.monto, 0);
  const totalEgresos = egresos.reduce((s, t) => s + t.monto, 0);
  const balance = totalIngresos - totalEgresos;
  const kpiMaxValue = Math.max(totalIngresos, totalEgresos, Math.abs(balance), 1);

  // Desglose por método de pago (ingresos)
  const metodoPago = [
    {
      name: "Efectivo",
      value: ingresos.filter((t) => t.metodo_pago === "efectivo").reduce((s, t) => s + t.monto, 0),
      color: "oklch(0.72 0.20 145)",
    },
    {
      name: "Transferencia",
      value: ingresos.filter((t) => t.metodo_pago === "transferencia").reduce((s, t) => s + t.monto, 0),
      color: "oklch(0.60 0.18 165)",
    },
    {
      name: "Tarjeta",
      value: ingresos.filter((t) => t.metodo_pago === "tarjeta").reduce((s, t) => s + t.monto, 0),
      color: "oklch(0.78 0.16 85)",
    },
  ].filter((d) => d.value > 0);

  // Desglose por categoría (egresos)
  const categoriaEgresosMap: Record<string, number> = {};
  egresos.forEach((t) => {
    const cat = t.categorias?.nombre ?? "Otros";
    categoriaEgresosMap[cat] = (categoriaEgresosMap[cat] ?? 0) + t.monto;
  });

  const coloresEgreso = [
    "oklch(0.65 0.20 25)",
    "oklch(0.70 0.18 35)",
    "oklch(0.60 0.16 15)",
    "oklch(0.55 0.14 45)",
  ];

  const categoriaEgresos = Object.entries(categoriaEgresosMap).map(([name, value], i) => ({
    name,
    value,
    color: coloresEgreso[i % coloresEgreso.length],
  }));

  const exportCSV = () => {
    const headers = ["Fecha", "Tipo", "Categoría", "Detalle", "Método de Pago", "Paciente", "Monto (L)"];
    const rows = transacciones.map((t) => [
      formatFechaCorta(t.fecha),
      t.tipo,
      t.servicios?.nombre ?? t.categorias?.nombre ?? "",
      t.detalle ?? "",
      t.metodo_pago,
      t.pacientes?.nombre_completo ?? "",
      t.monto.toFixed(2),
    ]);

    const csv = [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alcheque-reporte-${fechaInicio}-${fechaFin}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Reporte AlCheque", 14, 20);
    doc.setFontSize(10);
    doc.text(`Período: ${formatFechaCorta(fechaInicio)} — ${formatFechaCorta(fechaFin)}`, 14, 28);
    doc.text(`Centro: ${centroActivo?.nombre ?? ""}`, 14, 34);

    // KPIs
    doc.setFontSize(12);
    doc.text(`Ingresos: ${formatHNL(totalIngresos)}`, 14, 44);
    doc.text(`Egresos: ${formatHNL(totalEgresos)}`, 14, 50);
    doc.text(`Balance: ${formatHNL(balance)}`, 14, 56);

    autoTable(doc, {
      startY: 65,
      head: [["Fecha", "Tipo", "Categoría", "Detalle", "Método", "Monto"]],
      body: transacciones.map((t) => [
        formatFechaCorta(t.fecha),
        t.tipo,
        t.servicios?.nombre ?? t.categorias?.nombre ?? "",
        t.detalle ?? "",
        t.metodo_pago,
        `L ${t.monto.toFixed(2)}`,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [34, 197, 94] },
    });

    doc.save(`alcheque-reporte-${fechaInicio}-${fechaFin}.pdf`);
  };

  return (
    <div className="page animate-fade-in-up">
      {/* Head */}
      <div className="page-head flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title text-3xl font-extrabold tracking-tight">Reportes</h1>
          <p className="page-sub text-sm text-[var(--text-muted)] mt-1">Análisis financiero del período seleccionado</p>
        </div>
        <div className="export-btns flex items-center gap-2">
          <button className="btn-ghost btn-pressable flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase" onClick={exportCSV} id="export-csv-btn">
            <Download size={14} />
            <span>CSV</span>
          </button>
          <button className="btn-ghost btn-pressable flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase" onClick={exportPDF} id="export-pdf-btn">
            <Download size={14} />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Filtros de fecha */}
      <div className="filters-card glass-card">
        <div className="filter-group">
          <label className="form-label" htmlFor="fecha-inicio">Desde</label>
          <input
            id="fecha-inicio"
            type="date"
            className="form-input"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label className="form-label" htmlFor="fecha-fin">Hasta</label>
          <input
            id="fecha-fin"
            type="date"
            className="form-input"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
          />
        </div>
        <div className="filter-quick">
          <span className="filter-label">Accesos rápidos:</span>
          {[
            { label: "Este mes", action: () => {
              const d = new Date();
              setFechaInicio(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`);
              setFechaFin(d.toISOString().split("T")[0]);
            }},
            { label: "Mes anterior", action: () => {
              const d = new Date();
              d.setMonth(d.getMonth()-1);
              const y = d.getFullYear(), m = d.getMonth()+1;
              const daysInMonth = new Date(y, m, 0).getDate();
              setFechaInicio(`${y}-${String(m).padStart(2,"0")}-01`);
              setFechaFin(`${y}-${String(m).padStart(2,"0")}-${String(daysInMonth).padStart(2,"0")}`);
            }},
            { label: "Este año", action: () => {
              const y = new Date().getFullYear();
              setFechaInicio(`${y}-01-01`);
              setFechaFin(`${y}-12-31`);
            }},
          ].map((q) => (
            <button key={q.label} className="quick-btn btn-pressable" onClick={q.action}>
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-row grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: "Ingresos",
            value: totalIngresos,
            color: "var(--accent)",
            tone: "green",
            icon: ArrowUpRight,
            count: ingresos.length,
            helper: "Entradas registradas",
          },
          {
            label: "Egresos",
            value: totalEgresos,
            color: "var(--red)",
            tone: "red",
            icon: ArrowDownRight,
            count: egresos.length,
            helper: "Salidas registradas",
          },
          {
            label: "Balance neto",
            value: balance,
            color: balance >= 0 ? "var(--accent)" : "var(--red)",
            tone: balance >= 0 ? "green" : "red",
            icon: Scale,
            count: transacciones.length,
            helper: balance >= 0 ? "Resultado positivo" : "Resultado por cubrir",
          },
        ].map((k, i) => (
          <motion.div
            key={k.label}
            className={`kpi-mini kpi-mini-${k.tone}`}
            style={{
              "--card-accent-color": k.color,
              "--kpi-fill": `${Math.max(8, Math.round((Math.abs(k.value) / kpiMaxValue) * 100))}%`,
            } as CSSProperties}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <div className="kpi-mini-head">
              <span className="kpi-mini-label">{k.label}</span>
              <span className="kpi-mini-icon" aria-hidden="true">
                <k.icon size={18} strokeWidth={2.3} />
              </span>
            </div>
            <span className="kpi-mini-value" style={{ color: k.color }}>
              {formatHNL(k.value)}
            </span>
            <div className="kpi-mini-foot">
              <span>{k.count} transacciones</span>
              <span>{k.helper}</span>
            </div>
            <span className="kpi-mini-meter" aria-hidden="true" />
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      {metodoPago.length > 0 || categoriaEgresos.length > 0 ? (
        <div className="charts-row">
          {metodoPago.length > 0 && (
            <ChartDonut
              data={metodoPago}
              title="Ingresos por método de pago"
              total={totalIngresos}
            />
          )}
          {categoriaEgresos.length > 0 && (
            <ChartDonut
              data={categoriaEgresos}
              title="Egresos por categoría"
              total={totalEgresos}
            />
          )}
        </div>
      ) : null}

      {/* Tabla completa */}
      <div className="table-card glass-card">
        <div className="directory-header flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-[var(--border)] mb-4">
          <div className="flex items-center gap-2">
            <h2 className="directory-title text-base font-extrabold tracking-tight">Detalle de Transacciones</h2>
            <span className="badge badge-muted text-[10px] font-bold">
              {transacciones.length} registros
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="loading-rows px-4 pb-4">
            {[1,2,3,4,5].map((i) => <div key={i} className="skeleton-row" />)}
          </div>
        ) : transacciones.length === 0 ? (
          <div className="empty">
            <BarChart3 size={28} style={{ color: "var(--text-subtle)", opacity: 0.5 }} />
            <p>No hay transacciones en este período</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Categoría</th>
                  <th>Detalle</th>
                  <th>Método</th>
                  <th>Paciente</th>
                  <th style={{ textAlign: "right" }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {transacciones.map((t) => (
                  <tr key={t.id}>
                    <td><span className="mono font-semibold">{formatFechaCorta(t.fecha)}</span></td>
                    <td>
                      <span className={`badge ${t.tipo === "ingreso" ? "badge-green" : "badge-red"}`}>
                        {t.tipo === "ingreso" ? "↑ Ingreso" : "↓ Egreso"}
                      </span>
                    </td>
                    <td><span className="text-sm font-medium">{t.servicios?.nombre ?? t.categorias?.nombre ?? "—"}</span></td>
                    <td><span className="text-sm text-[var(--text-muted)]">{t.detalle ?? "—"}</span></td>
                    <td><span className="badge badge-muted capitalize">{t.metodo_pago}</span></td>
                    <td><span className="text-sm font-medium">{t.pacientes?.nombre_completo ?? "—"}</span></td>
                    <td style={{ textAlign: "right" }}>
                      <span className="mono font-bold text-sm" style={{ color: t.tipo === "ingreso" ? "var(--accent)" : "var(--red)" }}>
                        {t.tipo === "ingreso" ? "+" : "-"}{formatHNL(t.monto)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="table-foot">
                  <td colSpan={6} style={{ textAlign: "right", fontWeight: 700, color: "var(--text-muted)" }}>
                    Balance del período:
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span className="mono font-extrabold text-sm" style={{ color: balance >= 0 ? "var(--accent)" : "var(--red)" }}>
                      {balance >= 0 ? "+" : ""}{formatHNL(balance)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .page { display: flex; flex-direction: column; gap: 1.5rem; max-width: 1600px; }
        .page-title { color: var(--text); letter-spacing: -0.025em; }

        .btn-ghost {
          background: var(--bg-subtle); color: var(--text-muted);
          border: 1px solid var(--border); border-radius: 8px;
          cursor: pointer; font-family: var(--font-sans);
          transition: background 150ms, color 150ms, transform 160ms var(--ease-out);
        }
        .btn-ghost:hover { background: var(--surface-hover); color: var(--text); border-color: var(--border-strong); }

        .filters-card {
          display: flex; align-items: flex-end; gap: 1.25rem; flex-wrap: wrap;
        }
        .filter-group { display: flex; flex-direction: column; flex: 1; min-width: 200px; }
        .filter-quick { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem; width: 100%; }
        .filter-label { font-size: 0.75rem; font-family: var(--font-mono); font-weight: 700; color: var(--text-subtle); text-transform: uppercase; letter-spacing: 0.05em; }
        .quick-btn {
          padding: 0.375rem 0.75rem; border-radius: 99px; border: 1px solid var(--border);
          background: var(--bg-subtle); font-size: 0.75rem; font-weight: 600; color: var(--text-muted);
          cursor: pointer; font-family: var(--font-sans);
          transition: all 150ms var(--ease-out);
        }
        .quick-btn:hover { background: var(--accent-muted); color: var(--accent); border-color: var(--accent); }

        :global(.kpi-mini) {
          background:
            radial-gradient(circle at top right, color-mix(in srgb, var(--card-accent-color) 18%, transparent), transparent 48%),
            linear-gradient(145deg, rgba(23, 31, 51, 0.92), rgba(13, 21, 39, 0.72));
          backdrop-filter: blur(20px);
          border: 1px solid color-mix(in srgb, var(--card-accent-color) 28%, rgba(255, 255, 255, 0.08));
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.06);
          border-radius: 22px;
          padding: 1.15rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          position: relative;
          overflow: hidden;
          min-height: 156px;
        }
        :global([data-theme="light"] .kpi-mini) {
          background:
            radial-gradient(circle at top right, color-mix(in srgb, var(--card-accent-color) 12%, transparent), transparent 48%),
            linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(246, 250, 247, 0.84));
          border: 1px solid color-mix(in srgb, var(--card-accent-color) 20%, rgba(0, 0, 0, 0.07));
          box-shadow: 0 16px 36px rgba(15, 28, 19, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        :global(.kpi-mini)::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(135deg, rgba(255,255,255,0.12), transparent 38%);
          opacity: 0.55;
        }

        :global(.kpi-mini)::after {
          content: "";
          position: absolute;
          left: 1.15rem;
          right: 1.15rem;
          bottom: 1rem;
          height: 4px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.08);
        }

        :global(.kpi-mini-head),
        :global(.kpi-mini-foot),
        :global(.kpi-mini-value),
        :global(.kpi-mini-meter) {
          position: relative;
          z-index: 1;
        }

        :global(.kpi-mini-head) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        :global(.kpi-mini-label) {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        :global(.kpi-mini-icon) {
          width: 2.25rem;
          height: 2.25rem;
          display: grid;
          place-items: center;
          border-radius: 14px;
          color: var(--card-accent-color);
          background: color-mix(in srgb, var(--card-accent-color) 14%, transparent);
          border: 1px solid color-mix(in srgb, var(--card-accent-color) 22%, transparent);
        }

        :global(.kpi-mini-value) {
          font-size: clamp(1.55rem, 2.4vw, 2.15rem);
          font-weight: 800;
          letter-spacing: -0.055em;
          line-height: 1;
          font-family: var(--font-mono);
          text-shadow: 0 0 18px color-mix(in srgb, var(--card-accent-color) 18%, transparent);
        }

        :global(.kpi-mini-foot) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-top: auto;
          padding-bottom: 0.9rem;
          font-size: 0.72rem;
          color: var(--text-subtle);
        }

        :global(.kpi-mini-foot) span:first-child {
          color: var(--text-muted);
          font-weight: 700;
        }

        :global(.kpi-mini-meter) {
          position: absolute;
          left: 1.15rem;
          bottom: 1rem;
          width: var(--kpi-fill);
          max-width: calc(100% - 2.3rem);
          height: 4px;
          background: var(--card-accent-color, var(--accent));
          border-radius: 99px;
          box-shadow: 0 0 18px color-mix(in srgb, var(--card-accent-color) 45%, transparent);
        }
        .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        
        .table-card { padding: 0; overflow: hidden; }
        .directory-header {
          padding: 1.25rem 1.25rem 0;
          border-bottom: none;
        }
        .table-foot td { padding: 1rem 1.25rem; background: var(--bg-subtle); border-top: 2px solid var(--border); }
        
        .loading-rows { display: flex; flex-direction: column; gap: 4px; }
        .skeleton-row { height: 44px; background: var(--bg-subtle); border-radius: 6px; animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; padding: 4rem 2rem; color: var(--text-muted); font-size: 0.875rem; }
        .mono { font-family: var(--font-mono); }
        @media (max-width: 900px) { .charts-row { grid-template-columns: 1fr; } }
        @media (max-width: 640px) {
          :global(.kpi-mini) { min-height: 148px; }
          :global(.kpi-mini-foot) { align-items: flex-start; flex-direction: column; gap: 0.25rem; }
        }
      `}</style>
    </div>
  );
}
