"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Phone, Mail, Calendar, FileText, ExternalLink } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { formatFecha, formatFechaCorta } from "@/utils/dates";
import { formatHNL } from "@/utils/currency";
import type { Paciente, TransaccionConRelaciones } from "@/types/database";

const ESTADO_BADGE: Record<string, string> = {
  activo: "badge-green",
  pausado: "badge-amber",
  cancelado: "badge-red",
};

const ESTADO_LABEL: Record<string, string> = {
  activo: "Activo",
  pausado: "Pausado",
  cancelado: "Cancelado",
};

export default function PacienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();

  const { data: paciente, isLoading: loadingPaciente } = useQuery({
    queryKey: ["paciente", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pacientes")
        .select("*, servicios_categorias(id, nombre, precio)")
        .eq("id", id)
        .is("deleted_at", null)
        .single();
      return data as unknown as Paciente & { servicios_categorias?: { nombre: string; precio: number | null } | null };
    },
  });

  const { data: pagos = [], isLoading: loadingPagos } = useQuery({
    queryKey: ["pagos-paciente", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("transacciones")
        .select("*, servicios_categorias(id, nombre, categoria)")
        .eq("paciente_id", id)
        .is("deleted_at", null)
        .order("fecha", { ascending: false })
        .limit(50);
      return (data ?? []) as unknown as TransaccionConRelaciones[];
    },
  });

  const totalPagado = pagos.reduce((s, t) => s + t.monto, 0);

  if (loadingPaciente) {
    return (
      <div className="detail-loading">
        <div className="skeleton-hero" />
        <div className="skeleton-body" />
      </div>
    );
  }

  if (!paciente) {
    return (
      <div className="detail-notfound">
        <p>Paciente no encontrado.</p>
        <Link href="/pacientes" className="back-link">Volver a Pacientes</Link>
      </div>
    );
  }

  return (
    <div className="detail-page">
      {/* Back */}
      <Link href="/pacientes" className="back-link btn-pressable">
        <ArrowLeft size={16} />
        Volver a Pacientes
      </Link>

      <div className="detail-grid">
        {/* Info card */}
        <motion.div
          className="info-card glass-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="ic-header">
            <div className="ic-avatar bg-[var(--accent-muted)] text-[var(--accent)] flex items-center justify-center font-bold text-lg w-12 h-12 rounded-full">
              {paciente.nombre_completo.charAt(0).toUpperCase()}
            </div>
            <div className="ic-name-group">
              <h1 className="ic-name text-lg font-bold">{paciente.nombre_completo}</h1>
              <span className={`badge ${ESTADO_BADGE[paciente.estado_suscripcion]}`}>
                {ESTADO_LABEL[paciente.estado_suscripcion]}
              </span>
            </div>
          </div>

          <div className="ic-fields mt-4">
            {paciente.telefono && (
              <div className="ic-field flex items-center gap-2 text-sm text-[var(--text-muted)] py-1">
                <Phone size={14} />
                <span>{paciente.telefono}</span>
              </div>
            )}
            {paciente.email && (
              <div className="ic-field flex items-center gap-2 text-sm text-[var(--text-muted)] py-1">
                <Mail size={14} />
                <span>{paciente.email}</span>
              </div>
            )}
            {paciente.fecha_nacimiento && (
              <div className="ic-field flex items-center gap-2 text-sm text-[var(--text-muted)] py-1">
                <Calendar size={14} />
                <span>Nació el {formatFecha(paciente.fecha_nacimiento)}</span>
              </div>
            )}
            <div className="ic-field flex items-center gap-2 text-sm text-[var(--text-muted)] py-1">
              <Calendar size={14} />
              <span>Ingresó el {formatFecha(paciente.fecha_ingreso)}</span>
            </div>
          </div>

          {(paciente as any).servicios_categorias && (
            <div className="ic-plan mt-4 pt-4 border-t border-[var(--border)]">
              <span className="ic-plan-label block text-[10px] font-mono font-bold text-[var(--text-subtle)] uppercase tracking-wider">Plan activo</span>
              <span className="ic-plan-name block text-sm font-bold text-[var(--text)] mt-1">{(paciente as any).servicios_categorias.nombre}</span>
              {(paciente as any).servicios_categorias.precio && (
                <span className="ic-plan-price block text-xs font-mono font-bold text-[var(--accent)] mt-0.5">
                  {formatHNL((paciente as any).servicios_categorias.precio)}/mes
                </span>
              )}
            </div>
          )}

          {paciente.notas && (
            <div className="ic-notes mt-4 pt-4 border-t border-[var(--border)]">
              <div className="ic-notes-header flex items-center gap-1.5 text-xs font-bold text-[var(--text-subtle)]">
                <FileText size={14} />
                <span>Notas</span>
              </div>
              <p className="ic-notes-text text-sm text-[var(--text-muted)] mt-1.5 leading-relaxed">{paciente.notas}</p>
            </div>
          )}

          {/* Resumen */}
          <div className="ic-summary mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between gap-4">
            <div className="summary-item">
              <span className="summary-label block text-[10px] font-mono font-bold text-[var(--text-subtle)] uppercase tracking-wider">Total pagado</span>
              <span className="summary-value block text-lg font-mono font-bold text-[var(--accent)] mt-1">{formatHNL(totalPagado)}</span>
            </div>
            <div className="summary-item text-right">
              <span className="summary-label block text-[10px] font-mono font-bold text-[var(--text-subtle)] uppercase tracking-wider">Transacciones</span>
              <span className="summary-value block text-lg font-mono font-bold text-[var(--text)] mt-1">{pagos.length}</span>
            </div>
          </div>
        </motion.div>

        {/* Timeline de pagos */}
        <motion.div
          className="timeline-card glass-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
        >
          <h2 className="timeline-title text-base font-extrabold tracking-tight mb-4">Historial de pagos</h2>

          {loadingPagos ? (
            <div className="timeline-loading">
              {[1, 2, 3].map((i) => <div key={i} className="skeleton-row" />)}
            </div>
          ) : pagos.length === 0 ? (
            <div className="timeline-empty">
              <p>No hay pagos registrados para este paciente.</p>
            </div>
          ) : (
            <div className="timeline">
              {pagos.map((pago, i) => (
                <motion.div
                  key={pago.id}
                  className="timeline-item"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.4) }}
                >
                  <div className="tl-dot" />
                  <div className="tl-content">
                    <div className="tl-top">
                      <span className="tl-categoria">
                        {(pago as any).servicios_categorias?.nombre ?? "Pago"}
                      </span>
                      <span className="tl-monto">
                        {formatHNL(pago.monto)}
                      </span>
                    </div>
                    <div className="tl-bottom">
                      <span className="tl-fecha">{formatFechaCorta(pago.fecha)}</span>
                      <span className="tl-metodo badge badge-muted">
                        {pago.metodo_pago}
                      </span>
                      {pago.comprobante_url && (
                        <a
                          href={pago.comprobante_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tl-comprobante"
                          aria-label="Ver comprobante"
                        >
                          <ExternalLink size={12} />
                          Ver recibo
                        </a>
                      )}
                    </div>
                    {pago.detalle && (
                      <p className="tl-detalle">{pago.detalle}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <style jsx>{`
        .detail-page {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          max-width: 1200px;
        }
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-muted);
          text-decoration: none;
          padding: 0.375rem 0.75rem;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--surface);
          width: fit-content;
          transition: color 150ms, background 150ms, transform 160ms var(--ease-out);
        }
        .back-link:hover { color: var(--text); background: var(--surface-hover); }
        .detail-grid {
          display: grid;
          grid-template-columns: 340px 1fr;
          gap: 1.25rem;
          align-items: start;
        }
        .info-card, .timeline-card {
          padding: 1.5rem;
        }
        .ic-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.25rem;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid var(--border);
        }
        .ic-avatar {
          width: 56px;
          height: 56px;
          background: var(--accent-muted);
          color: var(--accent);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.5rem;
          flex-shrink: 0;
        }
        .ic-name {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 0.375rem;
          letter-spacing: -0.01em;
        }
        .ic-fields {
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
          margin-bottom: 1.25rem;
        }
        .ic-field {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: var(--text-muted);
        }
        .ic-plan {
          background: var(--accent-muted);
          border-radius: 8px;
          padding: 0.875rem;
          margin-bottom: 1rem;
        }
        .ic-plan-label {
          display: block;
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 0.25rem;
        }
        .ic-plan-name {
          display: block;
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--text);
        }
        .ic-plan-price {
          display: block;
          font-size: 0.8125rem;
          color: var(--accent);
          font-family: var(--font-mono);
          margin-top: 0.125rem;
        }
        .ic-notes { margin-bottom: 1rem; }
        .ic-notes-header {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          margin-bottom: 0.375rem;
        }
        .ic-notes-text {
          font-size: 0.875rem;
          color: var(--text-muted);
          margin: 0;
          line-height: 1.5;
        }
        .ic-summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }
        .summary-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .summary-label {
          font-size: 0.6875rem;
          color: var(--text-muted);
          font-weight: 500;
        }
        .summary-value {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--accent);
          font-family: var(--font-mono);
          letter-spacing: -0.02em;
        }
        .timeline-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 1.25rem;
          letter-spacing: -0.01em;
        }
        .timeline {
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .timeline::before {
          content: '';
          position: absolute;
          left: 7px;
          top: 8px;
          bottom: 8px;
          width: 2px;
          background: var(--border);
          border-radius: 1px;
        }
        .timeline-item {
          display: flex;
          gap: 1rem;
          padding-bottom: 1.25rem;
        }
        .tl-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--accent);
          border: 3px solid var(--surface);
          box-shadow: 0 0 0 2px var(--accent-muted);
          flex-shrink: 0;
          margin-top: 1px;
        }
        .tl-content { flex: 1; min-width: 0; }
        .tl-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.25rem;
          gap: 0.5rem;
        }
        .tl-categoria {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text);
        }
        .tl-monto {
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--accent);
          font-family: var(--font-mono);
          white-space: nowrap;
        }
        .tl-bottom {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .tl-fecha {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }
        .tl-comprobante {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.75rem;
          color: var(--accent);
          text-decoration: none;
          font-weight: 500;
        }
        .tl-detalle {
          font-size: 0.8125rem;
          color: var(--text-muted);
          margin: 0.25rem 0 0;
        }
        .timeline-empty {
          text-align: center;
          padding: 2rem;
          color: var(--text-muted);
          font-size: 0.875rem;
        }
        .timeline-loading {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .skeleton-row {
          height: 60px;
          background: var(--bg-subtle);
          border-radius: 8px;
          animation: pulse 1.5s ease-in-out infinite;
        }
        .skeleton-hero { height: 200px; background: var(--surface); border-radius: 12px; margin-bottom: 1rem; animation: pulse 1.5s ease-in-out infinite; }
        .skeleton-body { height: 400px; background: var(--surface); border-radius: 12px; animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .detail-notfound {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 4rem;
          color: var(--text-muted);
        }
        @media (max-width: 900px) {
          .detail-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
