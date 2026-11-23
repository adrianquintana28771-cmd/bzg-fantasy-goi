import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows, fetchTeams } from "@/lib/club-data";
import { useAuth } from "@/lib/auth-context";
import { useT, useLang } from "@/lib/i18n";
import { BackButton } from "@/components/back-button";
import { CATEGORY_LABEL, CATEGORY_LABEL_EU } from "@/lib/fantasy/types";
import { EquipoCard, type PoolRow, type Rareza, type Posicion } from "@/components/equipo-card";
import { useCardImages, usePhotoSource } from "@/lib/card-images";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/coleccion")({
  head: () => {
    const title = "Mi colección de fichas | BZG Fantasy Eskubaloia";
    const description = "Colección de fichas común, rara y legendaria de cada jugador/a del BZG Etxebarri conseguidas en sobres.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: Coleccion,
});

const RZ: Rareza[] = ["normal", "raro", "legendario"];
type Row = {
  id: string; nombre: string; posicion: Posicion; rareza: Rareza; rating: number; estado: PoolRow["estado"];
  team_id: string | null; club_player_id: string | null;
  club: { nombre: string; apellido1: string | null; apellido2: string | null; dorsal: number | null; activo: boolean } | null;
};

function Coleccion() {
  const t = useT();
  const { lang } = useLang();
  const CAT = lang === "eu" ? CATEGORY_LABEL_EU : CATEGORY_LABEL;
  const { user, loading, isStaff } = useAuth();
  const images = useCardImages();
  const teamsQ = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const poolQ = useQuery({
    queryKey: ["coleccion-pool"],
    queryFn: () => fetchAllRows((f, to) =>
      supabase.from("player_pool")
        .select("id,nombre,posicion,rareza,rating,estado,team_id,club_player_id,club:club_players!inner(nombre,apellido1,apellido2,dorsal,activo)")
        .eq("club.activo", true).range(f, to)) as unknown as Promise<Row[]>,
  });
  const ownedQ = useQuery({
    queryKey: ["coleccion-owned", user?.id],
    enabled: !!user && !isStaff,
    queryFn: async () => {
      const rows = await fetchAllRows((f, to) => supabase.from("user_players").select("player_id").eq("user_id", user!.id).range(f, to));
      return new Set(rows.map((r) => r.player_id));
    },
  });
  const [category, setCategory] = useState("");
  const [gender, setGender] = useState("");
  const [teamId, setTeamId] = useState("");
  const [big, setBig] = useState<PoolRow | null>(null);
  const [photo, setPhoto] = useState<PoolRow | null>(null);

  const allTeams = useMemo(() => [...(teamsQ.data ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre)), [teamsQ.data]);
  const teams = allTeams.filter((tm) => (!category || tm.categoria === category) && (!gender || tm.sexo === gender));
  const catOptions = (["cadete", "juvenil", "senior"] as const).filter((k) => allTeams.some((tm) => tm.categoria === k && (!gender || tm.sexo === gender)));
  const genderOptions = (["masculino", "femenino"] as const).filter((g) => allTeams.some((tm) => tm.sexo === g && (!category || tm.categoria === category)));
  useEffect(() => { if (teamId && !teams.some((tm) => tm.id === teamId)) setTeamId(""); }, [category, gender, teamId, teams]);

  const groups = useMemo(() => {
    const teamMap = new Map(allTeams.map((tm) => [tm.id, tm]));
    const m = new Map<string, { key: string; row: Row; cards: Partial<Record<Rareza, Row>> }>();
    for (const r of poolQ.data ?? []) {
      if (!r.team_id || !teamMap.has(r.team_id)) continue;
      const key = `${r.club_player_id ?? r.id}|${r.team_id}`;
      const g = m.get(key) ?? { key, row: r, cards: {} };
      g.cards[r.rareza] = r;
      if (r.rareza === "normal") g.row = r;
      m.set(key, g);
    }
    return [...m.values()]
      .map((g) => ({ ...g, team: teamMap.get(g.row.team_id!)! }))
      .filter((g) => (!category || g.team.categoria === category) && (!gender || g.team.sexo === gender) && (!teamId || g.team.id === teamId))
      .sort((a, b) => a.team.nombre.localeCompare(b.team.nombre) || (a.row.club?.dorsal ?? 999) - (b.row.club?.dorsal ?? 999) || a.row.nombre.localeCompare(b.row.nombre));
  }, [poolQ.data, allTeams, category, gender, teamId]);

  if (loading) return <div className="p-10 text-center text-muted-foreground">{t("Kargatzen…", "Cargando…")}</div>;
  if (!user || isStaff) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <BackButton />
        <h1 className="mt-4 font-display text-3xl">{t("Nire bilduma", "Mi colección")}</h1>
        <p className="mt-2 text-muted-foreground">
          {!user ? t("Hasi saioa zure bilduma ikusteko.", "Inicia sesión para ver tu colección.") : t("Administrazio kontuek ez dute bildumarik.", "Las cuentas de administración no tienen colección.")}
        </p>
        {!user && <Link to="/auth" className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Hasi saioa", "Iniciar sesión")}</Link>}
      </div>
    );
  }

  const owned = ownedQ.data ?? new Set<string>();
  const total = groups.reduce((n, g) => n + RZ.filter((rz) => g.cards[rz]).length, 0);
  const have = groups.reduce((n, g) => n + RZ.filter((rz) => g.cards[rz] && owned.has(g.cards[rz]!.id)).length, 0);
  const toPool = (r: Row, team: { id: string; nombre: string }): PoolRow => ({ id: r.id, nombre: r.nombre, posicion: r.posicion, rating: r.rating, rareza: r.rareza, club_player_id: r.club_player_id, team_id: r.team_id, estado: r.estado, club_teams: team });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BackButton />
      <h1 className="mt-3 font-display text-4xl">{t("Nire bilduma", "Mi colección")}</h1>
      <p className="text-sm text-muted-foreground">{t("Lortutako fitxak", "Fichas conseguidas")}: {have}/{total}</p>

      <div className="mt-6 grid grid-cols-1 gap-2 rounded-2xl border border-border bg-card p-3 shadow-card sm:grid-cols-3">
        <Sel value={category} onChange={setCategory} label={t("Kategoria", "Categoría")}>
          <option value="">{t("Guztiak", "Todas")}</option>
          {catOptions.map((k) => <option key={k} value={k}>{CAT[k]}</option>)}
        </Sel>
        <Sel value={gender} onChange={setGender} label={t("Sexua", "Sexo")}>
          <option value="">{t("Guztiak", "Todos")}</option>
          {genderOptions.includes("masculino") && <option value="masculino">{t("Gizonezkoa", "Masculino")}</option>}
          {genderOptions.includes("femenino") && <option value="femenino">{t("Emakumezkoa", "Femenino")}</option>}
        </Sel>
        <Sel value={teamId} onChange={setTeamId} label={t("Taldea", "Equipo")}>
          <option value="">{t("Guztiak", "Todos")}</option>
          {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.nombre}</option>)}
        </Sel>
      </div>

      {(poolQ.isLoading || ownedQ.isLoading) && <p className="mt-6 text-sm text-muted-foreground">{t("Kargatzen…", "Cargando…")}</p>}
      <div className="mt-6 space-y-6">
        {groups.map((g) => {
          const c = g.row.club;
          return (
            <section key={g.key} className="rounded-2xl border border-border bg-card p-3 shadow-card">
              <h2 translate="no" className="text-sm font-semibold">
                {[c?.nombre ?? g.row.nombre, c?.apellido1, c?.apellido2].filter(Boolean).join(" ")}
              </h2>
              <p className="text-xs text-muted-foreground"><span translate="no">{g.team.nombre}</span>{c?.dorsal != null && ` · #${c.dorsal}`}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {RZ.map((rz) => {
                  const r = g.cards[rz];
                  if (!r || !owned.has(r.id)) {
                    return <div key={rz} aria-label={t("Lortu gabeko fitxa", "Ficha no conseguida")} className="aspect-[518/763] rounded-lg border-2 border-dashed border-border bg-secondary/40" />;
                  }
                  const p = toPool(r, g.team);
                  return (
                    <div key={rz} role="button" tabIndex={0} onClick={() => setBig(p)} onKeyDown={(e) => e.key === "Enter" && setBig(p)} className="relative cursor-pointer">
                      <EquipoCard pool={p} images={images.data} posiciones={[p.posicion]} puntos={0} />
                      <button type="button" aria-label={t("Argazkia handitu", "Ampliar foto")} onClick={(e) => { e.stopPropagation(); setPhoto(p); }} className="absolute left-[7.7%] top-[15.6%] h-[31.5%] w-[34%]" />
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        {!poolQ.isLoading && groups.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            {t("Ez dago jokalaririk aukeratutako iragazkiekin.", "No hay jugadores/as con los filtros seleccionados.")}
          </div>
        )}
      </div>

      <Dialog open={!!big} onOpenChange={(o) => !o && setBig(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="sr-only">{big?.nombre}</DialogTitle>
          {big && (
            <div className="relative">
              <EquipoCard pool={big} images={images.data} posiciones={[big.posicion]} puntos={0} />
              <button type="button" aria-label={t("Argazkia handitu", "Ampliar foto")} onClick={() => setPhoto(big)} className="absolute left-[7.7%] top-[15.6%] h-[31.5%] w-[34%]" />
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!photo} onOpenChange={(o) => !o && setPhoto(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">{photo?.nombre}</DialogTitle>
          {photo && <BigPhoto pool={photo} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BigPhoto({ pool }: { pool: PoolRow }) {
  const images = useCardImages();
  const { src, onError } = usePhotoSource(images.data, pool.club_player_id, pool.rareza);
  return src ? <img src={src} onError={onError} alt={pool.nombre} className="max-h-[80vh] w-full rounded-lg object-contain" /> : null;
}

function Sel({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
        {children}
      </select>
    </label>
  );
}
