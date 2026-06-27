-- ============================================================
-- AlCheque — Actualización módulo de pacientes
-- ============================================================

ALTER TABLE pacientes
  DROP COLUMN IF EXISTS telefono,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS fecha_nacimiento,
  DROP COLUMN IF EXISTS notas;
