DROP POLICY IF EXISTS "Fotos visibles" ON public.player_card_images;
CREATE POLICY "Fotos visibles" ON public.player_card_images FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);