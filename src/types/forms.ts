import { z } from "zod";

// ============================================================
// Validaciones de formularios
// ============================================================

export const centroSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  telefono: z.string().optional(),
  email_contacto: z.string().email("Correo inválido").optional().or(z.literal("")),
  direccion: z.string().optional(),
  descripcion: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export const registroSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export const pacienteSchema = z.object({
  nombre_completo: z.string().min(2, "El nombre es requerido").max(150),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  telefono: z.string().optional(),
  fecha_nacimiento: z.string().optional(),
  estado_suscripcion: z.enum(["activo", "pausado", "cancelado"]),
  plan_id: z.string().uuid().optional().or(z.literal("")),
  notas: z.string().optional(),
});

export const transaccionSchema = z.object({
  tipo: z.enum(["ingreso", "egreso"], {
    message: "Selecciona el tipo de transacción",
  }),
  monto: z
    .string()
    .min(1, "El monto es requerido")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) > 0,
      "El monto debe ser mayor a 0"
    ),
  metodo_pago: z.enum(["efectivo", "transferencia", "tarjeta"], {
    message: "Selecciona el método de pago",
  }),
  fecha: z.string().min(1, "La fecha es requerida"),
  servicio_id: z.string().uuid().optional().or(z.literal("")),
  categoria_id: z.string().uuid().optional().or(z.literal("")),
  paciente_id: z.string().uuid().optional().or(z.literal("")),
  terapeuta_id: z.string().uuid().optional().or(z.literal("")),
  detalle: z.string().optional(),
});

export const servicioSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100),
  servicio: z.string().min(1, "La clasificación es requerida").max(100),
  categoria_id: z.string().uuid("Selecciona una categoría de ingreso").min(1, "La categoría es requerida"),
  precio: z
    .string()
    .optional()
    .refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) >= 0),
      "El precio debe ser un número válido"
    ),
  activo: z.boolean(),
});

export const categoriaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100),
  tipo: z.enum(["ingreso", "egreso"], {
    message: "Selecciona el tipo",
  }),
  parent_id: z.string().uuid().optional().or(z.literal("")),
  activo: z.boolean(),
});

export const terapeutaSchema = z.object({
  nombre_completo: z.string().min(2, "El nombre es requerido").max(150),
  especialidad: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  activo: z.boolean(),
});

// Tipos inferidos
export type CentroFormData = z.infer<typeof centroSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegistroFormData = z.infer<typeof registroSchema>;
export type PacienteFormData = z.infer<typeof pacienteSchema>;
export type TransaccionFormData = z.infer<typeof transaccionSchema>;
export type ServicioFormData = z.infer<typeof servicioSchema>;
export type CategoriaFormData = z.infer<typeof categoriaSchema>;
export type TerapeutaFormData = z.infer<typeof terapeutaSchema>;
