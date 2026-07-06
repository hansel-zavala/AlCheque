"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CircleDollarSign, ClipboardList, Plus, Users } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useCentro } from "@/context/CentroContext";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { formatHNL } from "@/utils/currency";
import { formatFechaCorta } from "@/utils/dates";
import type { PacienteConPlan, TransaccionConRelaciones } from "@/types/database";

type EstadoPago = "pagado" | "parcial" | "pendiente";

type PacienteIngreso = {
  id: string;
  nombre: string;
  plan: string;
  esperado: number;
  pagado: number;
  pendiente: number;
  estado: EstadoPago;
  ultimoPago: string | null;
};

const ESTADO_LABEL: Record<EstadoPago, string> = {
  pagado: "Pagado",
  parcial: "Parcial",
  pendiente: "Pendiente",
};

const ESTADO_BADGE: Record<EstadoPago, string> = {
  pagado: "badge-green",
  parcial: "badge-amber",
  pendiente: "badge-red",
};

function getCurrentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

function getPeriodRange(periodo: string) {
  const [year, month] = periodo.split("-").map(Number);
  const firstDay = `${periodo}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  return {
    firstDay,
    lastDay: `${periodo}-${String(lastDay).padStart(2, "0")}`,
  };
}

function formatPeriodo(periodo: string) {
  const [year, month] = periodo.split("-").map(Number);
  return new Intl.DateTimeFormat("es-HN", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1)
  );
}

function getEstadoPago(pagado: number, esperado: number): EstadoPago {
  if (pagado >= esperado && esperado > 0) return "pagado";
  if (pagado > 0) return "parcial";
  return "pendiente";
}

export default function IngresosClinicosPage() {
  const { centroActivo } = useCentro();
  const supabase = createClient();
  const centroId = centroActivo?.id;
  const [periodo, setPeriodo] = useState(getCurrentPeriod());
  const { firstDay, lastDay } = getPeriodRange(periodo);

  const { data: pacientesActivos = [], isLoading: loadingPacientes } = useQuery({
    queryKey: ["ingresos-clinicos-pacientes", centroId],
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

  const { data: pagosMensualidad = [], isLoading: loadingPagos } = useQuery({
    queryKey: ["ingresos-clinicos-pagos", centroId, periodo],
    queryFn: async () => {
      if (!centroId) return [];
      const { data } = await supabase
        .from("transacciones")
        .select("*, servicios(id,nombre,servicio,categoria_id), pacientes(id,nombre_completo)")
        .eq("centro_id", centroId)
        .eq("tipo", "ingreso")
        .eq("periodo_pago", periodo)
        .is("deleted_at", null)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as TransaccionConRelaciones[];
    },
    enabled: !!centroId,
  });

  const { data: ingresosPorFecha = [], isLoading: loadingIngresos } = useQuery({
    queryKey: ["ingresos-clinicos-variables", centroId, firstDay, lastDay],
    queryFn: async () => {
      if (!centroId) return [];
      const { data } = await supabase
        .from("transacciones")
        .select("*, servicios(id,nombre,servicio,categoria_id), categorias(id,nombre,tipo), pacientes(id,nombre_completo)")
        .eq("centro_id", centroId)
        .eq("tipo", "ingreso")
        .gte("fecha", firstDay)
        .lte("fecha", lastDay)
        .is("deleted_at", null)
        .order("fecha", { ascending: false });
      return (data ?? []) as unknown as TransaccionConRelaciones[];
    },
    enabled: !!centroId,
  });

  const pagosPorPaciente = pagosMensualidad.reduce<Record<string, TransaccionConRelaciones[]>>((acc, pago) => {
    if (!pago.paciente_id) return acc;
    acc[pago.paciente_id] = [...(acc[pago.paciente_id] ?? []), pago];
    return acc;
  }, {});

  const pacientes: PacienteIngreso[] = pacientesActivos
    .filter((paciente) => paciente.servicios?.precio)
    .map((paciente) => {
      const pagos = pagosPorPaciente[paciente.id] ?? [];
      const esperado = paciente.servicios?.precio ?? 0;
      const pagado = pagos.reduce((sum, pago) => sum + pago.monto, 0);
      const pendiente = Math.max(esperado - pagado, 0);

      return {
        id: paciente.id,
        nombre: paciente.nombre_completo,
        plan: paciente.servicios?.nombre ?? "Sin plan",
        esperado,
        pagado,
        pendiente,
        estado: getEstadoPago(pagado, esperado),
        ultimoPago: pagos[0]?.fecha ?? null,
      };
    });

  const ingresosVariables = ingresosPorFecha.filter((ingreso) => ingreso.periodo_pago !== periodo);
  const totalEsperado = pacientes.reduce((sum, paciente) => sum + paciente.esperado, 0);
  const totalPagado = pacientes.reduce((sum, paciente) => sum + paciente.pagado, 0);
  const totalPendiente = pacientes.reduce((sum, paciente) => sum + paciente.pendiente, 0);
  const totalVariables = ingresosVariables.reduce((sum, ingreso) => sum + ingreso.monto, 0);
  const totalProducido = totalPagado + totalVariables;
  const pagados = pacientes.filter((paciente) => paciente.estado === "pagado").length;
  const parciales = pacientes.filter((paciente) => paciente.estado === "parcial").length;
  const pendientes = pacientes.filter((paciente) => paciente.estado === "pendiente").length;
  const isLoading = loadingPacientes || loadingPagos || loadingIngresos;

  if (!centroActivo) {
    return (
      <div className="empty-state glass-card">
        <p>Selecciona o crea un centro para ver los ingresos clínicos.</p>
        <Link href="/centros/nuevo" className="btn-primary btn-pressable px-4 py-2 rounded-xl font-bold text-sm no-underline">
          Crear centro
        </Link>
      </div>
    );
  }

  return (
    <div className="page animate-fade-in-up">
      <motion.div
        className="page-head flex items-center justify-between flex-wrap gap-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <h1 className="page-title text-3xl font-extrabold tracking-tight">Ingresos Clínicos</h1>
          <p className="page-sub text-sm text-[var(--text-muted)] mt-1">
            Mensualidades esperadas, pagos reales y servicios variables por mes.
          </p>
        </div>
        <Link
          href="/transacciones?new=true"
          className="btn-primary btn-pressable flex items-center gap-1 px-4 py-2.5 h-10 rounded-xl font-bold text-sm tracking-wider uppercase no-underline"
        >
          <Plus size={15} strokeWidth={3} />
          <span>Registrar pago</span>
        </Link>
      </motion.div>

      <div className="period-card glass-card">
        <div className="period-copy">
          <CalendarDays size={18} className="text-[var(--accent)]" />
          <div>
            <span className="period-label">Periodo analizado</span>
            <strong className="period-title capitalize">{formatPeriodo(periodo)}</strong>
          </div>
        </div>
        <div className="period-input-wrap">
          <label className="form-label" htmlFor="periodo-ingresos">Mes</label>
          <input
            id="periodo-ingresos"
            type="month"
            className="form-input"
            value={periodo}
            onChange={(event) => setPeriodo(event.target.value || getCurrentPeriod())}
          />
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard title="Mensualidad esperada" value={totalEsperado} variant="income" index={0} subtitle={`${pacientes.length} pacientes con plan activo`} />
        <KpiCard title="Mensualidad pagada" value={totalPagado} variant="income" index={1} subtitle={`${pagados} pagados · ${parciales} parciales`} />
        <KpiCard title="Pendiente" value={totalPendiente} variant={totalPendiente > 0 ? "expense" : "neutral"} index={2} subtitle={`${pendientes} pacientes pendientes`} />
        <KpiCard title="Servicios variables" value={totalVariables} variant="balance" index={3} subtitle={`${ingresosVariables.length} ingresos por fecha`} />
      </div>

      <div className="summary-strip glass-card">
        <div>
          <span className="summary-label">Producción total del periodo</span>
          <strong className="summary-value">{formatHNL(totalProducido)}</strong>
        </div>
        <div>
          <span className="summary-label">Cobertura de mensualidades</span>
          <strong className="summary-value">{totalEsperado > 0 ? `${Math.min((totalPagado / totalEsperado) * 100, 100).toFixed(0)}%` : "0%"}</strong>
        </div>
        <div>
          <span className="summary-label">Estado de cartera</span>
          <strong className="summary-value">{totalPendiente > 0 ? "Con pendientes" : "Al día"}</strong>
        </div>
      </div>

      <div className="content-grid">
        <section className="table-card glass-card">
          <div className="section-header">
            <div className="section-title-group">
              <Users size={16} className="text-[var(--accent)]" />
              <h2 className="section-title">Pacientes con plan activo</h2>
            </div>
            <span className="badge badge-muted text-[10px] font-bold">{pacientes.length} pacientes</span>
          </div>

          {isLoading ? (
            <div className="loading-rows">
              {[1, 2, 3, 4].map((item) => <div key={item} className="skeleton-row" />)}
            </div>
          ) : pacientes.length === 0 ? (
            <div className="empty-table">
              <Users size={28} />
              <p>No hay pacientes activos con plan y precio configurado.</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Paciente</th>
                      <th>Plan</th>
                      <th>Esperado</th>
                      <th>Pagado</th>
                      <th>Pendiente</th>
                      <th>Estado</th>
                      <th>Último pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pacientes.map((paciente, index) => (
                      <motion.tr
                        key={paciente.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(index * 0.03, 0.3) }}
                      >
                        <td>
                          <Link href={`/pacientes/${paciente.id}`} className="patient-link">
                            {paciente.nombre}
                          </Link>
                        </td>
                        <td><span className="text-sm font-medium">{paciente.plan}</span></td>
                        <td><span className="mono font-bold">{formatHNL(paciente.esperado)}</span></td>
                        <td><span className="mono font-bold text-[var(--accent)]">{formatHNL(paciente.pagado)}</span></td>
                        <td><span className="mono font-bold text-[var(--red)]">{formatHNL(paciente.pendiente)}</span></td>
                        <td><span className={`badge ${ESTADO_BADGE[paciente.estado]}`}>{ESTADO_LABEL[paciente.estado]}</span></td>
                        <td><span className="text-sm text-[var(--text-muted)]">{paciente.ultimoPago ? formatFechaCorta(paciente.ultimoPago) : "—"}</span></td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mobile-clinical-list" aria-label="Pacientes con plan activo">
                {pacientes.map((paciente, index) => (
                  <motion.article
                    key={paciente.id}
                    className={`mobile-clinical-card ${paciente.estado === "pendiente" ? "expense" : "income"}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  >
                    <div className="mobile-card-top">
                      <div>
                        <span className={`badge ${ESTADO_BADGE[paciente.estado]}`}>{ESTADO_LABEL[paciente.estado]}</span>
                        <p className="mobile-card-date mono">
                          Último pago · {paciente.ultimoPago ? formatFechaCorta(paciente.ultimoPago) : "—"}
                        </p>
                      </div>
                      <span className="mobile-card-amount mono" style={{ color: paciente.pendiente > 0 ? "var(--red)" : "var(--accent)" }}>
                        {formatHNL(paciente.pendiente)}
                      </span>
                    </div>

                    <div className="mobile-card-main">
                      <Link href={`/pacientes/${paciente.id}`} className="patient-link">
                        <h3>{paciente.nombre}</h3>
                      </Link>
                      <p>{paciente.plan}</p>
                    </div>

                    <div className="mobile-card-meta">
                      <div>
                        <span>Esperado</span>
                        <strong className="mono">{formatHNL(paciente.esperado)}</strong>
                      </div>
                      <div>
                        <span>Pagado</span>
                        <strong className="mono text-[var(--accent)]">{formatHNL(paciente.pagado)}</strong>
                      </div>
                      <div>
                        <span>Pendiente</span>
                        <strong className="mono text-[var(--red)]">{formatHNL(paciente.pendiente)}</strong>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </div>
            </>
          )}
        </section>

        <aside className="side-card glass-card">
          <div className="section-title-group">
            <ClipboardList size={16} className="text-[var(--accent)]" />
            <h2 className="section-title">Servicios variables</h2>
          </div>
          <p className="side-copy">Ingresos cobrados por fecha durante {formatPeriodo(periodo)}, sin contar mensualidades del mismo periodo.</p>

          {ingresosVariables.length === 0 ? (
            <div className="empty-side">
              <CircleDollarSign size={24} />
              <span>Sin ingresos variables este mes</span>
            </div>
          ) : (
            <div className="variable-list">
              {ingresosVariables.slice(0, 8).map((ingreso) => (
                <div key={ingreso.id} className="variable-item">
                  <div>
                    <strong>{ingreso.servicios?.nombre ?? ingreso.categorias?.nombre ?? "Ingreso"}</strong>
                    <span>{ingreso.pacientes?.nombre_completo ?? ingreso.detalle ?? formatFechaCorta(ingreso.fecha)}</span>
                  </div>
                  <span className="mono text-[var(--accent)] font-bold">{formatHNL(ingreso.monto)}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <style jsx>{`
        .page { display: flex; flex-direction: column; gap: 1.5rem; max-width: 1600px; }
        .page-title { color: var(--text); letter-spacing: -0.025em; }
        .empty-state { min-height: 45vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; color: var(--text-muted); }
        .period-card { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .period-copy { display: flex; align-items: center; gap: 0.75rem; }
        .period-label, .summary-label { display: block; font-size: 0.68rem; font-family: var(--font-mono); font-weight: 800; color: var(--text-subtle); text-transform: uppercase; letter-spacing: 0.08em; }
        .period-title { display: block; color: var(--text); font-size: 1.05rem; margin-top: 0.125rem; }
        .period-input-wrap { min-width: 220px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
        .summary-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
        .summary-value { display: block; font-family: var(--font-mono); font-size: 1.15rem; color: var(--text); margin-top: 0.25rem; }
        .content-grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 1rem; align-items: start; }
        .table-card, .side-card { display: flex; flex-direction: column; gap: 1rem; }
        .section-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
        .section-title-group { display: flex; align-items: center; gap: 0.5rem; }
        .section-title { margin: 0; font-size: 1rem; font-weight: 800; letter-spacing: -0.015em; color: var(--text); }
        .patient-link { color: var(--text); font-weight: 700; text-decoration: none; }
        .patient-link:hover { color: var(--accent); }
        .loading-rows { display: flex; flex-direction: column; gap: 0.65rem; }
        .empty-table, .empty-side { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.65rem; min-height: 180px; color: var(--text-subtle); text-align: center; }
        .side-copy { color: var(--text-muted); font-size: 0.85rem; line-height: 1.55; margin: 0; }
        .variable-list { display: flex; flex-direction: column; gap: 0.65rem; }
        .variable-item { display: flex; justify-content: space-between; gap: 1rem; padding: 0.75rem; border: 1px solid var(--border); border-radius: 14px; background: var(--bg-subtle); }
        .variable-item strong { display: block; font-size: 0.86rem; color: var(--text); }
        .variable-item span { display: block; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem; }
        :global(.mobile-clinical-list) { display: none; }
        @media (max-width: 1180px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } .content-grid { grid-template-columns: 1fr; } }
        @media (max-width: 720px) { .kpi-grid, .summary-strip { grid-template-columns: 1fr; } .period-input-wrap { width: 100%; } }
        @media (max-width: 700px) {
          :global(.table-card .table-responsive) { display: none; }
          :global(.mobile-clinical-list) { display: grid; gap: 1.15rem; padding-top: 0.25rem; }
          :global(.mobile-clinical-card) {
            position: relative;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: 22px;
            background: linear-gradient(145deg, rgba(33, 45, 68, 0.98), rgba(17, 26, 44, 0.98)), var(--surface);
            box-shadow: 0 18px 34px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.08);
            padding: 1rem;
          }
          :global(.mobile-clinical-card::before) {
            content: "";
            position: absolute;
            inset: 0 auto 0 0;
            width: 5px;
            background: linear-gradient(180deg, var(--accent), rgba(78, 222, 163, 0.22));
          }
          :global(.mobile-clinical-card.expense::before) { background: linear-gradient(180deg, var(--red), rgba(255, 180, 171, 0.2)); }
          :global(.mobile-clinical-card::after) {
            content: "";
            position: absolute;
            inset: 0 0 auto 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.18), transparent);
          }
          :global(.mobile-card-top) { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }
          :global(.mobile-card-date) { margin-top: 0.55rem; color: var(--text-subtle); font-size: 0.6875rem; font-weight: 700; }
          :global(.mobile-card-amount) { font-size: 1rem; font-weight: 900; white-space: nowrap; }
          :global(.mobile-card-main) { margin-top: 1rem; }
          :global(.mobile-card-main h3) { margin: 0; color: var(--text); font-size: 0.95rem; font-weight: 850; letter-spacing: -0.01em; }
          :global(.mobile-card-main p) { margin-top: 0.35rem; color: var(--text-muted); font-size: 0.8125rem; line-height: 1.45; }
          :global(.mobile-card-meta) { display: grid; gap: 0.625rem; margin-top: 1rem; padding: 0.875rem; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px; background: rgba(9, 16, 30, 0.42); }
          :global(.mobile-card-meta div) { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }
          :global(.mobile-card-meta span) { color: var(--text-subtle); font-family: var(--font-mono); font-size: 0.625rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
          :global(.mobile-card-meta strong) { color: var(--text); font-size: 0.75rem; font-weight: 800; text-align: right; }
          :global([data-theme="light"] .mobile-clinical-card) {
            border-color: rgba(15, 28, 19, 0.1);
            background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(237, 246, 241, 0.94));
            box-shadow: 0 16px 34px rgba(15, 28, 19, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8);
          }
          :global([data-theme="light"] .mobile-card-meta) { background: rgba(255, 255, 255, 0.72); }
        }
      `}</style>
    </div>
  );
}
