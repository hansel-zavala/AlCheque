"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Plus, Trash2, Users, Tag, Folder, Sun, Moon, Monitor, Check, ShieldAlert, Calendar, Pencil } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useCentro } from "@/context/CentroContext";
import { useTheme } from "@/context/ThemeContext";
import { Pagination, usePagination } from "@/components/shared/Pagination";
import {
  centroSchema, servicioSchema, categoriaSchema, terapeutaSchema,
  type CentroFormData, type ServicioFormData, type CategoriaFormData, type TerapeutaFormData
} from "@/types/forms";
import type { Servicio, Categoria, Terapeuta } from "@/types/database";

type Tab = "centro" | "servicios" | "categorias" | "terapeutas" | "apariencia";
type ServicioConCategoria = Servicio & { categorias?: Pick<Categoria, "id" | "nombre"> | null };
type CategoriaConParent = Categoria & { parent?: Pick<Categoria, "id" | "nombre"> | null };

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "centro", label: "Datos del centro", icon: Building2 },
  { id: "servicios", label: "Servicios y planes", icon: Tag },
  { id: "categorias", label: "Categorías", icon: Folder },
  { id: "terapeutas", label: "Terapeutas", icon: Users },
  { id: "apariencia", label: "Apariencia", icon: Monitor },
];

