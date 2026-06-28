"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, AlertCircle, Plus } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useCentro } from "@/context/CentroContext";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ChartDonut } from "@/components/dashboard/ChartDonut";
import { ChartBar } from "@/components/dashboard/ChartBar";
import { Pagination, usePagination } from "@/components/shared/Pagination";
import { formatFechaCorta, ultimosMeses } from "@/utils/dates";
import type { Transaccion, PacienteConPlan } from "@/types/database";
import { motion } from "framer-motion";

export default function DashboardPage() {
  const { centroActivo } = useCentro();
  const supabase = createClient();
  const centroId = centroActivo?.id;

  // Transacciones del mes actual
  const now = new Date();
  const año = now.getFullYear();
  const mes = now.getMonth(); // 0-indexed
  const mesActual = `${año}-${String(mes + 1).padStart(2, "0")}`;
  const primerDia = `${mesActual}-01`;
  const ultimoDiaFecha = new Date(año, mes + 1, 0);
  const ultimoDia = `${mesActual}-${String(ultimoDiaFecha.getDate()).padStart(2, "0")}`;

  const { data: transaccionesMes = [] } = useQuery({
    queryKey: ["transacciones-mes", centroId, mesActual],
    queryFn: async () => {
      if (!centroId) return [];
      const { data } = await supabase
        .from("transacciones")
        .select("*")
        .eq("centro_id", centroId)
        .gte("fecha", primerDia)
        .lte("fecha", ultimoDia);
      return (data ?? []) as Transaccion[];
    },
    enabled: !!centroId,
  });

  const { data: pacientesActivos = [] } = useQuery({
    queryKey: ["pacientes-activos", centroId],
    queryFn: async () => {
      if (!centroId) return [];
      const { data } = await supabase
        .from("pacientes")
        .select("*, servicios(id, nombre, precio)")
        .eq("centro_id", centroId)
        .eq("estado_mensualidad", true)
        .eq("estado_suscripcion", "activo")
        .is("deleted_at", null)
        .order("nombre_completo");
      return (data ?? []) as unknown as PacienteConPlan[];
    },
    enabled: !!centroId,
  });

  const pacientesActivosPagination = usePagination({
    items: pacientesActivos,
    storageKey: "pagination:dashboard-pacientes-activos",
    resetKey: centroId ?? "",
  });

  const { data: chartData = [] } = useQuery({
    queryKey: ["chart-mensual", centroId],
    queryFn: async () => {
      if (!centroId) return [];
      const meses = ultimosMeses(6);
      const results = await Promise.all(
        meses.map(async ({ año, mes, etiqueta }) => {
          const inicio = `${año}-${String(mes).padStart(2, "0")}-01`;
          const fin = new Date(año, mes, 0);
          const finStr = fin.toISOString().split("T")[0];

          const { data } = await supabase
            .from("transacciones")
            .select("tipo, monto")
            .eq("centro_id", centroId)
            .gte("fecha", inicio)
            .lte("fecha", finStr);

          const t = data ?? [];
          return {
            mes: etiqueta,
            ingresos: t.filter((x) => x.tipo === "ingreso").reduce((s, x) => s + x.monto, 0),
            egresos: t.filter((x) => x.tipo === "egreso").reduce((s, x) => s + x.monto, 0),
          };
        })
      );
      return results;
    },
    enabled: !!centroId,
  });

  // KPI calculations
  const totalIngresos = transaccionesMes
    .filter((t) => t.tipo === "ingreso")
    .reduce((s, t) => s + t.monto, 0);

  const totalEgresos = transaccionesMes
    .filter((t) => t.tipo === "egreso")
    .reduce((s, t) => s + t.monto, 0);

  const balance = totalIngresos - totalEgresos;

  // Desglose por método de pago
  const metodoPagoData = [
    {
      name: "Efectivo",
      value: transaccionesMes
        .filter((t) => t.tipo === "ingreso" && t.metodo_pago === "efectivo")
        .reduce((s, t) => s + t.monto, 0),
      color: "oklch(0.72 0.20 145)",
    },
    {
      name: "Transferencia",
      value: transaccionesMes
        .filter((t) => t.tipo === "ingreso" && t.metodo_pago === "transferencia")
        .reduce((s, t) => s + t.monto, 0),
      color: "oklch(0.60 0.18 165)",
    },
    {
      name: "Tarjeta",
      value: transaccionesMes
        .filter((t) => t.tipo === "ingreso" && t.metodo_pago === "tarjeta")
        .reduce((s, t) => s + t.monto, 0),
      color: "oklch(0.78 0.16 85)",
    },
  ].filter((d) => d.value > 0);

  if (!centroActivo) {
    return (
      <div className="no-centro">
        <p>Selecciona o crea un centro para ver el dashboard.</p>
        <Link href="/centros/nuevo" className="btn-accent">
          Crear centro
        </Link>
        <style jsx>{`
          .no-centro {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            height: 60vh;
            color: var(--text-muted);
          }
          .btn-accent {
            background: var(--accent);
            color: var(--accent-fg);
            padding: 0.625rem 1.25rem;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="dashboard animate-fade-in-up">
      {/* Page title */}
      <motion.div
        className="page-header flex items-center justify-between flex-wrap gap-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <h1 className="page-title text-3xl font-extrabold tracking-tight">Visión General</h1>
          <p className="page-sub text-sm text-[var(--text-muted)] mt-1">Tu salud financiera de un vistazo.</p>
        </div>
        <Link
          href="/transacciones?new=true"
          className="btn-primary btn-pressable flex items-center gap-1 px-4 py-2.5 h-10 rounded-xl font-bold text-sm tracking-wider uppercase"
        >
          <Plus size={15} strokeWidth={3} />
          <span>Nuevo Ingreso</span>
        </Link>
      </motion.div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        <KpiCard
          title="Ingresos del mes"
          value={totalIngresos}
          variant="income"
          index={0}
          subtitle={`${transaccionesMes.filter((t) => t.tipo === "ingreso").length} transacciones`}
        />
        <KpiCard
          title="Egresos del mes"
          value={totalEgresos}
          variant="expense"
          index={1}
          subtitle={`${transaccionesMes.filter((t) => t.tipo === "egreso").length} transacciones`}
        />
        <KpiCard
          title="Balance neto"
          value={balance}
          variant={balance >= 0 ? "income" : "expense"}
          index={2}
          subtitle="Ingresos − Egresos"
        />
        <KpiCard
          title="Pacientes activos"
          value={pacientesActivos.length}
          variant="neutral"
          index={3}
          format={(n) => Math.round(n).toString()}
          subtitle="Con mensualidad vigente"
        />
      </div>

      {/* Charts row */}
      <div className="charts-grid">
        <ChartBar data={chartData} title="Ingresos vs Egresos (últimos 6 meses)" />
        {metodoPagoData.length > 0 ? (
          <ChartDonut
            data={metodoPagoData}
            title="Ingresos por método de pago"
            subtitle="Mes actual"
            total={totalIngresos}
          />
        ) : (
          <div className="empty-chart glass-card">
            <AlertCircle size={24} style={{ color: "var(--text-subtle)" }} />
            <p>Sin datos de ingresos este mes</p>
          </div>
        )}
      </div>

      {/* Pacientes activos table */}
      <motion.div
        className="patients-section glass-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="section-header">
          <div className="section-title-group">
            <Users size={16} style={{ color: "var(--accent)" }} />
            <h2 className="section-title">Pacientes con mensualidad activa</h2>
          </div>
          <Link href="/pacientes" className="section-link btn-primary btn-pressable flex items-center gap-1 px-4 py-2.5 h-10 rounded-xl font-bold text-sm tracking-wider uppercase">
            Ver todos
          </Link>
        </div>

        {pacientesActivos.length === 0 ? (
          <div className="table-empty">
            <Users size={28} style={{ color: "var(--text-subtle)", opacity: 0.6 }} />
            <p>No hay pacientes con mensualidad activa</p>
          </div>
        ) : (
          <div className="table-responsive mt-3">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Fecha ingreso</th>
                </tr>
              </thead>
              <tbody>
                {pacientesActivosPagination.paginatedItems.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/pacientes/${p.id}`} className="patient-link">
                        {p.nombre_completo}
                      </Link>
                    </td>
                    <td>
                      <span className="plan-text">
                        {p.servicios?.nombre ?? "—"}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-green">Activo</span>
                    </td>
                    <td>
                      <span className="date-text">
                        {formatFechaCorta(p.fecha_ingreso)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              totalItems={pacientesActivos.length}
              page={pacientesActivosPagination.page}
              pageSize={pacientesActivosPagination.pageSize}
              totalPages={pacientesActivosPagination.totalPages}
              itemLabel="pacientes"
              onPageChange={pacientesActivosPagination.setPage}
              onPageSizeChange={pacientesActivosPagination.setPageSize}
            />
          </div>
        )}
      </motion.div>

      <style jsx>{`
        .dashboard {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          max-width: 1600px;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 1rem;
        }

        .empty-chart {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 2rem;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        .patients-section {
          overflow: hidden;
          padding: 0;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem;
          border-bottom: 1px solid var(--border);
        }

        .section-title-group {
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }

        .section-title {
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--text);
          margin: 0;
          letter-spacing: -0.01em;
        }

        .section-link {
          font-size: 0.8125rem;
          color: var(--accent);
          text-decoration: none;
          font-weight: 600;
          transition: color 150ms var(--ease-out);
        }

        .section-link:hover { color: var(--accent-hover); }

        .table-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.625rem;
          padding: 3rem;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        .patient-link {
          color: var(--text);
          text-decoration: none;
          font-weight: 600;
          transition: color 150ms var(--ease-out);
        }

        .patient-link:hover { color: var(--accent); }

        .plan-text {
          font-size: 0.8125rem;
          color: var(--text-muted);
        }

        .date-text {
          font-size: 0.8125rem;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        /* Responsive */
        @media (max-width: 1200px) {
          .charts-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 900px) {
          .kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 480px) {
          .kpi-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
