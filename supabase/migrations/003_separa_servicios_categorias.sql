-- ============================================================
-- AlCheque — Migración: Separación de Servicios y Categorías
-- ============================================================

-- 1. Crear tabla categorias (con jerarquía parent_id)
CREATE TABLE categorias (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id   uuid NOT NULL REFERENCES centros(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  tipo        text NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  parent_id   uuid REFERENCES categorias(id) ON DELETE SET NULL,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz DEFAULT NULL
);

CREATE INDEX idx_categorias_centro ON categorias(centro_id);
CREATE INDEX idx_categorias_parent ON categorias(parent_id);

ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

-- Reutilizamos la función is_centro_owner definida en 001_schema.sql
CREATE POLICY "categorias_owner" ON categorias
  FOR ALL USING (is_centro_owner(centro_id))
  WITH CHECK (is_centro_owner(centro_id));

-- 2. Renombrar servicios_categorias a servicios
ALTER TABLE servicios_categorias RENAME TO servicios;

-- 3. Renombrar columna categoria a servicio en servicios
ALTER TABLE servicios RENAME COLUMN categoria TO servicio;

-- 4. Añadir columna categoria_id a servicios para agruparlos bajo una categoría de ingresos
ALTER TABLE servicios ADD COLUMN categoria_id uuid REFERENCES categorias(id) ON DELETE SET NULL;
CREATE INDEX idx_servicios_categoria ON servicios(categoria_id) WHERE categoria_id IS NOT NULL;

-- 5. Crear categorías iniciales basadas en los datos existentes
DO $$
DECLARE
  rec RECORD;
  v_cat_id uuid;
  v_subcat_id uuid;
BEGIN
  -- A. Crear categorías de ingresos basadas en el campo 'servicio' (anteriormente 'categoria')
  FOR rec IN 
    SELECT DISTINCT centro_id, servicio 
    FROM servicios 
    WHERE tipo = 'ingreso' AND deleted_at IS NULL
  LOOP
    -- Insertar la categoría padre de ingreso (ej. "Mensualidades")
    INSERT INTO categorias (centro_id, nombre, tipo)
    VALUES (rec.centro_id, rec.servicio, 'ingreso')
    RETURNING id INTO v_cat_id;

    -- Asociar los servicios de ingreso a esta nueva categoría
    UPDATE servicios 
    SET categoria_id = v_cat_id 
    WHERE centro_id = rec.centro_id AND servicio = rec.servicio AND tipo = 'ingreso';
  END LOOP;

  -- B. Crear categorías y subcategorías de egresos basadas en los egresos existentes
  FOR rec IN 
    SELECT id, centro_id, nombre, servicio, activo, created_at, deleted_at
    FROM servicios 
    WHERE tipo = 'egreso'
  LOOP
    -- Buscar o crear la categoría padre de egreso (ej. "Nómina")
    SELECT id INTO v_cat_id 
    FROM categorias 
    WHERE centro_id = rec.centro_id AND nombre = rec.servicio AND tipo = 'egreso' AND parent_id IS NULL;

    IF v_cat_id IS NULL THEN
      INSERT INTO categorias (centro_id, nombre, tipo, activo, created_at)
      VALUES (rec.centro_id, rec.servicio, 'egreso', true, rec.created_at)
      RETURNING id INTO v_cat_id;
    END IF;

    -- Crear la subcategoría con el nombre del egreso (ej. "Pago a Terapeutas")
    INSERT INTO categorias (centro_id, nombre, tipo, parent_id, activo, created_at, deleted_at)
    VALUES (rec.centro_id, rec.nombre, 'egreso', v_cat_id, rec.activo, rec.created_at, rec.deleted_at);
  END LOOP;
END $$;

-- 6. Actualizar llaves foráneas en pacientes
ALTER TABLE pacientes DROP CONSTRAINT IF EXISTS pacientes_plan_id_fkey;
ALTER TABLE pacientes ADD CONSTRAINT pacientes_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES servicios(id) ON DELETE SET NULL;

-- 7. Actualizar tabla transacciones
-- A. Renombrar columna de servicio_categoria_id a servicio_id
ALTER TABLE transacciones RENAME COLUMN servicio_categoria_id TO servicio_id;

-- B. Actualizar llave foránea de servicio_id
ALTER TABLE transacciones DROP CONSTRAINT IF EXISTS transacciones_servicio_categoria_id_fkey;
ALTER TABLE transacciones ADD CONSTRAINT transacciones_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES servicios(id) ON DELETE SET NULL;

-- C. Añadir columna categoria_id para clasificar la transacción en el catálogo de categorías
ALTER TABLE transacciones ADD COLUMN categoria_id uuid REFERENCES categorias(id) ON DELETE SET NULL;
CREATE INDEX idx_transacciones_categoria ON transacciones(categoria_id) WHERE categoria_id IS NOT NULL;
CREATE INDEX idx_transacciones_servicio ON transacciones(servicio_id) WHERE servicio_id IS NOT NULL;

-- D. Migrar transacciones existentes
DO $$
DECLARE
  rec RECORD;
  v_new_cat_id uuid;
BEGIN
  -- Transacciones de tipo egreso: asociar a la subcategoría correspondiente y limpiar servicio_id
  FOR rec IN 
    SELECT t.id, t.servicio_id, s.nombre, s.servicio as cat_nombre, t.centro_id
    FROM transacciones t
    JOIN servicios s ON t.servicio_id = s.id
    WHERE t.tipo = 'egreso'
  LOOP
    -- Buscar la subcategoría correspondiente
    SELECT c.id INTO v_new_cat_id
    FROM categorias c
    JOIN categorias p ON c.parent_id = p.id
    WHERE c.centro_id = rec.centro_id 
      AND c.nombre = rec.nombre 
      AND p.nombre = rec.cat_nombre
      AND c.tipo = 'egreso';

    IF v_new_cat_id IS NOT NULL THEN
      UPDATE transacciones 
      SET categoria_id = v_new_cat_id, servicio_id = NULL 
      WHERE id = rec.id;
    END IF;
  END LOOP;

  -- Transacciones de tipo ingreso: asociar a la categoría de su servicio correspondiente
  FOR rec IN
    SELECT t.id, s.categoria_id
    FROM transacciones t
    JOIN servicios s ON t.servicio_id = s.id
    WHERE t.tipo = 'ingreso' AND s.categoria_id IS NOT NULL
  LOOP
    UPDATE transacciones
    SET categoria_id = rec.categoria_id
    WHERE id = rec.id;
  END LOOP;
END $$;

-- 8. Limpiar la tabla servicios eliminando las filas de egreso (ya que ahora viven en la tabla de categorías)
DELETE FROM servicios WHERE tipo = 'egreso';

-- 9. Eliminar la columna 'tipo' de servicios, puesto que los servicios son ahora exclusivamente planes/ingresos de pacientes
ALTER TABLE servicios DROP COLUMN tipo;
