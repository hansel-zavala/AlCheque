"use client";

import { useState, useEffect, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Eye, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, X, Pencil } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { createClient } from "@/lib/supabase/client";
import { useCentro } from "@/context/CentroContext";
import { transaccionSchema, type TransaccionFormData } from "@/types/forms";
import { formatHNL } from "@/utils/currency";
import { formatFechaCorta } from "@/utils/dates";
import { FileUploader } from "@/components/transacciones/FileUploader";
import { Pagination, usePagination } from "@/components/shared/Pagination";
import type { TransaccionConRelaciones, Servicio, Categoria, Paciente } from "@/types/database";

type CategoriaConParent = Categoria & {
  parent?: Pick<Categoria, "id" | "nombre"> | null;
};

function TransaccionesContent() {
  const { centroActivo } = useCentro();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "ingreso" | "egreso">("todos");
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [showNuevaCategoriaForm, setShowNuevaCategoriaForm] = useState(false);
  const [nuevaCatNombre, setNuevaCatNombre] = useState("");

  const createCategoriaRapidaMutation = useMutation({
    mutationFn: async () => {
      if (!centroId) throw new Error();
      if (!nuevaCatNombre) throw new Error("Nombre requerido");
      
      const { data, error } = await supabase
        .from("categorias")
        .insert({
          centro_id: centroId,
          nombre: nuevaCatNombre,
          tipo: tipoSeleccionado,
          parent_id: null,
          activo: true,
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
      
      if (data && data.id) {
        setValue("categoria_id", data.id);
      }
      
      setNuevaCatNombre("");
      setShowNuevaCategoriaForm(false);
    },
  });

  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("new") === "true") {
      setShowForm(true);
    }
  }, [searchParams]);

  const centroId = centroActivo?.id;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<TransaccionFormData>({
    resolver: zodResolver(transaccionSchema),
    defaultValues: {
      tipo: "ingreso",
      fecha: new Date().toISOString().split("T")[0],
    },
  });

  const tipoSeleccionado = watch("tipo");
  const servicioSeleccionadoId = watch("servicio_id");

  // Queries
  const { data: transacciones = [], isLoading } = useQuery({
    queryKey: ["transacciones", centroId, filtroTipo],
    queryFn: async () => {
      if (!centroId) return [];
      let q = supabase
        .from("transacciones")
        .select("*, servicios(id,nombre,servicio,categoria_id), categorias(id,nombre,tipo,parent_id,parent:parent_id(id,nombre)), pacientes(id,nombre_completo), terapeutas(id,nombre_completo)")
        .eq("centro_id", centroId)
        .is("deleted_at", null)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });
      if (filtroTipo !== "todos") q = q.eq("tipo", filtroTipo);
      const { data } = await q;
      return (data ?? []) as unknown as TransaccionConRelaciones[];
    },
    enabled: !!centroId,
  });

  const transaccionesPagination = usePagination({
    items: transacciones,
    storageKey: "pagination:transacciones",
    resetKey: `${centroId ?? ""}:${filtroTipo}`,
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias", centroId],
    queryFn: async () => {
      if (!centroId) return [];
      const { data } = await supabase
        .from("categorias")
        .select("*, parent:parent_id(id, nombre)")
        .eq("centro_id", centroId)
        .eq("activo", true)
        .is("deleted_at", null)
        .order("nombre");
      return (data ?? []) as unknown as CategoriaConParent[];
    },
    enabled: !!centroId,
  });

  const { data: servicios = [] } = useQuery({
    queryKey: ["servicios", centroId],
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

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-select", centroId],
    queryFn: async () => {
      if (!centroId) return [];
      const { data } = await supabase
        .from("pacientes")
        .select("id, nombre_completo")
        .eq("centro_id", centroId)
        .eq("estado_suscripcion", "activo")
        .is("deleted_at", null)
        .order("nombre_completo");
      return (data ?? []) as Pick<Paciente, "id" | "nombre_completo">[];
    },
    enabled: !!centroId,
  });

  // Autocompletar monto y categoría al seleccionar servicio/plan
  useEffect(() => {
    if (servicioSeleccionadoId) {
      const servicio = servicios.find((s) => s.id === servicioSeleccionadoId);
      if (servicio) {
        if (servicio.precio !== null && servicio.precio !== undefined) {
          setValue("monto", servicio.precio.toString(), { shouldValidate: true });
        }
        if (servicio.categoria_id) {
          setValue("categoria_id", servicio.categoria_id, { shouldValidate: true });
        }
      }
    }
  }, [servicioSeleccionadoId, servicios, setValue]);

  const createMutation = useMutation({
    mutationFn: async (data: TransaccionFormData) => {
      if (!centroId) throw new Error("Sin centro activo");
      
      let catId = data.categoria_id || null;
      if (data.tipo === "ingreso" && data.servicio_id) {
        const sObj = servicios.find((s) => s.id === data.servicio_id);
        if (sObj && sObj.categoria_id) {
          catId = sObj.categoria_id;
        }
      }

      const { error } = await supabase.from("transacciones").insert({
        centro_id: centroId,
        tipo: data.tipo,
        monto: parseFloat(data.monto),
        metodo_pago: data.metodo_pago,
        fecha: data.fecha,
        servicio_id: data.servicio_id || null,
        categoria_id: catId,
        paciente_id: data.paciente_id || null,
        terapeuta_id: data.terapeuta_id || null,
        detalle: data.detalle || null,
        comprobante_url: comprobanteUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transacciones"] });
      queryClient.invalidateQueries({ queryKey: ["transacciones-mes"] });
      queryClient.invalidateQueries({ queryKey: ["chart-mensual"] });
      reset();
      setComprobanteUrl(null);
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TransaccionFormData }) => {
      if (!centroId) throw new Error("Sin centro activo");

      let catId = data.categoria_id || null;
      if (data.tipo === "ingreso" && data.servicio_id) {
        const sObj = servicios.find((s) => s.id === data.servicio_id);
        if (sObj && sObj.categoria_id) {
          catId = sObj.categoria_id;
        }
      }

      const { error } = await supabase
        .from("transacciones")
        .update({
          tipo: data.tipo,
          monto: parseFloat(data.monto),
          metodo_pago: data.metodo_pago,
          fecha: data.fecha,
          servicio_id: data.servicio_id || null,
          categoria_id: catId,
          paciente_id: data.paciente_id || null,
          terapeuta_id: data.terapeuta_id || null,
          detalle: data.detalle || null,
          comprobante_url: comprobanteUrl,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transacciones"] });
      queryClient.invalidateQueries({ queryKey: ["transacciones-mes"] });
      queryClient.invalidateQueries({ queryKey: ["chart-mensual"] });
      reset();
      setEditingId(null);
      setComprobanteUrl(null);
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("transacciones")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transacciones"] });
      queryClient.invalidateQueries({ queryKey: ["transacciones-mes"] });
    },
  });

  const categoriasFiltradas = categorias.filter((c) =>
    tipoSeleccionado === "ingreso" ? c.tipo === "ingreso" : c.tipo === "egreso"
  );

  return (
    <div className="page animate-fade-in-up">
      {/* Header */}
      <div className="page-head flex items-center justify-between flex-wrap gap-4 px-1">
        <div>
          <h1 className="page-title text-3xl font-extrabold tracking-tight">Transacciones</h1>
          <p className="page-sub text-sm text-[var(--text-muted)] mt-1">Registra ingresos y egresos del centro</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            className="btn-primary btn-pressable flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase"
            onClick={() => { setShowForm(true); reset(); }}
            id="nueva-transaccion-btn"
          >
            <Plus size={15} strokeWidth={3} />
            <span>Nueva transacción</span>
          </button>
        </div>
      </div>

      {/* Modal de Nueva Transacción */}
      <Dialog.Root open={showForm} onOpenChange={(open) => { if (!open) { reset(); setEditingId(null); setComprobanteUrl(null); } setShowForm(open); }}>
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
                              {editingId ? "Editar Transacción" : "Registrar Transacción"}
                            </Dialog.Title>
                            <Dialog.Description className="sr-only">
                              {editingId ? "Formulario para editar los datos de una transacción existente." : "Formulario para registrar los detalles de una nueva transacción."}
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
                            {/* Paciente (solo ingreso) */}
                             <AnimatePresence>
                               {tipoSeleccionado === "ingreso" && (
                                 <motion.div
                                   className="form-group"
                                   initial={{ opacity: 0, y: -8 }}
                                   animate={{ opacity: 1, y: 0 }}
                                   exit={{ opacity: 0, y: -8 }}
                                   transition={{ duration: 0.2 }}
                                 >
                                   <label className="form-label" htmlFor="paciente_id">
                                     Paciente
                                   </label>
                                   <select
                                     id="paciente_id"
                                     className="form-input form-select"
                                     {...register("paciente_id")}
                                   >
                                     <option value="">Ninguno / General</option>
                                     {pacientes.map((p) => (
                                       <option key={p.id} value={p.id}>
                                         {p.nombre_completo}
                                       </option>
                                     ))}
                                   </select>
                                 </motion.div>
                               )}
                             </AnimatePresence>

                             {/* Servicio (solo ingreso) */}
                             <AnimatePresence>
                               {tipoSeleccionado === "ingreso" && (
                                 <motion.div
                                   className="form-group"
                                   initial={{ opacity: 0, y: -8 }}
                                   animate={{ opacity: 1, y: 0 }}
                                   exit={{ opacity: 0, y: -8 }}
                                   transition={{ duration: 0.2 }}
                                 >
                                   <label className="form-label" htmlFor="servicio_id">
                                     Servicio / Plan
                                   </label>
                                   <select
                                     id="servicio_id"
                                     className="form-input form-select"
                                     {...register("servicio_id")}
                                   >
                                     <option value="">General / Ninguno</option>
                                     {servicios.map((s) => (
                                       <option key={s.id} value={s.id}>
                                         {s.nombre} {s.precio ? `(L ${s.precio.toFixed(2)})` : ""}
                                       </option>
                                     ))}
                                   </select>
                                 </motion.div>
                               )}
                             </AnimatePresence>

                             {/* Fecha */}
                            <div className="form-group">
                              <label className="form-label" htmlFor="fecha">
                                Fecha <span className="req">*</span>
                              </label>
                              <input
                                id="fecha"
                                type="date"
                                className={`form-input ${errors.fecha ? "error" : ""}`}
                                {...register("fecha")}
                              />
                              {errors.fecha && <p className="form-error">{errors.fecha.message}</p>}
                            </div>

                            {/* Método de pago */}
                            <div className="form-group">
                              <label className="form-label" htmlFor="metodo_pago">
                                Método de pago <span className="req">*</span>
                              </label>
                              <select
                                id="metodo_pago"
                                className={`form-input form-select ${errors.metodo_pago ? "error" : ""}`}
                                {...register("metodo_pago")}
                              >
                                <option value="">Seleccionar...</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="transferencia">Transferencia</option>
                                <option value="tarjeta">Tarjeta</option>
                              </select>
                              {errors.metodo_pago && <p className="form-error">{errors.metodo_pago.message}</p>}
                            </div>

                            {/* Monto */}
                            <div className="form-group">
                              <label className="form-label" htmlFor="monto">
                                Monto (L) <span className="req">*</span>
                              </label>
                              <input
                                id="monto"
                                type="text"
                                inputMode="decimal"
                                className={`form-input ${errors.monto ? "error" : ""}`}
                                placeholder="0.00"
                                onKeyDown={(e) => {
                                  if (
                                    !/[\d.,]/.test(e.key) &&
                                    !["Backspace", "Tab", "ArrowLeft", "ArrowRight", "Delete"].includes(e.key)
                                  ) {
                                    e.preventDefault();
                                  }
                                }}
                                {...register("monto")}
                              />
                              {errors.monto && <p className="form-error">{errors.monto.message}</p>}
                            </div>

                             {/* Categoría */}
                              <div className="form-group">
                                <label className="form-label" htmlFor="categoria_id">
                                  Categoría <span className="req">*</span>
                                </label>
                                <div className="flex gap-2">
                                  <select
                                    id="categoria_id"
                                    className={`form-input form-select flex-1 ${errors.categoria_id ? "error" : ""}`}
                                    {...register("categoria_id")}
                                  >
                                    <option value="">Seleccionar...</option>
                                    {categoriasFiltradas.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.parent_id && c.parent ? `${c.parent.nombre} > ${c.nombre}` : c.nombre}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    className="icon-btn btn-pressable flex items-center justify-center h-[43px] w-[43px] rounded-lg border border-[var(--border)] bg-white/5 hover:bg-white/10 text-[var(--text)] transition-colors flex-shrink-0"
                                    onClick={() => setShowNuevaCategoriaForm(true)}
                                    title="Nueva Categoría"
                                  >
                                    <Plus size={16} />
                                  </button>
                                </div>
                                {errors.categoria_id && (
                                  <p className="form-error">{errors.categoria_id.message}</p>
                                )}
                              </div>

                              {/* Tipo */}
                            <div className="form-group span-full">
                              <label className="form-label">
                                Tipo <span className="req">*</span>
                              </label>
                              <div className="relative flex bg-[var(--bg-subtle)] border border-[var(--border)] rounded-2xl p-1 gap-1">
                                <label className="relative flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-extrabold cursor-pointer transition-colors z-10">
                                  <input type="radio" value="ingreso" {...register("tipo")} style={{ display: "none" }} />
                                  <ArrowUpCircle size={16} className={tipoSeleccionado === "ingreso" ? "text-[#10b981]" : "text-[var(--text-muted)]"} />
                                  <span className={tipoSeleccionado === "ingreso" ? "text-[#10b981]" : "text-[var(--text-muted)]"}>Ingreso</span>
                                  {tipoSeleccionado === "ingreso" && (
                                    <motion.div
                                      layoutId="activeTipo"
                                      className="absolute inset-0 bg-[#10b981]/10 border border-[#10b981]/20 rounded-xl z-[-1]"
                                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                    />
                                  )}
                                </label>
                                <label className="relative flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-extrabold cursor-pointer transition-colors z-10">
                                  <input type="radio" value="egreso" {...register("tipo")} style={{ display: "none" }} />
                                  <ArrowDownCircle size={16} className={tipoSeleccionado === "egreso" ? "text-red-400" : "text-[var(--text-muted)]"} />
                                  <span className={tipoSeleccionado === "egreso" ? "text-red-400" : "text-[var(--text-muted)]"}>Egreso</span>
                                  {tipoSeleccionado === "egreso" && (
                                    <motion.div
                                      layoutId="activeTipo"
                                      className="absolute inset-0 bg-red-400/10 border border-red-400/20 rounded-xl z-[-1]"
                                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                    />
                                  )}
                                </label>
                              </div>
                            </div>

                            {/* Detalle */}
                            <div className="form-group span-full">
                              <label className="form-label" htmlFor="detalle">
                                Detalle / Notas
                              </label>
                              <textarea
                                id="detalle"
                                className="form-input form-textarea"
                                placeholder="Descripción opcional..."
                                rows={2}
                                {...register("detalle")}
                              />
                            </div>

                            {/* Comprobante */}
                            <div className="form-group span-full">
                              <label className="form-label">Comprobante / Recibo</label>
                              <FileUploader
                                centroId={centroId!}
                                onUpload={(url) => setComprobanteUrl(url)}
                                currentUrl={comprobanteUrl}
                              />
                            </div>
                          </div>

                          {createMutation.isError && (
                            <p className="form-error">Error al guardar. Inténtalo de nuevo.</p>
                          )}

                          <div className="form-actions mt-5">
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
                                 "Guardar transacción"
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

      {/* Sub-modal de Rápida Categoría */}
      <Dialog.Root open={showNuevaCategoriaForm} onOpenChange={(open) => { if (!open) { setNuevaCatNombre(""); } setShowNuevaCategoriaForm(open); }}>
        <Dialog.Portal>
          <AnimatePresence>
            {showNuevaCategoriaForm && (
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
                              Crear Nueva Categoría ({tipoSeleccionado === "ingreso" ? "Ingreso" : "Egreso"})
                            </Dialog.Title>
                            <Dialog.Description className="sr-only">
                              Formulario para agregar una nueva categoría de manera rápida.
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
                        <form onSubmit={(e) => { e.preventDefault(); createCategoriaRapidaMutation.mutate(); }}>
                          <div className="flex flex-col gap-3">
                            <div className="form-group">
                              <label className="form-label text-xs font-bold" htmlFor="quick-cat-nombre">Nombre <span className="req">*</span></label>
                              <input
                                id="quick-cat-nombre"
                                type="text"
                                className="form-input text-xs py-1.5 px-3 rounded-lg"
                                placeholder="Ej. Suscripciones, Nómina"
                                required
                                value={nuevaCatNombre}
                                onChange={(e) => setNuevaCatNombre(e.target.value)}
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
                              disabled={createCategoriaRapidaMutation.isPending}
                            >
                              {createCategoriaRapidaMutation.isPending ? <span className="btn-spinner" /> : "Crear categoría"}
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

      {/* Historial Card (Double Bezel Layout & Apple Glassmorphism) */}
      <div className="p-1.5 bg-white/5 dark:bg-white/5 border border-white/10 dark:border-white/5 rounded-[28px] shadow-2xl backdrop-blur-xl">
        <div className="bg-white/45 dark:bg-[#131b2e]/40 border border-white/10 dark:border-white/5 rounded-[22px] p-6">
          <div className="flex items-center justify-between flex-wrap gap-4 pb-5 border-b border-[var(--border)] mb-5">
            <div className="flex items-center gap-2.5">
              <h2 className="directory-title text-base font-extrabold tracking-tight">Historial de Transacciones</h2>
              <span className="badge badge-muted text-[10px] font-bold">
                {transacciones.length} registros
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex gap-0.5 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-1">
                {[
                  { value: "todos" as const, label: "Todos" },
                  { value: "ingreso" as const, label: "Ingresos" },
                  { value: "egreso" as const, label: "Egresos" },
                ].map((tab) => {
                  const active = filtroTipo === tab.value;
                  return (
                    <button
                      key={tab.value}
                      className={`relative px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer focus:outline-none z-10 ${
                        active ? "text-[var(--text)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"
                      }`}
                      onClick={() => setFiltroTipo(tab.value)}
                    >
                      {active && (
                        <motion.div
                          layoutId="activeFilter"
                          className="absolute inset-0 bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg shadow-sm z-[-1]"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Lista */}
          {isLoading ? (
            <div className="list-loading">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton-row" />
              ))}
            </div>
          ) : transacciones.length === 0 ? (
            <div className="list-empty">
              <ArrowLeftRight size={28} style={{ color: "var(--text-subtle)" }} />
              <p>No hay transacciones registradas</p>
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
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {transaccionesPagination.paginatedItems.map((t, i) => (
                    <motion.tr
                      key={t.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    >
                      <td>
                        <span className="mono font-semibold">{formatFechaCorta(t.fecha)}</span>
                      </td>
                      <td>
                        <span className={`badge ${t.tipo === "ingreso" ? "badge-green" : "badge-red"}`}>
                          {t.tipo === "ingreso" ? "↑ Ingreso" : "↓ Egreso"}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm font-medium">
                          {t.servicios?.nombre 
                            ? `${t.servicios.nombre} (Plan)` 
                            : t.categorias?.parent 
                              ? `${t.categorias.parent.nombre} > ${t.categorias.nombre}` 
                              : t.categorias?.nombre ?? "—"
                          }
                        </span>
                      </td>
                      <td>
                        <span className="text-sm text-[var(--text-muted)]">{t.detalle ?? "—"}</span>
                      </td>
                      <td>
                        <span className="badge badge-muted capitalize">{t.metodo_pago}</span>
                      </td>
                      <td>
                        <span className="text-sm font-medium">
                          {t.pacientes?.nombre_completo ?? "—"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          className="mono font-bold text-sm"
                          style={{ color: t.tipo === "ingreso" ? "var(--accent)" : "var(--red)" }}
                        >
                          {t.tipo === "ingreso" ? "+" : "-"}{formatHNL(t.monto)}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          {t.comprobante_url && (
                            <a
                              href={t.comprobante_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="icon-btn"
                              aria-label="Ver comprobante"
                            >
                              <Eye size={14} />
                            </a>
                          )}
                          <button
                            onClick={() => {
                              setEditingId(t.id);
                              setComprobanteUrl(t.comprobante_url);
                              reset({
                                tipo: t.tipo,
                                monto: t.monto.toString(),
                                fecha: t.fecha,
                                metodo_pago: t.metodo_pago,
                                servicio_id: t.servicio_id || "",
                                categoria_id: t.categoria_id || "",
                                paciente_id: t.paciente_id || "",
                                terapeuta_id: t.terapeuta_id || "",
                                detalle: t.detalle || "",
                              });
                              setShowForm(true);
                            }}
                            className="icon-btn"
                            aria-label="Editar transacción"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="icon-btn danger"
                            onClick={() => {
                              if (confirm("¿Eliminar esta transacción?")) {
                                deleteMutation.mutate(t.id);
                              }
                            }}
                            aria-label="Eliminar transacción"
                          >
                            <Trash2 size={14} />
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
        <Pagination
          totalItems={transacciones.length}
          page={transaccionesPagination.page}
          pageSize={transaccionesPagination.pageSize}
          totalPages={transaccionesPagination.totalPages}
          itemLabel="transacciones"
          onPageChange={transaccionesPagination.setPage}
          onPageSizeChange={transaccionesPagination.setPageSize}
        />
      </div>

      <style jsx>{`
        .page {
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
          max-width: 1600px;
        }

        .page-title {
          color: var(--text);
          letter-spacing: -0.025em;
        }

        .form-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.75rem center;
          padding-right: 2.5rem;
        }

        .form-textarea {
          resize: vertical;
          min-height: 64px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.25rem;
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
          padding-top: 1.25rem;
          border-top: 1px solid var(--border);
        }

        .list-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 3.5rem;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        .list-loading {
          display: flex;
          flex-direction: column;
          gap: 1px;
          padding: 1rem;
        }

        .skeleton-row {
          height: 48px;
          background: var(--bg-subtle);
          border-radius: 6px;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .mono {
          font-family: var(--font-mono);
        }

        .row-actions {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .icon-btn {
          width: 43px;
          height: 43px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          transition: all 120ms;
        }
          
        .icon-btn:hover {
          background: var(--surface-hover);
          color: var(--text);
          border-color: var(--border-strong);
        }
        .icon-btn.danger:hover {
          background: var(--red-muted);
          color: var(--red);
          border-color: var(--red);
        }

      `}</style>
    </div>
  );
}

export default function TransaccionesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[var(--text-muted)] font-mono">Cargando transacciones...</div>}>
      <TransaccionesContent />
    </Suspense>
  );
}
