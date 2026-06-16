-- ============================================================
-- AlCheque — Datos de ejemplo (seed.sql)
-- Ejecutar DESPUÉS de 001_schema.sql y de haber creado un usuario
-- ============================================================

-- INSTRUCCIONES:
-- 1. Registra un usuario en la app
-- 2. Copia su UUID de auth.users
-- 3. Reemplaza 'TU-USER-UUID' con el UUID real
-- 4. Ejecuta este script en el SQL Editor de Supabase

DO $$
DECLARE
  v_user_id    uuid := 'TU-USER-UUID'; -- ← Reemplazar
  v_centro_id  uuid;
  v_plan1_id   uuid;
  v_plan2_id   uuid;
  v_egreso1_id uuid;
  v_terapeuta1 uuid;
  v_paciente1  uuid;
  v_paciente2  uuid;
BEGIN

  -- Centro de ejemplo
  INSERT INTO centros (user_id, nombre, telefono, email_contacto, direccion)
  VALUES (v_user_id, 'Centro Terapéutico Vida Plena', '+504 9999-0000', 'info@vidaplena.hn', 'Colonia El Prado, Tegucigalpa, Honduras')
  RETURNING id INTO v_centro_id;

  -- Servicios/Categorías de ingresos
  INSERT INTO servicios_categorias (centro_id, nombre, tipo, categoria, precio)
  VALUES
    (v_centro_id, 'Plan Básico', 'ingreso', 'Mensualidades', 800.00)
  RETURNING id INTO v_plan1_id;

  INSERT INTO servicios_categorias (centro_id, nombre, tipo, categoria, precio)
  VALUES
    (v_centro_id, 'Plan Premium', 'ingreso', 'Mensualidades', 1500.00)
  RETURNING id INTO v_plan2_id;

  -- Categorías de egresos
  INSERT INTO servicios_categorias (centro_id, nombre, tipo, categoria)
  VALUES
    (v_centro_id, 'Pago a Terapeutas', 'egreso', 'Nómina')
  RETURNING id INTO v_egreso1_id;

  INSERT INTO servicios_categorias (centro_id, nombre, tipo, categoria)
  VALUES
    (v_centro_id, 'Suscripción Software', 'egreso', 'Suscripciones'),
    (v_centro_id, 'Servicios Públicos', 'egreso', 'Servicios'),
    (v_centro_id, 'Materiales', 'egreso', 'Operativos');

  -- Terapeuta de ejemplo
  INSERT INTO terapeutas (centro_id, nombre_completo, especialidad, telefono)
  VALUES (v_centro_id, 'Lic. María López', 'Psicología Clínica', '+504 9888-1111')
  RETURNING id INTO v_terapeuta1;

  -- Pacientes de ejemplo
  INSERT INTO pacientes (centro_id, nombre_completo, telefono, estado_mensualidad, estado_suscripcion, plan_id)
  VALUES (v_centro_id, 'Carlos Rodríguez', '+504 9777-2222', true, 'activo', v_plan1_id)
  RETURNING id INTO v_paciente1;

  INSERT INTO pacientes (centro_id, nombre_completo, telefono, estado_mensualidad, estado_suscripcion, plan_id)
  VALUES (v_centro_id, 'Ana Martínez', '+504 9666-3333', true, 'activo', v_plan2_id)
  RETURNING id INTO v_paciente2;

  INSERT INTO pacientes (centro_id, nombre_completo, telefono, estado_mensualidad, estado_suscripcion, plan_id)
  VALUES (v_centro_id, 'Juan Pérez', '+504 9555-4444', false, 'pausado', v_plan1_id);

  -- Transacciones de ejemplo (últimos 2 meses)
  INSERT INTO transacciones (centro_id, tipo, monto, metodo_pago, detalle, fecha, servicio_categoria_id, paciente_id)
  VALUES
    (v_centro_id, 'ingreso', 800.00, 'efectivo', 'Mensualidad junio', current_date - 2, v_plan1_id, v_paciente1),
    (v_centro_id, 'ingreso', 1500.00, 'transferencia', 'Mensualidad junio', current_date - 1, v_plan2_id, v_paciente2),
    (v_centro_id, 'egreso', 5000.00, 'transferencia', 'Pago quincenal nómina', current_date - 5, v_egreso1_id, NULL),
    (v_centro_id, 'ingreso', 800.00, 'efectivo', 'Mensualidad mayo', current_date - 32, v_plan1_id, v_paciente1),
    (v_centro_id, 'egreso', 2500.00, 'transferencia', 'Pago quincenal nómina mayo', current_date - 35, v_egreso1_id, NULL);

  RAISE NOTICE 'Seed completado. Centro ID: %', v_centro_id;
END $$;
