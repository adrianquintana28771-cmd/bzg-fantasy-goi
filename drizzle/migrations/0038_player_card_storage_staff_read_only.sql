DROP POLICY IF EXISTS "Fotos fichas lectura" ON storage.objects;
CREATE POLICY "Fotos fichas lectura" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'player-card-images' AND public.has_role((select auth.uid()), 'super_admin'::public.app_role));