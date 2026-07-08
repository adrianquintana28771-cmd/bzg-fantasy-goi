
-- Enum de posiciones para huecos de pista
CREATE TYPE public.plantilla_posicion AS ENUM
  ('portero','extremo_izq','extremo_der','lateral_izq','lateral_der','central','pivote');

-- Pool de jugadores ficha-bles
CREATE TABLE public.player_pool (
  id text PRIMARY KEY,
  nombre text NOT NULL,
  team_id text,
  posicion public.plantilla_posicion NOT NULL,
  rating int NOT NULL DEFAULT 70,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.player_pool TO authenticated;
GRANT ALL ON public.player_pool TO service_role;
ALTER TABLE public.player_pool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read pool" ON public.player_pool FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage pool" ON public.player_pool FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager'));

-- Jornadas
CREATE TABLE public.jornadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero int NOT NULL UNIQUE,
  nombre text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.jornadas TO authenticated;
GRANT ALL ON public.jornadas TO service_role;
ALTER TABLE public.jornadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read jornadas" ON public.jornadas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage jornadas" ON public.jornadas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager'));

-- Inventario del usuario
CREATE TABLE public.user_players (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id text NOT NULL REFERENCES public.player_pool(id) ON DELETE CASCADE,
  obtained_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, player_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_players TO authenticated;
GRANT ALL ON public.user_players TO service_role;
ALTER TABLE public.user_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own inventory read" ON public.user_players FOR SELECT TO authenticated
  USING (auth.uid()=user_id OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Own inventory write" ON public.user_players FOR ALL TO authenticated
  USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- Usos gastados por jugador (max 5 por temporada)
CREATE TABLE public.player_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id text NOT NULL REFERENCES public.player_pool(id) ON DELETE CASCADE,
  usos_gastados int NOT NULL DEFAULT 0 CHECK (usos_gastados >= 0),
  PRIMARY KEY (user_id, player_id)
);
GRANT SELECT ON public.player_usage TO authenticated;
GRANT ALL ON public.player_usage TO service_role;
ALTER TABLE public.player_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own usage read" ON public.player_usage FOR SELECT TO authenticated
  USING (auth.uid()=user_id OR public.has_role(auth.uid(),'super_admin'));

-- Alineaciones (1 por usuario y jornada)
CREATE TABLE public.lineups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jornada_id uuid NOT NULL REFERENCES public.jornadas(id) ON DELETE CASCADE,
  portero text REFERENCES public.player_pool(id),
  extremo_izq text REFERENCES public.player_pool(id),
  extremo_der text REFERENCES public.player_pool(id),
  lateral_izq text REFERENCES public.player_pool(id),
  lateral_der text REFERENCES public.player_pool(id),
  central text REFERENCES public.player_pool(id),
  pivote text REFERENCES public.player_pool(id),
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, jornada_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lineups TO authenticated;
GRANT ALL ON public.lineups TO service_role;
ALTER TABLE public.lineups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own lineup all" ON public.lineups FOR ALL TO authenticated
  USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Staff read lineups" ON public.lineups FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER set_lineups_updated_at BEFORE UPDATE ON public.lineups
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Wallet de sobres del usuario
CREATE TABLE public.user_wallet (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sobres int NOT NULL DEFAULT 3 CHECK (sobres >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_wallet TO authenticated;
GRANT ALL ON public.user_wallet TO service_role;
ALTER TABLE public.user_wallet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own wallet read" ON public.user_wallet FOR SELECT TO authenticated
  USING (auth.uid()=user_id OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Staff manage wallet" ON public.user_wallet FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER set_wallet_updated_at BEFORE UPDATE ON public.user_wallet
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Misiones
CREATE TABLE public.misiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text NOT NULL,
  recompensa_sobres int NOT NULL DEFAULT 1 CHECK (recompensa_sobres > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.misiones TO authenticated;
GRANT ALL ON public.misiones TO service_role;
ALTER TABLE public.misiones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read misiones" ON public.misiones FOR SELECT TO authenticated
  USING (is_active OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Staff manage misiones" ON public.misiones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager'));

-- Misiones reclamadas
CREATE TABLE public.user_misiones (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mision_id uuid NOT NULL REFERENCES public.misiones(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, mision_id)
);
GRANT SELECT, INSERT ON public.user_misiones TO authenticated;
GRANT ALL ON public.user_misiones TO service_role;
ALTER TABLE public.user_misiones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own misiones read" ON public.user_misiones FOR SELECT TO authenticated
  USING (auth.uid()=user_id OR public.has_role(auth.uid(),'super_admin'));

-- Función: abrir un sobre (3 jugadores aleatorios que aún no tenga)
CREATE OR REPLACE FUNCTION public.open_sobre()
RETURNS TABLE(player_id text, nombre text, posicion public.plantilla_posicion, rating int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  saldo int;
  picked record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  -- asegurar wallet
  INSERT INTO public.user_wallet(user_id) VALUES (uid)
    ON CONFLICT (user_id) DO NOTHING;

  SELECT sobres INTO saldo FROM public.user_wallet WHERE user_id = uid FOR UPDATE;
  IF saldo IS NULL OR saldo <= 0 THEN
    RAISE EXCEPTION 'sin sobres disponibles';
  END IF;

  UPDATE public.user_wallet SET sobres = sobres - 1 WHERE user_id = uid;

  RETURN QUERY
  WITH nuevos AS (
    SELECT p.id, p.nombre, p.posicion, p.rating
    FROM public.player_pool p
    WHERE p.id NOT IN (SELECT up.player_id FROM public.user_players up WHERE up.user_id = uid)
    ORDER BY random()
    LIMIT 3
  ),
  ins AS (
    INSERT INTO public.user_players(user_id, player_id)
    SELECT uid, n.id FROM nuevos n
    RETURNING player_id
  )
  SELECT n.id, n.nombre, n.posicion, n.rating FROM nuevos n;
END;
$$;
GRANT EXECUTE ON FUNCTION public.open_sobre() TO authenticated;

-- Función: reclamar misión (añade sobres al wallet)
CREATE OR REPLACE FUNCTION public.claim_mision(_mision_id uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  reward int;
  nuevo_saldo int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT recompensa_sobres INTO reward FROM public.misiones
    WHERE id = _mision_id AND is_active = true;
  IF reward IS NULL THEN RAISE EXCEPTION 'misión no encontrada'; END IF;

  INSERT INTO public.user_misiones(user_id, mision_id) VALUES (uid, _mision_id);

  INSERT INTO public.user_wallet(user_id, sobres) VALUES (uid, reward)
    ON CONFLICT (user_id) DO UPDATE SET sobres = public.user_wallet.sobres + EXCLUDED.sobres;

  SELECT sobres INTO nuevo_saldo FROM public.user_wallet WHERE user_id = uid;
  RETURN nuevo_saldo;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_mision(uuid) TO authenticated;

-- Función: cerrar jornada — incrementa usos de todos los alineados y marca locked
CREATE OR REPLACE FUNCTION public.close_jornada(_jornada_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'permiso denegado';
  END IF;

  WITH alineados AS (
    SELECT user_id, unnest(ARRAY[portero,extremo_izq,extremo_der,lateral_izq,lateral_der,central,pivote]) AS pid
    FROM public.lineups WHERE jornada_id = _jornada_id AND NOT locked
  ), filtrados AS (
    SELECT user_id, pid FROM alineados WHERE pid IS NOT NULL
  )
  INSERT INTO public.player_usage(user_id, player_id, usos_gastados)
  SELECT user_id, pid, count(*)::int FROM filtrados GROUP BY user_id, pid
  ON CONFLICT (user_id, player_id) DO UPDATE
    SET usos_gastados = public.player_usage.usos_gastados + EXCLUDED.usos_gastados;

  UPDATE public.lineups SET locked = true WHERE jornada_id = _jornada_id;
  UPDATE public.jornadas SET is_locked = true, is_active = false WHERE id = _jornada_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.close_jornada(uuid) TO authenticated;

-- Extender handle_new_user para crear wallet inicial (3 sobres)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, dni, display_name)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'dni', new.id::text),
    new.raw_user_meta_data->>'display_name'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user');
  INSERT INTO public.user_wallet (user_id, sobres) VALUES (new.id, 3)
    ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END $$;

-- Seed pool: 30 jugadores (nombres y equipos coinciden con la mock data existente)
INSERT INTO public.player_pool (id, nombre, team_id, posicion, rating) VALUES
('p1','Jon M.','t1','portero',75),
('p2','Iker A.','t1','extremo_izq',72),
('p3','Unai B.','t1','lateral_izq',78),
('p4','Ander G.','t1','central',80),
('p5','Aitor R.','t1','pivote',74),
('p6','Ane G.','t2','portero',76),
('p7','Nora Z.','t2','extremo_der',73),
('p8','Maialen E.','t2','lateral_der',77),
('p9','Leire O.','t2','central',82),
('p10','Uxue T.','t2','pivote',75),
('p11','Oihan V.','t3','portero',68),
('p12','Eneko C.','t3','extremo_izq',70),
('p13','Danel Q.','t3','lateral_izq',71),
('p14','Mikel H.','t3','central',73),
('p15','Beñat L.','t3','pivote',69),
('p16','Naia H.','t4','portero',67),
('p17','Irati L.','t4','extremo_der',69),
('p18','June K.','t4','lateral_der',72),
('p19','Amaia P.','t4','central',74),
('p20','Miren D.','t4','pivote',68),
('p21','Xabi F.','t5','portero',64),
('p22','Julen S.','t5','extremo_izq',66),
('p23','Asier N.','t5','lateral_izq',68),
('p24','Peio R.','t5','central',70),
('p25','Haritz U.','t5','pivote',65),
('p26','Elene B.','t6','portero',65),
('p27','Nahia J.','t6','extremo_der',67),
('p28','Malen R.','t6','lateral_der',69),
('p29','Izaro C.','t6','central',71),
('p30','Nerea A.','t6','pivote',66);

-- Seed jornada activa
INSERT INTO public.jornadas (numero, nombre, is_active) VALUES (1, 'Jornada 1', true);

-- Seed misiones iniciales
INSERT INTO public.misiones (nombre, descripcion, recompensa_sobres) VALUES
('Bienvenida', 'Entra por primera vez a tu Plantilla.', 1),
('Alinea 7 titulares', 'Rellena todos los huecos de la pista en una jornada.', 1),
('Comparte con un amigo', 'Invita a otra persona al Fantasy.', 2);

-- Backfill wallets para usuarios existentes
INSERT INTO public.user_wallet (user_id, sobres)
SELECT id, 3 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
