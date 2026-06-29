"use client";

import { useState, useEffect, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Eye, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, X, Pencil, Filter, Search } from "lucide-react";
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

type FiltroMetodoPago = "todos" | "efectivo" | "transferencia" | "tarjeta";

const METODOS_PAGO: { value: FiltroMetodoPago; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
];

function formatCategoriaLabel(categoria: CategoriaConParent) {
  return categoria.parent_id && categoria.parent ? `${categoria.parent.nombre} > ${categoria.nombre}` : categoria.nombre;
}

function getPeriodoFromDate(fecha: string) {
  return fecha ? fecha.slice(0, 7) : new Date().toISOString().slice(0, 7);
}

function formatPeriodoPago(periodo: string | null) {
  if (!periodo) return "—";
  const [year, month] = periodo.split("-");
  if (!year || !month) return periodo;
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("es-HN", { month: "long", year: "numeric" }).format(date);
}

function TransaccionesContent() {
  const { centroActivo } = useCentro();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "ingreso" | "egreso">("todos");
  const [showFiltros, setShowFiltros] = useState(false);
  const [filtroMetodoPago, setFiltroMetodoPago] = useState<FiltroMetodoPago>("todos");
  const [filtroCategoriaId, setFiltroCategoriaId] = useState("todos");
  const [filtroPacienteId, setFiltroPacienteId] = useState("todos");
  const [categoriaSearch, setCategoriaSearch] = useState("");
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
  const now = new Date();
  const [fechaInicio, setFechaInicio] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  );
  const [fechaFin, setFechaFin] = useState(now.toISOString().split("T")[0]);

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
      periodo_pago: new Date().toISOString().slice(0, 7),
    },
  });

  const tipoSeleccionado = watch("tipo");
  const servicioSeleccionadoId = watch("servicio_id");
  const fechaSeleccionada = watch("fecha");

  // Queries
  const { data: transacciones = [], isLoading } = useQuery({
    queryKey: ["transacciones", centroId, filtroTipo, fechaInicio, fechaFin, filtroMetodoPago, filtroPacienteId],
    queryFn: async () => {
      if (!centroId) return [];
      let q = supabase
        .from("transacciones")
        .select("*, servicios(id,nombre,servicio,categoria_id), categorias(id,nombre,tipo,parent_id,parent:parent_id(id,nombre)), pacientes(id,nombre_completo), terapeutas(id,nombre_completo)")
        .eq("centro_id", centroId)
        .is("deleted_at", null)
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });
      if (filtroTipo !== "todos") q = q.eq("tipo", filtroTipo);
      if (filtroMetodoPago !== "todos") q = q.eq("metodo_pago", filtroMetodoPago);
      if (filtroPacienteId !== "todos") q = q.eq("paciente_id", filtroPacienteId);
      const { data } = await q;
      return (data ?? []) as unknown as TransaccionConRelaciones[];
    },
    enabled: !!centroId,
  });

  const transaccionesFiltradas =
    filtroCategoriaId === "todos"
      ? transacciones
      : transacciones.filter(
          (t) =>
            t.categoria_id === filtroCategoriaId ||
            t.servicios?.categoria_id === filtroCategoriaId ||
            t.categorias?.parent_id === filtroCategoriaId
        );

  const transaccionesPagination = usePagination({
    items: transaccionesFiltradas,
    storageKey: "pagination:transacciones",
    resetKey: `${centroId ?? ""}:${filtroTipo}:${fechaInicio}:${fechaFin}:${filtroMetodoPago}:${filtroCategoriaId}:${filtroPacienteId}`,
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

  useEffect(() => {
    if (tipoSeleccionado === "ingreso" && fechaSeleccionada) {
      setValue("periodo_pago", getPeriodoFromDate(fechaSeleccionada), { shouldValidate: true });
    }
  }, [fechaSeleccionada, tipoSeleccionado, setValue]);

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
        periodo_pago: data.tipo === "ingreso" ? data.periodo_pago || getPeriodoFromDate(data.fecha) : null,
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
          periodo_pago: data.tipo === "ingreso" ? data.periodo_pago || getPeriodoFromDate(data.fecha) : null,
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

  const categoriasParaFiltro = categorias.filter((c) => {
    if (filtroTipo !== "todos" && c.tipo !== filtroTipo) return false;

    const search = categoriaSearch.trim().toLowerCase();
    if (!search) return true;

    return formatCategoriaLabel(c).toLowerCase().includes(search);
  });

  const categoriasIngresoFiltro = categoriasParaFiltro.filter((c) => c.tipo === "ingreso");
  const categoriasEgresoFiltro = categoriasParaFiltro.filter((c) => c.tipo === "egreso");
  const categoriaSeleccionada = categorias.find((c) => c.id === filtroCategoriaId);
  const pacienteSeleccionado = pacientes.find((p) => p.id === filtroPacienteId);
  const filtrosActivos = [
    filtroMetodoPago !== "todos",
    filtroCategoriaId !== "todos",
    filtroPacienteId !== "todos",
  ].filter(Boolean).length;

  const limpiarFiltros = () => {
    setFiltroMetodoPago("todos");
    setFiltroCategoriaId("todos");
    setFiltroPacienteId("todos");
    setCategoriaSearch("");
  };

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
            onClick={() => { setShowForm(true); reset({ tipo: "ingreso", fecha: new Date().toISOString().split("T")[0], periodo_pago: new Date().toISOString().slice(0, 7) }); }}
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

                            <AnimatePresence>
                              {tipoSeleccionado === "ingreso" && (
                                <motion.div
                                  className="form-group"
                                  initial={{ opacity: 0, y: -8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -8 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <label className="form-label" htmlFor="periodo_pago">
                                    Mes pagado
                                  </label>
                                  <input
                                    id="periodo_pago"
                                    type="month"
                                    className={`form-input ${errors.periodo_pago ? "error" : ""}`}
                                    {...register("periodo_pago")}
                                  />
                                  <p className="form-hint">Mes al que corresponde este ingreso, aunque se cobre otro día.</p>
                                  {errors.periodo_pago && <p className="form-error">{errors.periodo_pago.message}</p>}
                                </motion.div>
                              )}
                            </AnimatePresence>

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

      {/* Filtros de fecha */}
      <div className="filters-card glass-card">
        <div className="filter-group">
          <label className="form-label" htmlFor="fecha-inicio-transacciones">Desde</label>
          <input
            id="fecha-inicio-transacciones"
            type="date"
            className="form-input"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label className="form-label" htmlFor="fecha-fin-transacciones">Hasta</label>
          <input
            id="fecha-fin-transacciones"
            type="date"
            className="form-input"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
          />
        </div>
        <div className="filter-quick">
          <span className="filter-label">Accesos rápidos:</span>
          {[
            {
              label: "Este mes",
              action: () => {
                const d = new Date();
                setFechaInicio(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
                setFechaFin(d.toISOString().split("T")[0]);
              },
            },
            {
              label: "Mes anterior",
              action: () => {
                const d = new Date();
                d.setMonth(d.getMonth() - 1);
                const y = d.getFullYear();
                const m = d.getMonth() + 1;
                const daysInMonth = new Date(y, m, 0).getDate();
                setFechaInicio(`${y}-${String(m).padStart(2, "0")}-01`);
                setFechaFin(`${y}-${String(m).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`);
              },
            },
            {
              label: "Este año",
              action: () => {
                const y = new Date().getFullYear();
                setFechaInicio(`${y}-01-01`);
                setFechaFin(`${y}-12-31`);
              },
            },
          ].map((q) => (
            <button key={q.label} type="button" className="quick-btn btn-pressable" onClick={q.action}>
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Historial Card (Double Bezel Layout & Apple Glassmorphism) */}
      <div className="p-1.5 bg-white/5 dark:bg-white/5 border border-white/10 dark:border-white/5 rounded-[28px] shadow-2xl backdrop-blur-xl">
        <div className="bg-white/45 dark:bg-[#131b2e]/40 border border-white/10 dark:border-white/5 rounded-[22px] p-6">
          <div className="flex items-center justify-between flex-wrap gap-4 pb-5 border-b border-[var(--border)] mb-5">
            <div className="flex items-center gap-2.5">
              <h2 className="directory-title text-base font-extrabold tracking-tight">Historial de Transacciones</h2>
              <span className="badge badge-muted text-[10px] font-bold">
                {transaccionesFiltradas.length} registros
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="filters-wrap">
                <button
                  type="button"
                  className="btn-filter btn-pressable flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)]"
                  onClick={() => setShowFiltros((current) => !current)}
                  aria-expanded={showFiltros}
                  aria-haspopup="menu"
                >
                  <Filter size={13} />
                  <span>Filtros</span>
                  {filtrosActivos > 0 && <span className="filter-count">{filtrosActivos}</span>}
                </button>
                {showFiltros && (
                  <div className="filters-menu" role="menu" aria-label="Filtros de transacciones">
                    <div className="filters-menu-head">
                      <span className="filters-title">Filtrar por</span>
                      {filtrosActivos > 0 && (
                        <button type="button" className="clear-filters" onClick={limpiarFiltros}>
                          Limpiar
                        </button>
                      )}
                    </div>

                    <div className="filter-block">
                      <span className="filters-subtitle">Método de pago</span>
                      <div className="method-grid">
                        {METODOS_PAGO.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`filter-pill ${filtroMetodoPago === option.value ? "active" : ""}`}
                            onClick={() => setFiltroMetodoPago(option.value)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="filter-block">
                      <span className="filters-subtitle">Paciente</span>
                      <select
                        className="filter-select"
                        value={filtroPacienteId}
                        onChange={(e) => setFiltroPacienteId(e.target.value)}
                      >
                        <option value="todos">Todos los pacientes</option>
                        {pacientes.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre_completo}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="filter-block">
                      <span className="filters-subtitle">Categoría</span>
                      <button
                        type="button"
                        className={`category-option ${filtroCategoriaId === "todos" ? "active" : ""}`}
                        onClick={() => setFiltroCategoriaId("todos")}
                      >
                        Todas las categorías
                      </button>
                      <div className="category-search">
                        <Search size={13} />
                        <input
                          type="text"
                          value={categoriaSearch}
                          onChange={(e) => setCategoriaSearch(e.target.value)}
                          placeholder="Buscar categoría..."
                        />
                      </div>
                      <div className="category-list">
                        {filtroTipo === "todos" && categoriasIngresoFiltro.length > 0 && (
                          <span className="category-group-title">Ingresos</span>
                        )}
                        {categoriasIngresoFiltro.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={`category-option ${filtroCategoriaId === c.id ? "active" : ""}`}
                            onClick={() => setFiltroCategoriaId(c.id)}
                          >
                            {formatCategoriaLabel(c)}
                          </button>
                        ))}
                        {filtroTipo === "todos" && categoriasEgresoFiltro.length > 0 && (
                          <span className="category-group-title">Egresos</span>
                        )}
                        {categoriasEgresoFiltro.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={`category-option ${filtroCategoriaId === c.id ? "active" : ""}`}
                            onClick={() => setFiltroCategoriaId(c.id)}
                          >
                            {formatCategoriaLabel(c)}
                          </button>
                        ))}
                        {categoriasParaFiltro.length === 0 && (
                          <span className="empty-filter-result">No hay categorías disponibles</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
                      onClick={() => {
                        setFiltroTipo(tab.value);
                        if (categoriaSeleccionada && tab.value !== "todos" && categoriaSeleccionada.tipo !== tab.value) {
                          setFiltroCategoriaId("todos");
                        }
                      }}
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

          {(filtroMetodoPago !== "todos" || filtroCategoriaId !== "todos" || filtroPacienteId !== "todos") && (
            <div className="active-filters">
              <span className="active-filters-label">Filtros activos:</span>
              {filtroMetodoPago !== "todos" && (
                <span className="active-filter-chip">
                  Método: {METODOS_PAGO.find((option) => option.value === filtroMetodoPago)?.label}
                </span>
              )}
              {categoriaSeleccionada && (
                <span className="active-filter-chip">Categoría: {formatCategoriaLabel(categoriaSeleccionada)}</span>
              )}
              {pacienteSeleccionado && (
                <span className="active-filter-chip">Paciente: {pacienteSeleccionado.nombre_completo}</span>
              )}
            </div>
          )}

          {/* Lista */}
          {isLoading ? (
            <div className="list-loading">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton-row" />
              ))}
            </div>
          ) : transaccionesFiltradas.length === 0 ? (
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
                    <th>Mes pagado</th>
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
                        <span className="text-sm text-[var(--text-muted)] capitalize">
                          {t.tipo === "ingreso" ? formatPeriodoPago(t.periodo_pago) : "—"}
                        </span>
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
                                periodo_pago: t.periodo_pago || getPeriodoFromDate(t.fecha),
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
          totalItems={transaccionesFiltradas.length}
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

        .filters-card {
          display: flex;
          align-items: flex-end;
          gap: 1.25rem;
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 200px;
        }

        .filter-quick {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 1rem;
          width: 100%;
        }

        .filter-label {
          color: var(--text-subtle);
          font-family: var(--font-mono);
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .quick-btn {
          padding: 0.375rem 0.75rem;
          border-radius: 99px;
          border: 1px solid var(--border);
          background: var(--bg-subtle);
          color: var(--text-muted);
          cursor: pointer;
          font-family: var(--font-sans);
          font-size: 0.75rem;
          font-weight: 600;
          transition: all 150ms var(--ease-out);
        }

        .quick-btn:hover {
          background: var(--accent-muted);
          color: var(--accent);
          border-color: var(--accent);
        }

        .filters-wrap {
          position: relative;
        }

        .filter-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 1rem;
          height: 1rem;
          border-radius: 999px;
          background: var(--accent);
          color: var(--accent-fg);
          font-size: 0.625rem;
          font-weight: 900;
        }

        .filters-menu {
          position: absolute;
          top: calc(100% + 0.5rem);
          right: 0;
          z-index: 40;
          width: min(360px, calc(100vw - 2rem));
          max-height: min(680px, calc(100vh - 10rem));
          overflow: auto;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: 18px;
          background: var(--surface);
          box-shadow: var(--shadow-lg);
        }

        .filters-menu-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .filters-title,
        .filters-subtitle {
          display: block;
          color: var(--text-subtle);
          font-size: 0.625rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .clear-filters {
          border: 0;
          background: transparent;
          color: var(--accent);
          cursor: pointer;
          font-family: var(--font-sans);
          font-size: 0.6875rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .filter-block {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 0.75rem 0;
          border-top: 1px solid var(--border);
        }

        .method-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.375rem;
        }

        .filter-pill,
        .category-option {
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          font-family: var(--font-sans);
          font-size: 0.8125rem;
          font-weight: 700;
          padding: 0.55rem 0.625rem;
          text-align: left;
          transition: background 150ms var(--ease-out), color 150ms;
        }

        .filter-pill {
          text-align: center;
        }

        .filter-pill:hover,
        .filter-pill.active,
        .category-option:hover,
        .category-option.active {
          background: var(--bg-subtle);
          color: var(--text);
        }

        .filter-select {
          width: 100%;
          min-height: 38px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--bg-subtle);
          color: var(--text);
          font-family: var(--font-sans);
          font-size: 0.8125rem;
          font-weight: 700;
          outline: none;
          padding: 0 0.75rem;
        }

        .category-search {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--bg-subtle);
          color: var(--text-subtle);
          padding: 0 0.625rem;
        }

        .category-search input {
          width: 100%;
          min-height: 36px;
          border: 0;
          background: transparent;
          color: var(--text);
          font-family: var(--font-sans);
          font-size: 0.8125rem;
          font-weight: 600;
          outline: none;
        }

        .category-list {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          max-height: 220px;
          overflow: auto;
          padding-right: 0.25rem;
        }

        .category-group-title {
          padding: 0.5rem 0.625rem 0.25rem;
          color: var(--text-subtle);
          font-size: 0.625rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .empty-filter-result {
          padding: 0.75rem 0.625rem;
          color: var(--text-subtle);
          font-size: 0.75rem;
          font-weight: 700;
        }

        .active-filters {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin: -0.5rem 0 1rem;
        }

        .active-filters-label {
          color: var(--text-subtle);
          font-family: var(--font-mono);
          font-size: 0.6875rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .active-filter-chip {
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--bg-subtle);
          color: var(--text-muted);
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.3rem 0.65rem;
        }

        @media (max-width: 600px) {
          .filters-menu {
            left: 0;
            right: auto;
          }
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
