-- Migration to add soft delete support (deleted_at) to key tables

ALTER TABLE pacientes ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE transacciones ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE servicios_categorias ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE terapeutas ADD COLUMN deleted_at timestamptz DEFAULT NULL;
