-- ============================================================
-- AlCheque — Schema inicial (Supabase PostgreSQL)
-- ============================================================

-- Extensión para búsqueda de texto completo en español
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================================
-- 1. TABLA: centros
-- Cada usuario puede tener múltiples centros
-- ============================================================
CREATE TABLE centros (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  telefono        text,
  email_contacto  text,
  direccion       text,
  descripcion     text,
  logo_url        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_centros_user_id ON centros(user_id);

-- ============================================================
-- 2. TABLA: servicios_categorias
-- Planes e ingresos/egresos por centro
-- ============================================================
CREATE TABLE servicios_categorias (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id   uuid NOT NULL REFERENCES centros(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  tipo        text NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  categoria   text NOT NULL,
  precio      numeric(10, 2),
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_servicios_centro ON servicios_categorias(centro_id);
CREATE INDEX idx_servicios_tipo ON servicios_categorias(centro_id, tipo);

-- ============================================================
-- 3. TABLA: terapeutas
-- ============================================================
CREATE TABLE terapeutas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id       uuid NOT NULL REFERENCES centros(id) ON DELETE CASCADE,
  nombre_completo text NOT NULL,
  especialidad    text,
  telefono        text,
  email           text,
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_terapeutas_centro ON terapeutas(centro_id);

-- ============================================================
-- 4. TABLA: pacientes
-- ============================================================
CREATE TABLE pacientes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id           uuid NOT NULL REFERENCES centros(id) ON DELETE CASCADE,
  nombre_completo     text NOT NULL,
  email               text,
  telefono            text,
  fecha_nacimiento    date,
  fecha_ingreso       timestamptz NOT NULL DEFAULT now(),
  estado_mensualidad  boolean NOT NULL DEFAULT false,
  estado_suscripcion  text NOT NULL CHECK (estado_suscripcion IN ('activo', 'pausado', 'cancelado')) DEFAULT 'activo',
  plan_id             uuid REFERENCES servicios_categorias(id) ON DELETE SET NULL,
  notas               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pacientes_centro ON pacientes(centro_id);
CREATE INDEX idx_pacientes_estado ON pacientes(centro_id, estado_mensualidad);
CREATE INDEX idx_pacientes_suscripcion ON pacientes(centro_id, estado_suscripcion);
CREATE INDEX idx_pacientes_nombre_trgm ON pacientes USING gin(nombre_completo gin_trgm_ops);

-- ============================================================
-- 5. TABLA: transacciones
-- ============================================================
CREATE TABLE transacciones (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id             uuid NOT NULL REFERENCES centros(id) ON DELETE CASCADE,
  tipo                  text NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  monto                 numeric(10, 2) NOT NULL CHECK (monto > 0),
  metodo_pago           text NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia', 'tarjeta')),
  detalle               text,
  fecha                 date NOT NULL DEFAULT current_date,
  comprobante_url       text,
  servicio_categoria_id uuid REFERENCES servicios_categorias(id) ON DELETE SET NULL,
  paciente_id           uuid REFERENCES pacientes(id) ON DELETE SET NULL,
  terapeuta_id          uuid REFERENCES terapeutas(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_transacciones_centro_fecha ON transacciones(centro_id, fecha DESC);
CREATE INDEX idx_transacciones_tipo ON transacciones(centro_id, tipo);
CREATE INDEX idx_transacciones_paciente ON transacciones(paciente_id) WHERE paciente_id IS NOT NULL;

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_centros_updated_at
  BEFORE UPDATE ON centros
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_pacientes_updated_at
  BEFORE UPDATE ON pacientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- centros: solo el propietario
ALTER TABLE centros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "centros_owner" ON centros
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Helper function: verifica que el usuario es dueño del centro
CREATE OR REPLACE FUNCTION is_centro_owner(p_centro_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM centros
    WHERE id = p_centro_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- servicios_categorias
ALTER TABLE servicios_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "servicios_owner" ON servicios_categorias
  FOR ALL USING (is_centro_owner(centro_id))
  WITH CHECK (is_centro_owner(centro_id));

-- terapeutas
ALTER TABLE terapeutas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "terapeutas_owner" ON terapeutas
  FOR ALL USING (is_centro_owner(centro_id))
  WITH CHECK (is_centro_owner(centro_id));

-- pacientes
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pacientes_owner" ON pacientes
  FOR ALL USING (is_centro_owner(centro_id))
  WITH CHECK (is_centro_owner(centro_id));

-- transacciones
ALTER TABLE transacciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transacciones_owner" ON transacciones
  FOR ALL USING (is_centro_owner(centro_id))
  WITH CHECK (is_centro_owner(centro_id));

-- ============================================================
-- STORAGE: bucket para comprobantes
-- ============================================================
-- Ejecutar en Supabase Dashboard > Storage:
-- Crear bucket "comprobantes" (privado)
-- Política: usuarios autenticados pueden subir/leer sus propios archivos
