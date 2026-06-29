-- ============================================================
-- AlCheque — Migración manual: Periodo pagado en transacciones
-- ============================================================
-- Ejecutar manualmente en Supabase Dashboard > SQL Editor.
-- Permite saber a qué mensualidad corresponde un pago aunque la
-- fecha real del cobro sea distinta.

ALTER TABLE transacciones
ADD COLUMN IF NOT EXISTS periodo_pago text;

ALTER TABLE transacciones
DROP CONSTRAINT IF EXISTS transacciones_periodo_pago_formato_chk;

ALTER TABLE transacciones
ADD CONSTRAINT transacciones_periodo_pago_formato_chk
CHECK (periodo_pago IS NULL OR periodo_pago ~ '^\d{4}-\d{2}$');

CREATE INDEX IF NOT EXISTS idx_transacciones_periodo_pago
ON transacciones (centro_id, periodo_pago)
WHERE periodo_pago IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transacciones_paciente_periodo_pago
ON transacciones (paciente_id, periodo_pago)
WHERE paciente_id IS NOT NULL AND periodo_pago IS NOT NULL AND deleted_at IS NULL;
