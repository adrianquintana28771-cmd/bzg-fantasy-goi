CREATE TABLE public.home_featured_visibility (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  show_player_of_week boolean NOT NULL DEFAULT false,
  show_top_team boolean NOT NULL DEFAULT false,
  show_ideal_seven boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_featured_visibility TO authenticated;
GRANT ALL ON public.home_featured_visibility TO service_role;
ALTER TABLE public.home_featured_visibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or super admin read" ON public.home_featured_visibility FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin insert" ON public.home_featured_visibility FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin update" ON public.home_featured_visibility FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin delete" ON public.home_featured_visibility FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));