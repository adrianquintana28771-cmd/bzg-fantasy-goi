CREATE TABLE public.match_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  url text NOT NULL,
  team_id uuid REFERENCES public.club_teams(id),
  equipo_fed text,
  activo boolean NOT NULL DEFAULT true,
  ultima_sync timestamptz,
  ultimo_resultado text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_sources TO authenticated;
GRANT ALL ON public.match_sources TO service_role;
ALTER TABLE public.match_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin lee fuentes" ON public.match_sources FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super_admin crea fuentes" ON public.match_sources FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super_admin edita fuentes" ON public.match_sources FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER match_sources_updated BEFORE UPDATE ON public.match_sources FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.club_matches ADD COLUMN IF NOT EXISTS competicion text;
ALTER TABLE public.club_matches ADD COLUMN IF NOT EXISTS fuente_id uuid REFERENCES public.match_sources(id);

INSERT INTO public.match_sources (nombre, url, team_id, equipo_fed) VALUES
('Senior femenino','https://www.fvbm.eus/clasificaciones?id=3707&desp=2003#','daaed2e1-ac36-44c0-a87c-5ebf7778f5e4','BZG NAILUK BERDE'),
('Senior masculino','https://www.fvbm.eus/clasificaciones?id=3641&desp=2049#','61d811d0-6cc3-4116-94c0-7e37d7aac208','BZG NAILUK ZURI'),
('Juvenil masculino','https://www.fvbm.eus/clasificaciones?id=3651&desp=20715#','fe46dc49-92e8-4885-983b-1b3c62c2e0a3','BERDEZURIGORRI ZURI'),
('Juvenil femenino','https://www.fvbm.eus/clasificaciones?id=3645&desp=20817#','607ceb89-3980-425c-8f3b-e3d9d2e2cb6c','BERDEZURIGORRI BERDE'),
('Cadete masculino','https://www.fvbm.eus/clasificaciones?id=3657&desp=20919#','4a1b7ed9-13af-4fbd-b142-fbf6da6037a1','BERDEZURIGORRI ZURI'),
('Cadete femenino — BERDEZURIGORRI BERDE','https://www.fvbm.eus/clasificaciones?id=3653&desp=21123#','3dae4f92-37e4-4a5e-ba0e-407597731a07','BERDEZURIGORRI BERDE'),
('Cadete femenino — BERDEZURIGORRI GORRI','https://www.fvbm.eus/clasificaciones?id=3654&desp=21225#','1b3f9148-468c-4e19-8949-a8f6a806c5df','BERDEZURIGORRI GORRI');