DROP POLICY IF EXISTS "Fotos fichas lectura" ON storage.objects;
CREATE POLICY "Fotos fichas lectura" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'player-card-images' AND (select auth.uid()) IS NOT NULL);