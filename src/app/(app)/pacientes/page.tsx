"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Search, UserCheck, Trash2, Filter, Users, ShieldAlert, CircleUserRound, ToggleLeft, ToggleRight, X, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { createClient } from "@/lib/supabase/client";
import { useCentro } from "@/context/CentroContext";
import { pacienteSchema, type PacienteFormData } from "@/types/forms";
import { formatFechaCorta } from "@/utils/dates";
import type { PacienteConPlan, Servicio } from "@/types/database";
import { KpiCard } from "@/components/dashboard/KpiCard";

const ESTADO_LABEL: Record<string, string> = {
  activo: "Activo",
  pausado: "Pausado",
  cancelado: "Inactivo",
};

const ESTADO_BADGE: Record<string, string> = {
  activo: "badge-green",
  pausado: "badge-amber",
  cancelado: "badge-muted",
};

export default function PacientesPage() {
  const router = useRouter();
  const { centroActivo } = useCentro();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "activo" | "pausado" | "cancelado">("todos");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const centroId = centroActivo?.id;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PacienteFormData>({
    resolver: zodResolver(pacienteSchema),
    defaultValues: { estado_suscripcion: "activo" },
  });

  const [showNuevoPlanForm, setShowNuevoPlanForm] = useState(false);
  const [nuevoPlanNombre, setNuevoPlanNombre] = useState("");
  const [nuevoPlanCategoria, setNuevoPlanCategoria] = useState("");
  const [nuevoPlanPrecio, setNuevoPlanPrecio] = useState("");

  const createPlanRapidoMutation = useMutation({
    mutationFn: async () => {
      if (!centroId) throw new Error();
      if (!nuevoPlanNombre || !nuevoPlanCategoria) throw new Error("Campos requeridos vacíos");
      
      // 1. Buscar o crear la categoría
      let catId: string;
      const { data: existingCat } = await supabase
        .from("categorias")
        .select("id")
        .eq("centro_id", centroId)
        .eq("nombre", nuevoPlanCategoria)
        .eq("tipo", "ingreso")
        .is("deleted_at", null)
        .maybeSingle();

      if (existingCat) {
        catId = existingCat.id;
      } else {
        const { data: newCat, error: catError } = await supabase
          .from("categorias")
          .insert({
            centro_id: centroId,
            nombre: nuevoPlanCategoria,
            tipo: "ingreso",
            activo: true,
          })
          .select()
          .single();
        if (catError) throw catError;
        catId = newCat.id;
      }

      // 2. Insertar el servicio
      const { data, error } = await supabase
        .from("servicios")
        .insert({
          centro_id: centroId,
          nombre: nuevoPlanNombre,
          servicio: "Plan",
          categoria_id: catId,
          precio: nuevoPlanPrecio ? parseFloat(nuevoPlanPrecio) : null,
          activo: true,
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["planes"] });
      queryClient.invalidateQueries({ queryKey: ["servicios"] });
      
      if (data && data.id) {
        setValue("plan_id", data.id);
      }
      
      setNuevoPlanNombre("");
      setNuevoPlanCategoria("");
      setNuevoPlanPrecio("");
      setShowNuevoPlanForm(false);
    },
  });

  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ["pacientes", centroId, filtroEstado, search],
    queryFn: async () => {
      if (!centroId) return [];
      let q = supabase
        .from("pacientes")
        .select("*, servicios(id, nombre, precio)")
        .eq("centro_id", centroId)
        .is("deleted_at", null)
        .order("nombre_completo");

      if (filtroEstado !== "todos") q = q.eq("estado_suscripcion", filtroEstado);
      if (search.length >= 2) q = q.ilike("nombre_completo", `%${search}%`);

      const { data } = await q.limit(100);
      return (data ?? []) as unknown as PacienteConPlan[];
    },
    enabled: !!centroId,
  });

  const { data: planes = [] } = useQuery({
    queryKey: ["planes", centroId],
    queryFn: async () => {
      if (!centroId) return [];
      const { data } = await supabase
        .from("servicios")
        .select("*")
        .eq("centro_id", centroId)
        .eq("activo", true)
        .is("deleted_at", null)
        .order("nombre");
      return (data ?? []) as Servicio[];
    },
    enabled: !!centroId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: PacienteFormData) => {
      if (!centroId) throw new Error();
      const { error } = await supabase.from("pacientes").insert({
        centro_id: centroId,
        nombre_completo: data.nombre_completo,
        email: data.email || null,
        telefono: data.telefono || null,
        fecha_nacimiento: data.fecha_nacimiento || null,
        estado_suscripcion: data.estado_suscripcion,
        plan_id: data.plan_id || null,
        notas: data.notas || null,
        estado_mensualidad: data.estado_suscripcion === "activo",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      queryClient.invalidateQueries({ queryKey: ["pacientes-activos"] });
      reset();
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PacienteFormData }) => {
      const { error } = await supabase
        .from("pacientes")
        .update({
          nombre_completo: data.nombre_completo,
          email: data.email || null,
          telefono: data.telefono || null,
          fecha_nacimiento: data.fecha_nacimiento || null,
          estado_suscripcion: data.estado_suscripcion,
          plan_id: data.plan_id || null,
          notas: data.notas || null,
          estado_mensualidad: data.estado_suscripcion === "activo",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      queryClient.invalidateQueries({ queryKey: ["pacientes-activos"] });
      reset();
      setEditingId(null);
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pacientes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      queryClient.invalidateQueries({ queryKey: ["pacientes-activos"] });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, nuevoEstado }: { id: string; nuevoEstado: "activo" | "cancelado" }) => {
      const { error } = await supabase
        .from("pacientes")
        .update({
          estado_suscripcion: nuevoEstado,
          estado_mensualidad: nuevoEstado === "activo",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      queryClient.invalidateQueries({ queryKey: ["pacientes-activos"] });
    },
  });

  const activos = pacientes.filter((p) => p.estado_suscripcion === "activo").length;
  const pausados = pacientes.filter((p) => p.estado_suscripcion === "pausado").length;
  const inactivos = pacientes.filter((p) => p.estado_suscripcion === "cancelado").length;

  const now = new Date();
  const nuevosEsteMes = pacientes.filter((p) => {
    const fecha = new Date(p.fecha_ingreso);
    return fecha.getFullYear() === now.getFullYear() && fecha.getMonth() === now.getMonth();
  }).length;

  return (
    <div className="page animate-fade-in-up">
      {/* Header */}
      <div className="page-head flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title text-3xl font-extrabold tracking-tight">Gestión de Pacientes</h1>
          <p className="page-sub text-sm text-[var(--text-muted)] mt-1">Directorio / Pacientes Activos</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="search-wrap">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Buscar pacientes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              id="buscar-paciente"
            />
          </div>
          <button
            className="btn-primary btn-pressable flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase"
            onClick={() => { setShowForm(true); setEditingId(null); reset(); }}
            id="nuevo-paciente-btn"
          >
            <Plus size={15} strokeWidth={3} />
            <span>Nuevo Paciente</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <KpiCard
          title="Total Pacientes"
          value={pacientes.length}
          variant="neutral"
          index={0}
          format={(n) => Math.round(n).toString()}
          subtitle="Registrados en el sistema"
        />
        <KpiCard
          title="Nuevos (Mes)"
          value={nuevosEsteMes}
          variant="income"
          index={1}
          format={(n) => Math.round(n).toString()}
          subtitle="Ingresados este mes"
        />
        <KpiCard
          title="En Tratamiento"
          value={activos}
          variant="balance"
          index={2}
          format={(n) => Math.round(n).toString()}
          subtitle="Con mensualidad activa"
        />
      </div>

      {/* Directorio Card */}
      <div className="p-1.5 bg-white/5 dark:bg-white/5 border border-white/10 dark:border-white/5 rounded-[28px] shadow-2xl backdrop-blur-xl">
        <div className="bg-white/45 dark:bg-[#131b2e]/40 border border-white/10 dark:border-white/5 rounded-[22px] p-6">
          <div className="flex items-center justify-between flex-wrap gap-4 pb-5 border-b border-[var(--border)] mb-5">
            <div className="flex items-center gap-2.5">
              <h2 className="directory-title text-base font-extrabold tracking-tight">Directorio</h2>
              <span className="badge badge-muted text-[10px] font-bold">
                {pacientes.length} registros
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button className="btn-filter btn-pressable flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)]">
                <Filter size={13} />
                <span>Filtros</span>
              </button>
              <div className="filtro-tabs">
                {[
                  { value: "todos" as const, label: "Todos" },
                  { value: "activo" as const, label: "Activos" },
                  { value: "cancelado" as const, label: "Inactivos" },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    className={`filtro-tab btn-pressable ${filtroEstado === tab.value ? "active" : ""}`}
                    onClick={() => setFiltroEstado(tab.value)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Modal de Nuevo Paciente */}
          <Dialog.Root open={showForm} onOpenChange={(open) => { if (!open) { reset(); setEditingId(null); } setShowForm(open); }}>
            <Dialog.Portal>
              <AnimatePresence>
                {showForm && (
                  <>
                    <Dialog.Overlay asChild>
                      <motion.div
                        className="fixed inset-0 bg-black/60 z-[300] backdrop-blur-md"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      />
                    </Dialog.Overlay>
                    <Dialog.Content asChild>
                      <motion.div
                        className="fixed top-1/2 left-1/2 w-full max-w-5xl z-[301] outline-none p-4"
                        initial={{ opacity: 0, scale: 0.95, x: "-50%", y: "-48%" }}
                        animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                        exit={{ opacity: 0, scale: 0.95, x: "-50%", y: "-48%" }}
                        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                      >
                        {/* Box double-bezel wrapper */}
                        <div className="p-1.5 bg-white/5 dark:bg-white/5 border border-white/10 dark:border-white/5 rounded-[28px] shadow-2xl backdrop-blur-xl">
                          <div className="bg-white/95 dark:bg-[#131b2e]/95 border border-white/10 dark:border-white/5 rounded-[22px] p-6 text-[var(--text)]">
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border)]">
                              <div>
                                <Dialog.Title className="text-lg font-extrabold tracking-tight">
                                  {editingId ? "Editar Paciente" : "Nuevo Paciente"}
                                </Dialog.Title>
                                <Dialog.Description className="sr-only">
                                  {editingId ? "Formulario para editar los datos de un paciente existente." : "Formulario para registrar los datos de un nuevo paciente."}
                                </Dialog.Description>
                              </div>
                              <Dialog.Close asChild>
                                <button
                                  type="button"
                                  className="icon-btn btn-pressable flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-all"
                                  aria-label="Cerrar"
                                >
                                  <X size={14} />
                                </button>
                              </Dialog.Close>
                            </div>
                            <form onSubmit={handleSubmit((d) => {
                              if (editingId) {
                                updateMutation.mutate({ id: editingId, data: d });
                              } else {
                                createMutation.mutate(d);
                              }
                            })} noValidate>
                              <div className="form-grid">
                                <div className="form-group span-full">
                                  <label className="form-label" htmlFor="nombre_completo">
                                    Nombre completo <span className="req">*</span>
                                  </label>
                                  <input
                                    id="nombre_completo"
                                    type="text"
                                    className={`form-input ${errors.nombre_completo ? "error" : ""}`}
                                    placeholder="Nombre y apellido del paciente"
                                    {...register("nombre_completo")}
                                  />
                                  {errors.nombre_completo && (
                                    <p className="form-error">{errors.nombre_completo.message}</p>
                                  )}
                                </div>

                                <div className="form-group">
                                  <label className="form-label" htmlFor="telefono">Teléfono</label>
                                  <input
                                    id="telefono"
                                    type="tel"
                                    className="form-input"
                                    placeholder="+504 9999-0000"
                                    {...register("telefono")}
                                  />
                                </div>

                                <div className="form-group">
                                  <label className="form-label" htmlFor="pac-email">Correo electrónico</label>
                                  <input
                                    id="pac-email"
                                    type="email"
                                    className={`form-input ${errors.email ? "error" : ""}`}
                                    placeholder="paciente@correo.com"
                                    {...register("email")}
                                  />
                                  {errors.email && <p className="form-error">{errors.email.message}</p>}
                                </div>

                                <div className="form-group">
                                  <label className="form-label" htmlFor="fecha_nacimiento">Fecha de nacimiento</label>
                                  <input
                                    id="fecha_nacimiento"
                                    type="date"
                                    className="form-input"
                                    {...register("fecha_nacimiento")}
                                  />
                                </div>

                                <div className="form-group">
                                  <label className="form-label" htmlFor="plan_id">Plan / Servicio</label>
                                  <div className="flex gap-2">
                                    <select
                                      id="plan_id"
                                      className="form-input form-select flex-1"
                                      {...register("plan_id")}
                                    >
                                      <option value="">Sin plan específico</option>
                                      {planes.map((p) => (
                                        <option key={p.id} value={p.id}>{p.nombre}</option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      className="icon-btn btn-pressable flex items-center justify-center h-[38px] w-[38px] rounded-lg border border-[var(--border)] bg-white/5 hover:bg-white/10 text-[var(--text)] transition-colors flex-shrink-0"
                                      onClick={() => setShowNuevoPlanForm(true)}
                                      title="Nuevo Plan"
                                    >
                                      <Plus size={16} />
                                    </button>
                                  </div>
                                </div>

                                <div className="form-group">
                                  <label className="form-label" htmlFor="estado_suscripcion">
                                    Estado <span className="req">*</span>
                                  </label>
                                  <select
                                    id="estado_suscripcion"
                                    className="form-input form-select"
                                    {...register("estado_suscripcion")}
                                  >
                                    <option value="activo">Activo</option>
                                    <option value="pausado">Pausado</option>
                                    <option value="cancelado">Cancelado</option>
                                  </select>
                                </div>

                                <div className="form-group span-full">
                                  <label className="form-label" htmlFor="notas">Notas</label>
                                  <textarea
                                    id="notas"
                                    className="form-input form-textarea"
                                    placeholder="Información adicional..."
                                    rows={2}
                                    {...register("notas")}
                                  />
                                </div>
                              </div>

                              <div className="form-actions mt-4">
                                <Dialog.Close asChild>
                                  <button
                                    type="button"
                                    className="btn-ghost btn-pressable items-center px-4 py-2 text-sm font-semibold rounded-lg"
                                  >
                                    Cancelar
                                  </button>
                                </Dialog.Close>
                                <button
                                  type="submit"
                                  className="btn-primary btn-pressable px-4 py-2 text-sm font-semibold rounded-lg"
                                  disabled={createMutation.isPending || updateMutation.isPending}
                                >
                                  {createMutation.isPending || updateMutation.isPending ? (
                                    <span className="btn-spinner" />
                                  ) : editingId ? (
                                    "Guardar cambios"
                                  ) : (
                                    "Guardar paciente"
                                  )}
                                </button>
                              </div>
                            </form>
                          </div>
                        </div>
                      </motion.div>
                    </Dialog.Content>
                  </>
                )}
              </AnimatePresence>
            </Dialog.Portal>
          </Dialog.Root>

          {/* Sub-modal de Rápido Plan */}
          <Dialog.Root open={showNuevoPlanForm} onOpenChange={(open) => { if (!open) { setNuevoPlanNombre(""); setNuevoPlanCategoria(""); setNuevoPlanPrecio(""); } setShowNuevoPlanForm(open); }}>
            <Dialog.Portal>
              <AnimatePresence>
                {showNuevoPlanForm && (
                  <>
                    <Dialog.Overlay asChild>
                      <motion.div
                        className="fixed inset-0 bg-black/70 z-[400] backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      />
                    </Dialog.Overlay>
                    <Dialog.Content asChild>
                      <motion.div
                        className="fixed top-1/2 left-1/2 w-full max-w-md z-[401] outline-none p-4"
                        initial={{ opacity: 0, scale: 0.95, x: "-50%", y: "-48%" }}
                        animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                        exit={{ opacity: 0, scale: 0.95, x: "-50%", y: "-48%" }}
                        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                      >
                        <div className="p-1.5 bg-white/5 dark:bg-white/5 border border-white/10 dark:border-white/5 rounded-[24px] shadow-2xl backdrop-blur-xl">
                          <div className="bg-white/95 dark:bg-[#131b2e]/95 border border-white/10 dark:border-white/5 rounded-[18px] p-5 text-[var(--text)]">
                            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--border)]">
                              <div>
                                <Dialog.Title className="text-md font-extrabold tracking-tight">
                                  Crear Nuevo Plan
                                </Dialog.Title>
                                <Dialog.Description className="sr-only">
                                  Formulario para registrar un nuevo plan rápidamente.
                                </Dialog.Description>
                              </div>
                              <Dialog.Close asChild>
                                <button
                                  type="button"
                                  className="icon-btn btn-pressable flex items-center justify-center w-7 h-7 rounded-full border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-all"
                                  aria-label="Cerrar"
                                >
                                  <X size={12} />
                                </button>
                              </Dialog.Close>
                            </div>
                            <form onSubmit={(e) => { e.preventDefault(); createPlanRapidoMutation.mutate(); }}>
                              <div className="flex flex-col gap-3">
                                <div className="form-group">
                                  <label className="form-label text-xs font-bold" htmlFor="quick-plan-nombre">Nombre <span className="req">*</span></label>
                                  <input
                                    id="quick-plan-nombre"
                                    type="text"
                                    className="form-input text-xs py-1.5 px-3 rounded-lg"
                                    placeholder="Ej. Plan Semanal 2 Sesiones"
                                    required
                                    value={nuevoPlanNombre}
                                    onChange={(e) => setNuevoPlanNombre(e.target.value)}
                                  />
                                </div>
                                <div className="form-group">
                                  <label className="form-label text-xs font-bold" htmlFor="quick-plan-categoria">Categoría <span className="req">*</span></label>
                                  <input
                                    id="quick-plan-categoria"
                                    type="text"
                                    className="form-input text-xs py-1.5 px-3 rounded-lg"
                                    placeholder="Ej. Mensualidades"
                                    required
                                    value={nuevoPlanCategoria}
                                    onChange={(e) => setNuevoPlanCategoria(e.target.value)}
                                  />
                                </div>
                                <div className="form-group">
                                  <label className="form-label text-xs font-bold" htmlFor="quick-plan-precio">Precio mensual (L)</label>
                                  <input
                                    id="quick-plan-precio"
                                    type="text"
                                    inputMode="decimal"
                                    className="form-input text-xs py-1.5 px-3 rounded-lg"
                                    placeholder="0.00"
                                    value={nuevoPlanPrecio}
                                    onChange={(e) => setNuevoPlanPrecio(e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="form-actions mt-4 pt-3 border-t border-[var(--border)] flex justify-end gap-2">
                                <Dialog.Close asChild>
                                  <button
                                    type="button"
                                    className="btn-ghost btn-pressable px-3 py-1.5 text-xs font-bold rounded-lg"
                                  >
                                    Cancelar
                                  </button>
                                </Dialog.Close>
                                <button
                                  type="submit"
                                  className="btn-primary btn-pressable px-3 py-1.5 text-xs font-bold rounded-lg"
                                  disabled={createPlanRapidoMutation.isPending}
                                >
                                  {createPlanRapidoMutation.isPending ? <span className="btn-spinner" /> : "Crear plan"}
                                </button>
                              </div>
                            </form>
                          </div>
                        </div>
                      </motion.div>
                    </Dialog.Content>
                  </>
                )}
              </AnimatePresence>
            </Dialog.Portal>
          </Dialog.Root>

          {/* Tabla del Directorio */}
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton-card" style={{ height: "60px" }} />
              ))}
            </div>
          ) : pacientes.length === 0 ? (
            <div className="table-empty py-12 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
              <UserCheck size={28} className="opacity-50" />
              <p>No hay pacientes registrados</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Contacto</th>
                    <th>Última Visita</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pacientes.map((p, i) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="pc-avatar flex items-center justify-center font-bold text-xs bg-[var(--accent-muted)] text-[var(--accent)] w-9 h-9 rounded-full">
                            {p.nombre_completo.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <Link href={`/pacientes/${p.id}`} className="patient-link font-bold">
                              {p.nombre_completo}
                            </Link>
                            <span className="block text-[10px] font-mono text-[var(--text-subtle)] mt-0.5">
                              ID: PAC-{p.id.slice(0, 4).toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="block text-xs font-semibold">{p.email || "—"}</span>
                        <span className="block text-[10px] text-[var(--text-muted)] mt-0.5">{p.telefono || "—"}</span>
                      </td>
                      <td className="font-mono text-xs text-[var(--text-muted)]">
                        {formatFechaCorta(p.fecha_ingreso)}
                      </td>
                      <td>
                        <span className={`badge ${ESTADO_BADGE[p.estado_suscripcion]}`}>
                          {ESTADO_LABEL[p.estado_suscripcion]}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => router.push(`/pacientes/${p.id}`)}
                            className="icon-btn save btn-pressable"
                            aria-label="Ver perfil"
                          >
                            <CircleUserRound size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(p.id);
                              reset({
                                nombre_completo: p.nombre_completo,
                                email: p.email || "",
                                telefono: p.telefono || "",
                                fecha_nacimiento: p.fecha_nacimiento || "",
                                plan_id: p.plan_id || "",
                                estado_suscripcion: p.estado_suscripcion,
                                notas: p.notas || "",
                              });
                              setShowForm(true);
                            }}
                            className="icon-btn btn-pressable"
                            aria-label="Editar paciente"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="icon-btn btn-pressable"
                            onClick={() => {
                              const nuevoEstado = p.estado_suscripcion === "activo" ? "cancelado" : "activo";
                              toggleStatusMutation.mutate({ id: p.id, nuevoEstado });
                            }}
                            disabled={toggleStatusMutation.isPending}
                            aria-label={p.estado_suscripcion === "activo" ? "Desactivar paciente" : "Activar paciente"}
                          >
                            {p.estado_suscripcion === "activo" ? (
                              <ToggleRight size={18} className="text-[var(--accent)]" />
                            ) : (
                              <ToggleLeft size={18} className="text-[var(--text-muted)]" />
                            )}
                          </button>
                          <button
                            className="icon-btn danger btn-pressable"
                            onClick={() => {
                              if (confirm(`¿Eliminar a ${p.nombre_completo}? Se perderán todos sus datos.`)) {
                                deleteMutation.mutate(p.id);
                              }
                            }}
                            aria-label="Eliminar paciente"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Directory Pagination Footer */}
        <div className="directory-footer flex items-center justify-between border-t border-[var(--border)] pt-4 mt-4 pl-4 pb-2 text-xs font-semibold text-[var(--text-muted)] flex-wrap gap-2">
          <div>
            Mostrando 1-{pacientes.length} de {pacientes.length} pacientes
          </div>
          <div className="pagination flex items-center gap-1 pr-2 pb-2">
            <button className="btn-page disabled px-2 py-1 rounded border border-[var(--border)]">&lt;</button>
            <button className="btn-page active px-2 py-1 rounded bg-[var(--accent)] text-[var(--accent-fg)]">1</button>
            <button className="btn-page disabled px-2 py-1 rounded border border-[var(--border)]">&gt;</button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          max-width: 1600px;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }

        @media (max-width: 768px) {
          .kpi-grid {
            grid-template-columns: 1fr;
          }
        }

        .search-wrap {
          position: relative;
          min-width: 220px;
        }

        :global(.search-icon) {
          position: absolute;
          left: 0.875rem;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          background: #ffffff !important;
          color: #0f172a !important;
          border: 1.5px solid #cbd5e1 !important;
          border-radius: 10px;
          padding: 0.5rem 0.875rem 0.5rem 2.25rem;
          font-size: 0.8125rem;
          font-family: var(--font-sans);
          transition: all 150ms var(--ease-out);
          outline: none;
        }

        .search-input:focus {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 3px var(--accent-muted) !important;
        }

        .directory-card {
          padding: 0;
          overflow: hidden;
        }

        .directory-header {
          padding: 1.25rem 1.25rem 0;
          border-bottom: none;
        }

        .filtro-tabs {
          display: flex;
          gap: 0.25rem;
          background: var(--bg-subtle);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 3px;
        }

        .filtro-tab {
          padding: 0.375rem 0.75rem;
          border-radius: 6px;
          border: none;
          background: none;
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          font-family: var(--font-sans);
          transition: background 150ms var(--ease-out), color 150ms;
        }

        .filtro-tab:hover { color: var(--text); }
        .filtro-tab.active {
          background: var(--surface);
          color: var(--text);
          box-shadow: var(--shadow-sm);
        }

        .patient-link {
          color: var(--text);
          text-decoration: none;
          transition: color 150ms var(--ease-out);
        }

        .patient-link:hover {
          color: var(--accent);
        }

        .icon-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 120ms;
        }

        .icon-btn:hover {
          background: var(--surface-hover);
          color: var(--text);
          border-color: var(--border-strong);
        }

        .icon-btn.danger:hover {
          background: var(--red-muted);
          color: #ef4444;
          border-color: #ef4444;
        }

        .icon-btn.save:hover {
          background: var(--red-muted);
          color: #05f805ff;
          border-color: #05f805ff;
        }

        .skeleton-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }

        @media (max-width: 900px) {
          .form-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 600px) {
          .form-grid { grid-template-columns: 1fr; }
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }

        .req { color: #ef4444; }

        .btn-page {
          min-width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.6875rem;
          font-family: var(--font-mono);
          cursor: pointer;
          transition: all 150ms;
        }

        .btn-page.disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .btn-page:not(.disabled, .active):hover {
          background: var(--surface-hover);
          border-color: var(--border-strong);
        }

        .btn-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 600ms linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