export default function ConfiguracionPage() {
  const { centroActivo, refetch: refetchCentros } = useCentro();
  const { theme, setTheme } = useTheme();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("centro");
  const [showServicioForm, setShowServicioForm] = useState(false);
  const [showTerapeutaForm, setShowTerapeutaForm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingServicioId, setEditingServicioId] = useState<string | null>(null);
  const [editingTerapeutaId, setEditingTerapeutaId] = useState<string | null>(null);

  // Estados locales para los toggles de prueba del sistema
  const [bloquearPeriodo, setBloquearPeriodo] = useState(false);
  const [fechaCierre, setFechaCierre] = useState("2026-05-31");
  const [alertaPresupuesto, setAlertaPresupuesto] = useState(true);

  const centroId = centroActivo?.id;

  // ── Datos del centro ──────────────────────────────────────────
  const centroForm = useForm<CentroFormData>({
    resolver: zodResolver(centroSchema),
    values: centroActivo
      ? {
          nombre: centroActivo.nombre,
          telefono: centroActivo.telefono ?? "",
          email_contacto: centroActivo.email_contacto ?? "",
          direccion: centroActivo.direccion ?? "",
          descripcion: centroActivo.descripcion ?? "",
        }
      : undefined,
  });

  const updateCentroMutation = useMutation({
    mutationFn: async (data: CentroFormData) => {
      if (!centroId) throw new Error();
      const { error } = await supabase
        .from("centros")
        .update({
          nombre: data.nombre,
          telefono: data.telefono || null,
          email_contacto: data.email_contacto || null,
          direccion: data.direccion || null,
          descripcion: data.descripcion || null,
        })
        .eq("id", centroId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refetchCentros();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  // ── Servicios ─────────────────────────────────────────────────
  const { data: servicios = [] } = useQuery({
    queryKey: ["servicios", centroId],
    queryFn: async () => {
      if (!centroId) return [];
      const { data } = await supabase
        .from("servicios")
        .select("*, categorias(id, nombre)")
        .eq("centro_id", centroId)
        .is("deleted_at", null)
        .order("nombre");
      return (data ?? []) as unknown as ServicioConCategoria[];
    },
    enabled: !!centroId,
  });

  const serviciosPagination = usePagination({
    items: servicios,
    storageKey: "pagination:configuracion-servicios",
    resetKey: `${centroId ?? ""}:${activeTab}`,
  });

  const servicioForm = useForm<ServicioFormData>({
    resolver: zodResolver(servicioSchema),
    defaultValues: { nombre: "", servicio: "", categoria_id: "", precio: "", activo: true },
  });

  const createServicioMutation = useMutation({
    mutationFn: async (data: ServicioFormData) => {
      if (!centroId) throw new Error();
      const { error } = await supabase.from("servicios").insert({
        centro_id: centroId,
        nombre: data.nombre,
        servicio: data.servicio,
        categoria_id: data.categoria_id,
        precio: data.precio ? parseFloat(data.precio) : null,
        activo: data.activo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servicios"] });
      servicioForm.reset();
      setShowServicioForm(false);
    },
  });

  const updateServicioMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ServicioFormData }) => {
      if (!centroId) throw new Error();
      const { error } = await supabase
        .from("servicios")
        .update({
          nombre: data.nombre,
          servicio: data.servicio,
          categoria_id: data.categoria_id,
          precio: data.precio ? parseFloat(data.precio) : null,
          activo: data.activo,
        })
          .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servicios"] });
      servicioForm.reset();
      setEditingServicioId(null);
      setShowServicioForm(false);
    },
  });

  const deleteServicioMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("servicios")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["servicios"] }),
  });

  // ── Categorías ────────────────────────────────────────────────
  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias", centroId],
    queryFn: async () => {
      if (!centroId) return [];
      const { data } = await supabase
        .from("categorias")
        .select("*, parent:parent_id(id, nombre)")
        .eq("centro_id", centroId)
        .is("deleted_at", null)
        .order("tipo")
        .order("nombre");
      return (data ?? []) as unknown as CategoriaConParent[];
    },
    enabled: !!centroId,
  });

  const categoriasPagination = usePagination({
    items: categorias,
    storageKey: "pagination:configuracion-categorias",
    resetKey: `${centroId ?? ""}:${activeTab}`,
  });

  const [showCategoriaForm, setShowCategoriaForm] = useState(false);
  const [editingCategoriaId, setEditingCategoriaId] = useState<string | null>(null);

  const categoriaForm = useForm<CategoriaFormData>({
    resolver: zodResolver(categoriaSchema),
    defaultValues: { nombre: "", tipo: "egreso", parent_id: "", activo: true },
  });

  const watchTipo = categoriaForm.watch("tipo") || "egreso";

  const createCategoriaMutation = useMutation({
    mutationFn: async (data: CategoriaFormData) => {
      if (!centroId) throw new Error();
      const { error } = await supabase.from("categorias").insert({
        centro_id: centroId,
        nombre: data.nombre,
        tipo: data.tipo,
        parent_id: data.parent_id || null,
        activo: data.activo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
      categoriaForm.reset();
      setShowCategoriaForm(false);
    },
  });

  const updateCategoriaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CategoriaFormData }) => {
      if (!centroId) throw new Error();
      const { error } = await supabase
        .from("categorias")
        .update({
          nombre: data.nombre,
          tipo: data.tipo,
          parent_id: data.parent_id || null,
          activo: data.activo,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
      categoriaForm.reset();
      setEditingCategoriaId(null);
      setShowCategoriaForm(false);
    },
  });

  const deleteCategoriaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("categorias")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
    },
  });

  // ── Terapeutas ────────────────────────────────────────────────
  const { data: terapeutas = [] } = useQuery({
    queryKey: ["terapeutas", centroId],
    queryFn: async () => {
      if (!centroId) return [];
      const { data } = await supabase
        .from("terapeutas")
        .select("*")
        .eq("centro_id", centroId)
        .is("deleted_at", null)
        .order("nombre_completo");
      return (data ?? []) as Terapeuta[];
    },
    enabled: !!centroId,
  });

  const terapeutasPagination = usePagination({
    items: terapeutas,
    storageKey: "pagination:configuracion-terapeutas",
    resetKey: `${centroId ?? ""}:${activeTab}`,
  });

  const terapeutaForm = useForm<TerapeutaFormData>({
    resolver: zodResolver(terapeutaSchema),
    defaultValues: { activo: true },
  });

  const createTerapeutaMutation = useMutation({
    mutationFn: async (data: TerapeutaFormData) => {
      if (!centroId) throw new Error();
      const { error } = await supabase.from("terapeutas").insert({
        centro_id: centroId,
        nombre_completo: data.nombre_completo,
        especialidad: data.especialidad || null,
        telefono: data.telefono || null,
        email: data.email || null,
        activo: data.activo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terapeutas"] });
      terapeutaForm.reset();
      setShowTerapeutaForm(false);
    },
  });

  const updateTerapeutaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TerapeutaFormData }) => {
      if (!centroId) throw new Error();
      const { error } = await supabase
        .from("terapeutas")
        .update({
          nombre_completo: data.nombre_completo,
          especialidad: data.especialidad || null,
          telefono: data.telefono || null,
          email: data.email || null,
          activo: data.activo,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terapeutas"] });
      terapeutaForm.reset();
      setEditingTerapeutaId(null);
      setShowTerapeutaForm(false);
    },
  });

  const deleteTerapeutaMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("terapeutas")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["terapeutas"] }),
  });

  return (
    <div className="page animate-fade-in-up">
      {/* Head */}
      <div>
        <h1 className="page-title text-3xl font-extrabold tracking-tight">Configuración</h1>
        <p className="page-sub text-sm text-[var(--text-muted)] mt-1">Gestiona los datos y preferencias del centro</p>
      </div>

      {/* Tabs Layout Slider */}
      <div className="tabs mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab btn-pressable ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            id={`config-tab-${tab.id}`}
          >
            <tab.icon size={15} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Panel: Centro */}
      {activeTab === "centro" && (
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        >
          {/* Col 1: Visual Profile Card */}
          <div className="flex flex-col gap-6">
            <div className="profile-card glass-card text-center flex flex-col items-center p-6 relative overflow-hidden">
              <div className="avatar-wrap mb-4">
                <Building2 size={36} className="text-[var(--accent)]" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">
                {centroActivo?.nombre ?? "Centro Activo"}
              </h2>
              <span className="badge badge-green text-[10px] font-bold mt-2">
                Suscripción Activa
              </span>
              
              <div className="w-full border-t border-[var(--border)] my-5" />

              <div className="w-full grid grid-cols-2 gap-4">
                <div className="stat-box">
                  <span className="stat-label">Terapeutas</span>
                  <span className="stat-val">{terapeutas.length}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Servicios</span>
                  <span className="stat-val">{servicios.length}</span>
                </div>
              </div>
            </div>

            {/* Warning / Alerts Block (Image 1 style) */}
            <div className="warning-panel glass-card p-5 border border-red-500/10">
              <div className="flex gap-3 items-start">
                <div className="warning-icon-box text-red-400 mt-0.5">
                  <ShieldAlert size={18} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-[var(--text)]">Ajustes de Seguridad</h4>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Configura las restricciones de modificación de datos y límites financieros.
                  </p>
                </div>
              </div>

              <div className="w-full border-t border-[var(--border)] my-4" />

              {/* Lock Switch */}
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <span className="text-xs font-bold block text-[var(--text)]">Bloqueo de Registro Histórico</span>
                  <span className="text-[10px] text-[var(--text-subtle)]">Previene modificar transacciones previas</span>
                </div>
                <button
                  type="button"
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center ${bloquearPeriodo ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"}`}
                  onClick={() => setBloquearPeriodo(!bloquearPeriodo)}
                >
                  <span className={`absolute w-5 h-5 rounded-full bg-white transition-transform ${bloquearPeriodo ? "translate-x-5.5" : "translate-x-0.5"}`} />
                </button>
              </div>

              {bloquearPeriodo && (
                <motion.div
                  className="period-lock-date mb-4"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                >
                  <label className="form-label" htmlFor="fecha-cierre-input">Bloquear antes del:</label>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-3 top-3 text-[var(--text-subtle)]" />
                    <input
                      id="fecha-cierre-input"
                      type="date"
                      className="form-input pl-9"
                      value={fechaCierre}
                      onChange={(e) => setFechaCierre(e.target.value)}
                    />
                  </div>
                </motion.div>
              )}

              {/* Budget Alert Switch */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold block text-[var(--text)]">Alerta de Gastos Mensuales</span>
                  <span className="text-[10px] text-[var(--text-subtle)]">Notificar si egresos superan presupuesto</span>
                </div>
                <button
                  type="button"
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center ${alertaPresupuesto ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"}`}
                  onClick={() => setAlertaPresupuesto(!alertaPresupuesto)}
                >
                  <span className={`absolute w-5 h-5 rounded-full bg-white transition-transform ${alertaPresupuesto ? "translate-x-5.5" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Col 2-3: Editable Form fields */}
          <div className="lg:col-span-2">
            <div className="config-card glass-card p-6 h-full flex flex-col justify-between">
              <div>
                <h3 className="config-card-title text-base font-extrabold tracking-tight mb-4">Datos del centro</h3>
                <form
                  onSubmit={centroForm.handleSubmit((d) => updateCentroMutation.mutate(d))}
                  noValidate
                >
                  <div className="form-grid">
                    <div className="form-group span-full">
                      <label className="form-label" htmlFor="centro-nombre">
                        Nombre del centro <span className="req">*</span>
                      </label>
                      <input
                        id="centro-nombre"
                        type="text"
                        className={`form-input ${centroForm.formState.errors.nombre ? "error" : ""}`}
                        {...centroForm.register("nombre")}
                      />
                      {centroForm.formState.errors.nombre && (
                        <p className="form-error">{centroForm.formState.errors.nombre.message}</p>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="centro-tel">Teléfono</label>
                      <input id="centro-tel" type="tel" className="form-input" {...centroForm.register("telefono")} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="centro-email">Correo de contacto</label>
                      <input
                        id="centro-email"
                        type="email"
                        className={`form-input ${centroForm.formState.errors.email_contacto ? "error" : ""}`}
                        {...centroForm.register("email_contacto")}
                      />
                    </div>
                    <div className="form-group span-full">
                      <label className="form-label" htmlFor="centro-dir">Dirección</label>
                      <input id="centro-dir" type="text" className="form-input" {...centroForm.register("direccion")} />
                    </div>
                    <div className="form-group span-full">
                      <label className="form-label" htmlFor="centro-desc">Descripción</label>
                      <textarea
                        id="centro-desc"
                        className="form-input form-textarea"
                        rows={4}
                        {...centroForm.register("descripcion")}
                      />
                    </div>
                  </div>
                  
                  <div className="form-actions mt-6">
                    <button type="submit" className="btn-primary btn-pressable px-6 py-2.5 rounded-xl font-bold uppercase text-xs tracking-wider" disabled={updateCentroMutation.isPending}>
                      {updateCentroMutation.isPending ? (
                        <span className="btn-spinner" />
                      ) : saved ? (
                        <><Check size={15} /> Guardado</>
                      ) : (
                        "Guardar cambios"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Panel: Servicios */}
      {activeTab === "servicios" && (
        <motion.div
          className="config-card glass-card p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="config-card-head flex items-center justify-between mb-5">
            <h2 className="config-card-title text-base font-extrabold tracking-tight m-0">Servicios y planes</h2>
            <button
              className="btn-primary btn-pressable flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider"
              onClick={() => {
                if (showServicioForm) {
                  servicioForm.reset();
                  setEditingServicioId(null);
                }
                setShowServicioForm(!showServicioForm);
              }}
            >
              <Plus size={14} />
              <span>{showServicioForm ? "Cancelar" : "Agregar"}</span>
            </button>
          </div>

          <AnimatePresence>
            {showServicioForm && (
              <motion.div
                className="inline-form border border-[var(--border)] rounded-xl p-4 bg-[var(--bg-subtle)] mb-5"
                initial={{ opacity: 0, height: 0, overflow: "hidden" }}
                animate={{ opacity: 1, height: "auto", overflow: "visible" }}
                exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                transition={{ duration: 0.25 }}
              >
                <form onSubmit={servicioForm.handleSubmit((d) => {
                  if (editingServicioId) {
                    updateServicioMutation.mutate({ id: editingServicioId, data: d });
                  } else {
                    createServicioMutation.mutate(d);
                  }
                })} noValidate>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label" htmlFor="srv-nombre">Nombre del Plan/Servicio <span className="req">*</span></label>
                      <input id="srv-nombre" type="text" className={`form-input ${servicioForm.formState.errors.nombre ? "error" : ""}`} placeholder="Ej. Plan Básico" {...servicioForm.register("nombre")} />
                      {servicioForm.formState.errors.nombre && <p className="form-error">{servicioForm.formState.errors.nombre.message}</p>}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="srv-servicio">Clasificación <span className="req">*</span></label>
                      <input id="srv-servicio" type="text" className={`form-input ${servicioForm.formState.errors.servicio ? "error" : ""}`} placeholder="Ej. Sesiones, Mensualidades..." {...servicioForm.register("servicio")} />
                      {servicioForm.formState.errors.servicio && <p className="form-error">{servicioForm.formState.errors.servicio.message}</p>}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="srv-cat-id">Categoría Financiera (Ingreso) <span className="req">*</span></label>
                      <select id="srv-cat-id" className={`form-input form-select ${servicioForm.formState.errors.categoria_id ? "error" : ""}`} {...servicioForm.register("categoria_id")}>
                        <option value="">Seleccionar...</option>
                        {categorias.filter(c => c.tipo === "ingreso").map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                      {servicioForm.formState.errors.categoria_id && <p className="form-error">{servicioForm.formState.errors.categoria_id.message}</p>}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="srv-precio">Precio base (L)</label>
                      <input
                        id="srv-precio"
                        type="text"
                        inputMode="decimal"
                        className="form-input"
                        placeholder="0.00"
                        onKeyDown={(e) => {
                          if (!/[\d.,]/.test(e.key) && !["Backspace","Tab","ArrowLeft","ArrowRight","Delete"].includes(e.key)) e.preventDefault();
                        }}
                        {...servicioForm.register("precio")}
                      />
                    </div>
                  </div>
                  <div className="form-actions mt-4">
                    <button type="submit" className="btn-primary btn-pressable px-4 py-2 text-sm font-semibold rounded-lg" disabled={createServicioMutation.isPending || updateServicioMutation.isPending}>
                      {createServicioMutation.isPending || updateServicioMutation.isPending ? (
                        <span className="btn-spinner" />
                      ) : editingServicioId ? (
                        "Actualizar"
                      ) : (
                        "Guardar"
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="items-list flex flex-col gap-2">
            {servicios.length === 0 ? (
              <p className="items-empty text-center p-8 text-sm text-[var(--text-subtle)] font-medium">No hay servicios configurados</p>
            ) : (
              serviciosPagination.paginatedItems.map((s) => (
                <div key={s.id} className="item-row flex items-center justify-between p-3 border border-[var(--border)] rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] transition-all">
                  <div className="item-info">
                    <span className="item-name text-sm font-semibold text-[var(--text)]">{s.nombre}</span>
                    <span className="item-meta text-xs text-[var(--text-muted)] block mt-0.5">
                      {s.servicio} {s.categorias ? `• Categoría: ${s.categorias.nombre}` : ""}
                    </span>
                  </div>
                  <div className="item-right flex items-center gap-3">
                    {s.precio && (
                      <span className="item-price text-sm font-bold font-mono text-[var(--accent)]">L {s.precio.toFixed(2)}</span>
                    )}
                    <button
                      className="icon-btn btn-pressable"
                      onClick={() => {
                        setEditingServicioId(s.id);
                        servicioForm.reset({
                          nombre: s.nombre,
                          servicio: s.servicio,
                          categoria_id: s.categoria_id || "",
                          precio: s.precio ? s.precio.toString() : "",
                          activo: s.activo,
                        });
                        setShowServicioForm(true);
                      }}
                      aria-label="Editar servicio"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="icon-btn danger btn-pressable"
                      onClick={() => {
                        if (confirm("¿Eliminar este servicio?")) deleteServicioMutation.mutate(s.id);
                      }}
                      aria-label="Eliminar servicio"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <Pagination
            totalItems={servicios.length}
            page={serviciosPagination.page}
            pageSize={serviciosPagination.pageSize}
            totalPages={serviciosPagination.totalPages}
            itemLabel="servicios"
            onPageChange={serviciosPagination.setPage}
            onPageSizeChange={serviciosPagination.setPageSize}
          />
        </motion.div>
      )}

      {/* Panel: Categorías */}
      {activeTab === "categorias" && (
        <motion.div
          className="config-card glass-card p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="config-card-head flex items-center justify-between mb-5">
            <h2 className="config-card-title text-base font-extrabold tracking-tight m-0">Categorías de Ingreso y Egreso</h2>
            <button
              className="btn-primary btn-pressable flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider"
              onClick={() => {
                if (showCategoriaForm) {
                  categoriaForm.reset();
                  setEditingCategoriaId(null);
                }
                setShowCategoriaForm(!showCategoriaForm);
              }}
            >
              <Plus size={14} />
              <span>{showCategoriaForm ? "Cancelar" : "Agregar"}</span>
            </button>
          </div>

          <AnimatePresence>
            {showCategoriaForm && (
              <motion.div
                className="inline-form border border-[var(--border)] rounded-xl p-4 bg-[var(--bg-subtle)] mb-5"
                initial={{ opacity: 0, height: 0, overflow: "hidden" }}
                animate={{ opacity: 1, height: "auto", overflow: "visible" }}
                exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                transition={{ duration: 0.25 }}
              >
                <form onSubmit={categoriaForm.handleSubmit((d) => {
                  if (editingCategoriaId) {
                    updateCategoriaMutation.mutate({ id: editingCategoriaId, data: d });
                  } else {
                    createCategoriaMutation.mutate(d);
                  }
                })} noValidate>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label" htmlFor="cat-nombre">Nombre de la Categoría <span className="req">*</span></label>
                      <input id="cat-nombre" type="text" className={`form-input ${categoriaForm.formState.errors.nombre ? "error" : ""}`} placeholder="Ej. Suscripciones, Nómina" {...categoriaForm.register("nombre")} />
                      {categoriaForm.formState.errors.nombre && <p className="form-error">{categoriaForm.formState.errors.nombre.message}</p>}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="cat-tipo">Tipo <span className="req">*</span></label>
                      <select id="cat-tipo" className="form-input form-select" {...categoriaForm.register("tipo")}>
                        <option value="egreso">Egreso (Gasto)</option>
                        <option value="ingreso">Ingreso</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="cat-parent">Categoría Padre (Opcional)</label>
                      <select id="cat-parent" className="form-input form-select" {...categoriaForm.register("parent_id")}>
                        <option value="">Ninguna (Categoría Principal)</option>
                        {categorias
                          .filter((c) => c.tipo === watchTipo && !c.parent_id && c.id !== editingCategoriaId)
                          .map((c) => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))
                        }
                      </select>
                    </div>
                  </div>
                  <div className="form-actions mt-4">
                    <button type="submit" className="btn-primary btn-pressable px-4 py-2 text-sm font-semibold rounded-lg" disabled={createCategoriaMutation.isPending || updateCategoriaMutation.isPending}>
                      {createCategoriaMutation.isPending || updateCategoriaMutation.isPending ? (
                        <span className="btn-spinner" />
                      ) : editingCategoriaId ? (
                        "Actualizar"
                      ) : (
                        "Guardar"
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="items-list flex flex-col gap-2">
            {categorias.length === 0 ? (
              <p className="items-empty text-center p-8 text-sm text-[var(--text-subtle)] font-medium">No hay categorías configuradas</p>
            ) : (
              categoriasPagination.paginatedItems.map((c) => (
                <div key={c.id} className="item-row flex items-center justify-between p-3 border border-[var(--border)] rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] transition-all">
                  <div className="item-info">
                    <span className="item-name text-sm font-semibold text-[var(--text)]">{c.nombre}</span>
                    {c.parent && (
                      <span className="item-meta text-xs text-[var(--text-muted)] block mt-0.5">
                        Subcategoría de: <strong className="text-[var(--text)]">{c.parent.nombre}</strong>
                      </span>
                    )}
                  </div>
                  <div className="item-right flex items-center gap-3">
                    <span className={`badge ${c.tipo === "ingreso" ? "badge-green" : "badge-red"}`}>
                      {c.tipo === "ingreso" ? "Ingreso" : "Egreso"}
                    </span>
                    <button
                      className="icon-btn btn-pressable"
                      onClick={() => {
                        setEditingCategoriaId(c.id);
                        categoriaForm.reset({
                          nombre: c.nombre,
                          tipo: c.tipo,
                          parent_id: c.parent_id || "",
                          activo: c.activo,
                        });
                        setShowCategoriaForm(true);
                      }}
                      aria-label="Editar categoría"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="icon-btn danger btn-pressable"
                      onClick={() => {
                        if (confirm("¿Eliminar esta categoría?")) deleteCategoriaMutation.mutate(c.id);
                      }}
                      aria-label="Eliminar categoría"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <Pagination
            totalItems={categorias.length}
            page={categoriasPagination.page}
            pageSize={categoriasPagination.pageSize}
            totalPages={categoriasPagination.totalPages}
            itemLabel="categorías"
            onPageChange={categoriasPagination.setPage}
            onPageSizeChange={categoriasPagination.setPageSize}
          />
        </motion.div>
      )}

      {/* Panel: Terapeutas */}
      {activeTab === "terapeutas" && (
        <motion.div
          className="config-card glass-card p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="config-card-head flex items-center justify-between mb-5">
            <h2 className="config-card-title text-base font-extrabold tracking-tight m-0">Terapeutas</h2>
            <button
              className="btn-primary btn-pressable flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider"
              onClick={() => {
                if (showTerapeutaForm) {
                  terapeutaForm.reset();
                  setEditingTerapeutaId(null);
                }
                setShowTerapeutaForm(!showTerapeutaForm);
              }}
            >
              <Plus size={14} />
              <span>{showTerapeutaForm ? "Cancelar" : "Agregar"}</span>
            </button>
          </div>

          <AnimatePresence>
            {showTerapeutaForm && (
              <motion.div
                className="inline-form border border-[var(--border)] rounded-xl p-4 bg-[var(--bg-subtle)] mb-5"
                initial={{ opacity: 0, height: 0, overflow: "hidden" }}
                animate={{ opacity: 1, height: "auto", overflow: "visible" }}
                exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                transition={{ duration: 0.25 }}
              >
                <form onSubmit={terapeutaForm.handleSubmit((d) => {
                  if (editingTerapeutaId) {
                    updateTerapeutaMutation.mutate({ id: editingTerapeutaId, data: d });
                  } else {
                    createTerapeutaMutation.mutate(d);
                  }
                })} noValidate>
                  <div className="form-grid">
                    <div className="form-group span-full">
                      <label className="form-label" htmlFor="ter-nombre">Nombre completo <span className="req">*</span></label>
                      <input id="ter-nombre" type="text" className={`form-input ${terapeutaForm.formState.errors.nombre_completo ? "error" : ""}`} {...terapeutaForm.register("nombre_completo")} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="ter-esp">Especialidad</label>
                      <input id="ter-esp" type="text" className="form-input" {...terapeutaForm.register("especialidad")} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="ter-tel">Teléfono</label>
                      <input id="ter-tel" type="tel" className="form-input" {...terapeutaForm.register("telefono")} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="ter-email">Correo</label>
                      <input id="ter-email" type="email" className={`form-input ${terapeutaForm.formState.errors.email ? "error" : ""}`} {...terapeutaForm.register("email")} />
                    </div>
                  </div>
                  <div className="form-actions mt-4">
                    <button type="submit" className="btn-primary btn-pressable px-4 py-2 text-sm font-semibold rounded-lg" disabled={createTerapeutaMutation.isPending || updateTerapeutaMutation.isPending}>
                      {createTerapeutaMutation.isPending || updateTerapeutaMutation.isPending ? (
                        <span className="btn-spinner" />
                      ) : editingTerapeutaId ? (
                        "Actualizar"
                      ) : (
                        "Guardar"
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="items-list flex flex-col gap-2">
            {terapeutas.length === 0 ? (
              <p className="items-empty text-center p-8 text-sm text-[var(--text-subtle)] font-medium">No hay terapeutas registrados</p>
            ) : (
              terapeutasPagination.paginatedItems.map((t) => (
                <div key={t.id} className="item-row flex items-center justify-between p-3 border border-[var(--border)] rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] transition-all">
                  <div className="flex items-center gap-3">
                    <div className="ter-avatar w-10 h-10 rounded-full font-bold flex items-center justify-center text-sm bg-[var(--accent-muted)] text-[var(--accent)] border border-[var(--border)]">
                      {t.nombre_completo.charAt(0).toUpperCase()}
                    </div>
                    <div className="item-info">
                      <span className="item-name text-sm font-semibold text-[var(--text)]">{t.nombre_completo}</span>
                      <span className="item-meta text-xs text-[var(--text-muted)] block mt-0.5">{t.especialidad ?? "Sin especialidad"}</span>
                    </div>
                  </div>
                  <div className="item-right flex items-center gap-3">
                    <span className={`badge ${t.activo ? "badge-green" : "badge-muted"}`}>
                      {t.activo ? "Activo" : "Inactivo"}
                    </span>
                    <button
                      className="icon-btn btn-pressable"
                      onClick={() => {
                        setEditingTerapeutaId(t.id);
                        terapeutaForm.reset({
                          nombre_completo: t.nombre_completo,
                          especialidad: t.especialidad || "",
                          telefono: t.telefono || "",
                          email: t.email || "",
                          activo: t.activo,
                        });
                        setShowTerapeutaForm(true);
                      }}
                      aria-label="Editar terapeuta"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="icon-btn danger btn-pressable"
                      onClick={() => {
                        if (confirm("¿Eliminar este terapeuta?")) deleteTerapeutaMutation.mutate(t.id);
                      }}
                      aria-label="Eliminar terapeuta"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <Pagination
            totalItems={terapeutas.length}
            page={terapeutasPagination.page}
            pageSize={terapeutasPagination.pageSize}
            totalPages={terapeutasPagination.totalPages}
            itemLabel="terapeutas"
            onPageChange={terapeutasPagination.setPage}
            onPageSizeChange={terapeutasPagination.setPageSize}
          />
        </motion.div>
      )}

      {/* Panel: Apariencia */}
      {activeTab === "apariencia" && (
        <motion.div
          className="config-card glass-card p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        >
          <h2 className="config-card-title text-base font-extrabold tracking-tight mb-4">Apariencia</h2>

          <div className="theme-section">
            <p className="theme-label text-sm text-[var(--text-muted)] font-medium mb-3">Tema de la interfaz</p>
            <div className="theme-options flex gap-4 flex-wrap">
              {[
                { value: "dark" as const, label: "Oscuro", icon: Moon },
                { value: "light" as const, label: "Claro", icon: Sun },
              ].map((opt) => (
                <button
                  key={opt.value}
                  id={`theme-${opt.value}-btn`}
                  className={`theme-option btn-pressable flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all min-width-[140px] relative ${theme === opt.value ? "border-[var(--accent)] bg-[var(--accent-muted)]" : "border-[var(--border)] bg-[var(--bg-subtle)]"}`}
                  onClick={() => setTheme(opt.value)}
                >
                  <div className="theme-preview w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--accent-muted)] text-[var(--accent)]">
                    <opt.icon size={20} />
                  </div>
                  <span className="theme-opt-label text-sm font-bold text-[var(--text)]">{opt.label}</span>
                  {theme === opt.value && (
                    <div className="theme-check absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] flex items-center justify-center text-[10px]">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <style jsx>{`
        .page { display: flex; flex-direction: column; gap: 1.5rem; max-width: 1600px; }
        .page-title { color: var(--text); letter-spacing: -0.025em; }

        .tabs {
          display: flex; gap: 0.25rem;
          background: var(--bg-subtle); border: 1px solid var(--border);
          border-radius: 12px; padding: 4px; flex-wrap: wrap;
        }

        .tab {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.625rem 1rem; border-radius: 10px;
          border: none; background: none; font-size: 0.8125rem;
          font-weight: 700; color: var(--text-muted); cursor: pointer;
          font-family: var(--font-sans);
          transition: background 150ms, color 150ms, transform 160ms var(--ease-out);
          white-space: nowrap;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .tab:hover { color: var(--text); }
        .tab.active { background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); }

        .avatar-wrap {
          width: 72px; height: 72px; border-radius: 20px;
          background: var(--accent-muted);
          border: 1px solid var(--border);
          display: flex; items-center; justify-content: center;
          align-items: center;
          box-shadow: 0 4px 14px rgba(78, 222, 163, 0.15);
        }

        .stat-box {
          background: var(--bg-subtle);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 0.75rem;
          display: flex; flex-direction: column; gap: 0.25rem;
        }
        .stat-label { font-size: 9px; font-family: var(--font-mono); font-weight: 700; color: var(--text-subtle); text-transform: uppercase; letter-spacing: 0.05em; }
        .stat-val { font-size: 1.25rem; font-weight: 800; font-family: var(--font-mono); color: var(--accent); }

        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; }
        .span-full { grid-column: 1 / -1; }
        .req { color: var(--red); }
        .form-textarea { resize: vertical; min-height: 80px; }
        .form-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.75rem center;
          padding-right: 2.5rem;
        }
        .form-actions { display: flex; justify-content: flex-end; padding-top: 1rem; border-top: 1px solid var(--border); }

        .icon-btn {
          width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border);
          background: none; color: var(--text-muted); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 120ms, color 120ms, border-color 120ms;
        }
        .icon-btn:hover { background: var(--surface-hover); color: var(--text); border-color: var(--border-strong); }
        .icon-btn.danger:hover { background: var(--red-muted); color: var(--red); border-color: var(--red); }

        .btn-spinner {
          width: 16px; height: 16px;
          border: 2px solid oklch(1 0 0 / 0.3); border-top-color: white;
          border-radius: 50%; animation: spin 600ms linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
