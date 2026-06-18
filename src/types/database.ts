export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      centros: {
        Row: {
          id: string;
          user_id: string;
          nombre: string;
          telefono: string | null;
          email_contacto: string | null;
          direccion: string | null;
          descripcion: string | null;
          logo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          nombre: string;
          telefono?: string | null;
          email_contacto?: string | null;
          direccion?: string | null;
          descripcion?: string | null;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          nombre?: string;
          telefono?: string | null;
          email_contacto?: string | null;
          direccion?: string | null;
          descripcion?: string | null;
          logo_url?: string | null;
          updated_at?: string;
        };
      };
      servicios_categorias: {
        Row: {
          id: string;
          centro_id: string;
          nombre: string;
          tipo: "ingreso" | "egreso";
          categoria: string;
          precio: number | null;
          activo: boolean;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          centro_id: string;
          nombre: string;
          tipo: "ingreso" | "egreso";
          categoria: string;
          precio?: number | null;
          activo?: boolean;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          nombre?: string;
          tipo?: "ingreso" | "egreso";
          categoria?: string;
          precio?: number | null;
          activo?: boolean;
          deleted_at?: string | null;
        };
      };
      terapeutas: {
        Row: {
          id: string;
          centro_id: string;
          nombre_completo: string;
          especialidad: string | null;
          telefono: string | null;
          email: string | null;
          activo: boolean;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          centro_id: string;
          nombre_completo: string;
          especialidad?: string | null;
          telefono?: string | null;
          email?: string | null;
          activo?: boolean;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          nombre_completo?: string;
          especialidad?: string | null;
          telefono?: string | null;
          email?: string | null;
          activo?: boolean;
          deleted_at?: string | null;
        };
      };
      pacientes: {
        Row: {
          id: string;
          centro_id: string;
          nombre_completo: string;
          email: string | null;
          telefono: string | null;
          fecha_nacimiento: string | null;
          fecha_ingreso: string;
          estado_mensualidad: boolean;
          estado_suscripcion: "activo" | "pausado" | "cancelado";
          plan_id: string | null;
          notas: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          centro_id: string;
          nombre_completo: string;
          email?: string | null;
          telefono?: string | null;
          fecha_nacimiento?: string | null;
          fecha_ingreso?: string;
          estado_mensualidad?: boolean;
          estado_suscripcion?: "activo" | "pausado" | "cancelado";
          plan_id?: string | null;
          notas?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          nombre_completo?: string;
          email?: string | null;
          telefono?: string | null;
          fecha_nacimiento?: string | null;
          estado_mensualidad?: boolean;
          estado_suscripcion?: "activo" | "pausado" | "cancelado";
          plan_id?: string | null;
          notas?: string | null;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      transacciones: {
        Row: {
          id: string;
          centro_id: string;
          tipo: "ingreso" | "egreso";
          monto: number;
          metodo_pago: "efectivo" | "transferencia" | "tarjeta";
          detalle: string | null;
          fecha: string;
          comprobante_url: string | null;
          servicio_categoria_id: string | null;
          paciente_id: string | null;
          terapeuta_id: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          centro_id: string;
          tipo: "ingreso" | "egreso";
          monto: number;
          metodo_pago: "efectivo" | "transferencia" | "tarjeta";
          detalle?: string | null;
          fecha?: string;
          comprobante_url?: string | null;
          servicio_categoria_id?: string | null;
          paciente_id?: string | null;
          terapeuta_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          tipo?: "ingreso" | "egreso";
          monto?: number;
          metodo_pago?: "efectivo" | "transferencia" | "tarjeta";
          detalle?: string | null;
          fecha?: string;
          comprobante_url?: string | null;
          servicio_categoria_id?: string | null;
          paciente_id?: string | null;
          terapeuta_id?: string | null;
          deleted_at?: string | null;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

// Tipos derivados para uso en la app
export type Centro = Database["public"]["Tables"]["centros"]["Row"];
export type ServicioCategoria = Database["public"]["Tables"]["servicios_categorias"]["Row"];
export type Terapeuta = Database["public"]["Tables"]["terapeutas"]["Row"];
export type Paciente = Database["public"]["Tables"]["pacientes"]["Row"];
export type Transaccion = Database["public"]["Tables"]["transacciones"]["Row"];

// Tipos con joins
export type TransaccionConRelaciones = Transaccion & {
  servicios_categorias?: Pick<ServicioCategoria, "id" | "nombre" | "tipo" | "categoria"> | null;
  pacientes?: Pick<Paciente, "id" | "nombre_completo"> | null;
  terapeutas?: Pick<Terapeuta, "id" | "nombre_completo"> | null;
};

export type PacienteConPlan = Paciente & {
  servicios_categorias?: Pick<ServicioCategoria, "id" | "nombre" | "precio"> | null;
};
