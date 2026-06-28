-- ============================================================
-- STORAGE: policies para comprobantes con soporte WebP
-- ============================================================
-- Ejecutar manualmente en Supabase SQL Editor si el Dashboard ya tiene
-- policies creadas. El error "new row violates row-level security policy"
-- al subir .webp aparece cuando la policy de storage.objects no permite
-- la nueva extension o content-type convertido.

DROP POLICY IF EXISTS "comprobantes_insert_owner" ON storage.objects;
DROP POLICY IF EXISTS "comprobantes_select_owner" ON storage.objects;
DROP POLICY IF EXISTS "comprobantes_delete_owner" ON storage.objects;

CREATE POLICY "comprobantes_insert_owner"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'comprobantes'
  AND public.is_centro_owner((split_part(name, '/', 1))::uuid)
  AND lower(split_part(name, '.', array_length(string_to_array(name, '.'), 1))) IN ('jpg', 'jpeg', 'png', 'webp', 'pdf')
);

CREATE POLICY "comprobantes_select_owner"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'comprobantes'
  AND public.is_centro_owner((split_part(name, '/', 1))::uuid)
);

CREATE POLICY "comprobantes_delete_owner"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'comprobantes'
  AND public.is_centro_owner((split_part(name, '/', 1))::uuid)
);
