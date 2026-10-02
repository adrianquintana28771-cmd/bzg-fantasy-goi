CREATE TABLE public.player_card_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.club_players(id) ON DELETE CASCADE,
  rareza public.card_rareza NOT NULL,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, rareza)
);
GRANT SELECT ON public.player_card_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.player_card_images TO authenticated;
GRANT ALL ON public.player_card_images TO service_role;
ALTER TABLE public.player_card_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fotos visibles" ON public.player_card_images FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "super_admin gestiona fotos" ON public.player_card_images FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER player_card_images_updated_at BEFORE UPDATE ON public.player_card_images
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "Fotos fichas lectura" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'player-card-images');
CREATE POLICY "Fotos fichas alta" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'player-card-images' AND public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Fotos fichas cambio" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'player-card-images' AND public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Fotos fichas borrado" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'player-card-images' AND public.has_role(auth.uid(),'super_admin'));