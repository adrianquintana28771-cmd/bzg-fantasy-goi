import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import { AdminGuard } from "@/components/admin-guard";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { ESTADO_LABEL, ESTADO_LABEL_EU, type PlayerEstado } from "@/lib/fantasy/types";
import { supabase } from "@/integrations/supabase/client";
import { pctParadas, tramoPctPts, tramoPts, type Tramo } from "@/lib/club-data";

export const Route = createFileRoute("/admin/desempeno")({
  head: () => ({
    meta: [
      { title: "Desempeño de jugadores/as · BZG Fantasy" },
      {
        name: "description",
        content: "Formulario para registrar el desempeño de cada jugador/a en cada partido.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <Desempeno />
    </AdminGuard>
  ),
});

interface MatchRow {
  id: string;
  rival: string;
  fecha: string;
  jornada: number;
  es_local: boolean;
  goles_favor: number;
  goles_contra: number;
  team_id: string;
  club_teams: { nombre: string; categoria: string; sexo: string } | null;
}
interface ActionRow {
  id: string;
  nombre: string;
  puntos: number;
  grupo: string;
  solo_portero: boolean;
  solo_entrenador: boolean;
  es_resultado: string | null;
  orden: number;
  tramos: Tramo[] | null;
}
interface PlayerRow {
  dorsal: number | null;
  club_players: {
    id: string;
    nombre: string;
    alias: string | null;
    apellido1: string | null;
    apellido2: string | null;
    es_entrenador: boolean;
    estado: PlayerEstado;
    club_player_positions: { position_id: string; es_principal: boolean }[];
  } | null;
}

function Desempeno() {
  const { canEditStats, canManageAll } = useAuth();
  const { t, td, lang } = useLang();
  const qc = useQueryClient();
  const [matchId, setMatchId] = useState<string>("");
  const [jornada, setJornada] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const matches = useQuery({
    queryKey: ["club_matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_matches")
        .select(
          "id,rival,fecha,jornada,es_local,goles_favor,goles_contra,team_id,club_teams(nombre,categoria,sexo)",
        )
        .order("fecha", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MatchRow[];
    },
  });

  const actions = useQuery({
    queryKey: ["club_action_types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_action_types")
        .select("id,nombre,puntos,grupo,solo_portero,solo_entrenador,es_resultado,orden,tramos")
        .eq("activo", true)
        .order("orden");
      if (error) throw error;
      return (data ?? []) as unknown as ActionRow[];
    },
  });

  const jornadas = Array.from(new Set((matches.data ?? []).map((m) => m.jornada))).sort(
    (a, b) => a - b,
  );
  const match = matches.data?.find((m) => m.id === matchId) ?? null;

  const roster = useQuery({
    queryKey: ["club_roster", match?.team_id],
    enabled: !!match?.team_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_player_teams")
        .select(
          "dorsal,club_players(id,nombre,alias,apellido1,apellido2,es_entrenador,estado,club_player_positions(position_id,es_principal))",
        )
        .eq("team_id", match!.team_id);
      if (error) throw error;
      return (data ?? []) as unknown as PlayerRow[];
    },
  });

  /** Todos los jugadores/as con su equipo habitual (para invitados de otros equipos) */
  const allPlayers = useQuery({
    queryKey: ["club_all_players"],
    enabled: !!match,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_player_teams")
        .select(
          "team_id,dorsal,club_teams(nombre),club_players(id,nombre,alias,apellido1,apellido2,es_entrenador,estado,club_player_positions(position_id,es_principal))",
        );
      if (error) throw error;
      return (data ?? []) as unknown as (PlayerRow & {
        team_id: string;
        club_teams: { nombre: string } | null;
      })[];
    },
  });

  const matchPlayers = useQuery({
    queryKey: ["club_match_players", matchId],
    enabled: !!matchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_match_players")
        .select("player_id")
        .eq("match_id", matchId);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.player_id));
    },
  });

  const rosterIds = new Set((roster.data ?? []).map((r) => r.club_players?.id));
  const externos = (allPlayers.data ?? []).filter(
    (r) => r.club_players && !rosterIds.has(r.club_players.id),
  );
  const invitadosMap = new Map<string, (typeof externos)[number]>();
  for (const r of externos)
    if (matchPlayers.data?.has(r.club_players!.id) && !invitadosMap.has(r.club_players!.id))
      invitadosMap.set(r.club_players!.id, r);
  const invitados = [...invitadosMap.values()];
  const candidatos = externos
    .filter((r) => !invitadosMap.has(r.club_players!.id))
    .sort((a, b) => fullName(a.club_players!).localeCompare(fullName(b.club_players!)));
  const [externoSel, setExternoSel] = useState("");

  async function addExterno() {
    if (!externoSel || !matchId || matchPlayers.data?.has(externoSel)) return;
    const { error } = await supabase
      .from("club_match_players")
      .upsert({ match_id: matchId, player_id: externoSel, jugado: true } as never, {
        onConflict: "match_id,player_id",
      });
    if (error) {
      toast.error(t("Ezin izan da gehitu", "No se ha podido añadir"));
      return;
    }
    await qc.invalidateQueries({ queryKey: ["club_match_players", matchId] });
    setPlayerId(externoSel);
    setExternoSel("");
  }

  const existing = useQuery({
    queryKey: ["club_match_actions", matchId, playerId],
    enabled: !!matchId && !!playerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_match_actions")
        .select("action_id,cantidad")
        .eq("match_id", matchId)
        .eq("player_id", playerId);
      if (error) throw error;
      return (data ?? []) as { action_id: string; cantidad: number }[];
    },
  });

  /** Los criterios que edita el super admin se refrescan en tiempo real */
  useEffect(() => {
    const channel = supabase
      .channel("criterios-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "club_action_types" }, () => {
        qc.invalidateQueries({ queryKey: ["club_action_types"] });
        toast.info(t("Puntuazio-irizpideak eguneratuta", "Criterios de puntuación actualizados"));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const r of existing.data ?? []) next[r.action_id] = r.cantidad;
    setCounts(next);
  }, [existing.data, playerId, matchId]);

  const player =
    [...(roster.data ?? []), ...invitados].find((r) => r.club_players?.id === playerId)
      ?.club_players ?? null;
  const esEntrenador = !!player?.es_entrenador;
  const esPortero =
    !esEntrenador && !!player?.club_player_positions?.some((p) => p.position_id === "portero");
  const EST_LABEL = lang === "eu" ? ESTADO_LABEL_EU : ESTADO_LABEL;

  const visibleActions = useMemo(
    () =>
      (actions.data ?? []).filter((a) =>
        a.id === PCT_ID
          ? false
          : esEntrenador
          ? a.solo_entrenador
          : esPortero
            ? a.solo_portero
            : !a.solo_portero && !a.solo_entrenador,
      ),
    [actions.data, esPortero, esEntrenador],
  );

  /** Otros porteros/as con acciones de portería en este partido (regla de 2+ porteros) */
  const otrosPorteros = useQuery({
    queryKey: ["club_match_gk", matchId, playerId],
    enabled: !!matchId && !!playerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_match_actions")
        .select("player_id")
        .eq("match_id", matchId)
        .neq("player_id", playerId)
        .in("action_id", ["parada", "gol_encajado", "lanzamiento_fuera"])
        .gt("cantidad", 0);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.player_id)).size;
    },
  });
  const variosPorteros = (otrosPorteros.data ?? 0) > 0;

  const accionPts = (a: ActionRow) => {
    const n = counts[a.id] ?? 0;
    if (a.id === "parada" && a.tramos?.length) return tramoPts(n, a.tramos);
    if (a.id === "gol_encajado" && a.tramos?.length && !variosPorteros) return tramoPts(n, a.tramos);
    return n * Number(a.puntos);
  };
  const pctAction = (actions.data ?? []).find((a) => a.id === PCT_ID);
  const pct = esPortero
    ? pctParadas(counts.parada ?? 0, counts.lanzamiento_fuera ?? 0, counts.gol_encajado ?? 0)
    : null;
  const pctPts = pct != null && pctAction?.tramos?.length ? tramoPctPts(pct, pctAction.tramos) : 0;

  const total = Math.round((visibleActions.reduce((acc, a) => acc + accionPts(a), 0) + pctPts) * 100) / 100;

  function bump(id: string, delta: number) {
    const act = visibleActions.find((a) => a.id === id);
    const esRes = (a?: ActionRow) => !!a && (a.grupo === "resultado" || !!a.es_resultado);
    if (esRes(act)) {
      // Resultado exclusivo: victoria, empate o derrota
      setCounts((c) => {
        const n = { ...c };
        for (const a of visibleActions) if (esRes(a)) n[a.id] = 0;
        n[id] = delta > 0 ? 1 : 0;
        return n;
      });
      return;
    }
    setCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + delta) }));
  }

  async function save() {
    if (!matchId || !playerId) return;
    setSaving(true);
    try {
      const rows = visibleActions.map((a) => ({
        match_id: matchId,
        player_id: playerId,
        action_id: a.id,
        cantidad: counts[a.id] ?? 0,
      }));
      const { error } = await supabase
        .from("club_match_actions")
        .upsert(rows as never, { onConflict: "match_id,player_id,action_id" });
      if (error) throw error;
      await supabase
        .from("club_match_players")
        .upsert({ match_id: matchId, player_id: playerId, jugado: true } as never, {
          onConflict: "match_id,player_id",
        });
      toast.success(`${t("Errendimendua gordeta", "Desempeño guardado")} · ${total} ${t("puntu", "puntos")}`);
      qc.invalidateQueries({ queryKey: ["club_match_actions"] });
      qc.invalidateQueries({ queryKey: ["club_match_players", matchId] });
    } catch (e) {
      console.error(e);
      toast.error(t("Ezin izan da errendimendua gorde", "No se ha podido guardar el desempeño"));
    } finally {
      setSaving(false);
    }
  }

  if (!canEditStats) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <BackButton />
        <h1 className="mt-4 font-display text-3xl">{t("Baimenik ez", "Sin permisos")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "Adminek eta super adminak bakarrik edita dezakete errendimendua.",
            "Sólo los admins y el super admin pueden editar el desempeño.",
          )}
        </p>
      </div>
    );
  }

  const grupos = Array.from(new Set(visibleActions.map((a) => a.grupo)));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BackButton />
      <h1 className="mt-3 font-display text-4xl">{t("Errendimendua jokalariz", "Desempeño por jugador/a")}</h1>
      <p className="text-sm text-muted-foreground">
        {t(
          "Aukeratu partida bat eta jokalari bat, eta idatzi ekintza bakoitza. Puntuak berez kalkulatzen dira.",
          "Elige un partido y un jugador/a, y anota cada acción. Los puntos se calculan solos.",
        )}
      </p>

      {canManageAll && <TramosPortero actions={actions.data ?? []} />}

      <div className="mt-6 grid gap-3">
        <label className="text-sm font-semibold">
          {t("Jardunaldia", "Jornada")}
          <select
            value={jornada}
            onChange={(e) => {
              setJornada(e.target.value);
              setMatchId("");
              setPlayerId("");
            }}
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm"
          >
            <option value="">{t("Aukeratu jardunaldi bat…", "Selecciona una jornada…")}</option>
            {jornadas.map((j) => (
              <option key={j} value={j}>
                {t(`${j}. jardunaldia`, `Jornada ${j}`)}
              </option>
            ))}
          </select>
        </label>
        {jornada && (
        <label className="text-sm font-semibold">
          {t("Partida", "Partido")}
          <select
            value={matchId}
            onChange={(e) => {
              setMatchId(e.target.value);
              setPlayerId("");
            }}
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm"
          >
            <option value="">{t("Aukeratu partida bat…", "Selecciona un partido…")}</option>
            {(matches.data ?? []).filter((m) => String(m.jornada) === jornada).map((m) => (
              <option key={m.id} value={m.id}>
                {m.club_teams?.nombre} vs {m.rival} · J{m.jornada} ·{" "}
                {new Date(m.fecha).toLocaleDateString(lang === "eu" ? "eu-ES" : "es-ES")}
              </option>
            ))}
          </select>
        </label>
        )}

        {match && (
          <div>
            <div className="text-sm font-semibold">{t("Jokalaria", "Jugador/a")}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(roster.data ?? []).map((r) => {
                const p = r.club_players;
                if (!p) return null;
                const active = p.id === playerId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlayerId(p.id)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-secondary"
                    }`}
                  >
                    <span translate="no">{fullName(p)}</span>
                    {r.dorsal ? ` — ${r.dorsal}` : ""}
                    <EstadoTag estado={p.estado} label={EST_LABEL[p.estado]} active={active} />
                  </button>
                );
              })}
              {invitados.map((r) => {
                const p = r.club_players!;
                const active = p.id === playerId;
                return (
                  <button
                    key={`inv-${p.id}`}
                    type="button"
                    onClick={() => setPlayerId(p.id)}
                    className={`rounded-xl border border-dashed px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-secondary"
                    }`}
                  >
                    <span translate="no">{fullName(p)}</span>
                    {r.dorsal ? ` — ${r.dorsal}` : ""} · {r.club_teams?.nombre}
                    <EstadoTag estado={p.estado} label={EST_LABEL[p.estado]} active={active} />
                  </button>
                );
              })}
              {roster.data?.length === 0 && invitados.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  {t("Talde honek oraindik ez du jokalaririk.", "Este equipo aún no tiene jugadores/as.")}
                </span>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <select
                value={externoSel}
                onChange={(e) => setExternoSel(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="">
                  {t("+ Beste talde bateko jokalaria gehitu", "+ Añadir jugador de otro equipo")}
                </option>
                {candidatos.map((r) => (
                  <option key={`${r.club_players!.id}-${r.team_id}`} value={r.club_players!.id}>
                    {fullName(r.club_players!)}
                    {r.dorsal ? ` — ${r.dorsal}` : ""} · {r.club_teams?.nombre}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addExterno}
                disabled={!externoSel}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {match && player && (
        <>
          <div className="sticky top-16 z-30 mt-6 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-card">
            <div>
              <div translate="no" className="font-display text-xl">{fullName(player)}</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {esEntrenador
                    ? t("Entrenatzailea", "Entrenador/a")
                    : esPortero
                      ? t("Atezaina", "Portero/a")
                      : t("Zelaiko jokalaria", "Jugador/a de campo")}
                </span>
                {esPortero && (
                  <span>
                    · {t("Geldiketak", "Paradas")}: {pct == null ? "—" : `${String(pct).replace(".", ",")} %`}
                    {variosPorteros && ` · ${t("2+ atezain", "2+ porteros")}`}
                  </span>
                )}
                <EstadoTag
                  estado={player.estado}
                  label={EST_LABEL[player.estado]}
                  active={false}
                />
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("Puntuak", "Puntos")}
              </div>
              <div
                className={`font-display text-3xl ${total >= 0 ? "text-primary" : "text-destructive"}`}
              >
                {total}
              </div>
            </div>
          </div>

          {grupos.map((g) => (
            <div key={g} className="mt-6">
              <h2 className="font-display text-lg capitalize">{td(g)}</h2>
              <div className="mt-2 grid gap-2">
                {visibleActions
                  .filter((a) => a.grupo === g)
                  .map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{td(a.nombre)}</div>
                        <div
                          className={`text-xs ${Number(a.puntos) >= 0 ? "text-primary" : "text-destructive"}`}
                        >
                          {Number(a.puntos) > 0 ? `+${a.puntos}` : a.puntos} pts
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          aria-label={`${t("Kendu", "Restar")} ${td(a.nombre)}`}
                          onClick={() => bump(a.id, -1)}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-background"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center font-display text-xl">
                          {counts[a.id] ?? 0}
                        </span>
                        <button
                          type="button"
                          aria-label={`${t("Gehitu", "Sumar")} ${td(a.nombre)}`}
                          onClick={() => bump(a.id, 1)}
                          className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}

          <button
            onClick={save}
            disabled={saving}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-card disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? t("Gordetzen…", "Guardando…") : t("Errendimendua gorde", "Guardar desempeño")}
          </button>
        </>
      )}
    </div>
  );
}

const PCT_ID = "porcentaje_paradas";
const TRAMO_IDS = ["parada", "gol_encajado", PCT_ID];

/** Editor super_admin de tramos de portero: se guarda en club_action_types.tramos y la BD recalcula sola. */
function TramosPortero({ actions }: { actions: ActionRow[] }) {
  const { t, td } = useLang();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, Tramo[]>>({});
  useEffect(() => {
    const d: Record<string, Tramo[]> = {};
    for (const a of actions) if (TRAMO_IDS.includes(a.id)) d[a.id] = a.tramos ?? [];
    setDraft(d);
  }, [actions]);
  const [saving, setSaving] = useState("");

  async function guardar(id: string) {
    const tramos = (draft[id] ?? [])
      .filter((r) => Number.isFinite(r.desde) && Number.isFinite(r.puntos))
      .sort((a, b) => a.desde - b.desde);
    setSaving(id);
    const { error } = await supabase.from("club_action_types").update({ tramos } as never).eq("id", id);
    setSaving("");
    if (error) return toast.error(t("Ezin izan da gorde", "No se pudo guardar"));
    toast.success(t("Tarteak gordeta · puntuazioak berriro kalkulatuta", "Tramos guardados · puntuaciones recalculadas"));
    qc.invalidateQueries({ queryKey: ["club_action_types"] });
  }

  const set = (id: string, i: number, k: keyof Tramo, v: string) =>
    setDraft((d) => ({
      ...d,
      [id]: d[id].map((r, j) => (j === i ? { ...r, [k]: v === "" && k === "hasta" ? null : Number(v) } : r)),
    }));

  return (
    <details className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-card">
      <summary className="cursor-pointer font-display text-lg">
        {t("Atezainen tarteak (super_admin)", "Tramos de porteros (super_admin)")}
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        {t(
          "Geldiketak eta golak: puntuak unitateko, tarteka metatuta (hutsik = lineala). Golak: atezain bakarra badago bakarrik; 2+ badaude, gol bakoitza irizpidearen puntuak. Ehunekoa: tarteko puntu finkoak, % = geldiketak / (geldiketak + kanpora + golak) × 100.",
          "Paradas y goles: puntos por unidad, acumulativos por tramos (vacío = lineal). Goles: solo si juega un único portero; con 2+ cada gol vale los puntos del criterio. Porcentaje: puntos fijos del tramo, % = paradas / (paradas + fuera + goles) × 100.",
        )}
      </p>
      {TRAMO_IDS.map((id) => {
        const a = actions.find((x) => x.id === id);
        if (!a) return null;
        const pctMode = id === PCT_ID;
        return (
          <div key={id} className="mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{td(a.nombre)}</h3>
              <span className="text-xs text-muted-foreground">
                {pctMode ? "%" : t("puntuak unitateko", "puntos por unidad")}
              </span>
            </div>
            <div className="mt-2 grid gap-2">
              {(draft[id] ?? []).map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span>{t("Nondik", "Desde")}</span>
                  <input type="number" step={pctMode ? "0.01" : "1"} value={r.desde} onChange={(e) => set(id, i, "desde", e.target.value)} className="w-20 rounded-md border border-input bg-background px-2 py-1" />
                  <span>{t("Nora", "Hasta")}</span>
                  <input type="number" step={pctMode ? "0.01" : "1"} value={r.hasta ?? ""} placeholder="∞" onChange={(e) => set(id, i, "hasta", e.target.value)} className="w-20 rounded-md border border-input bg-background px-2 py-1" />
                  <span>{t("Puntuak", "Puntos")}</span>
                  <input type="number" step="0.01" value={r.puntos} onChange={(e) => set(id, i, "puntos", e.target.value)} className="w-20 rounded-md border border-input bg-background px-2 py-1" />
                  <button type="button" aria-label={t("Ezabatu", "Eliminar")} onClick={() => setDraft((d) => ({ ...d, [id]: d[id].filter((_, j) => j !== i) }))} className="grid h-7 w-7 place-items-center rounded-md border border-destructive/40 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {(draft[id] ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {pctMode
                    ? t("Tarterik ez: ez du punturik ematen.", "Sin tramos: no suma puntos.")
                    : t(`Tarterik ez: lineala (${a.puntos} pt unitateko).`, `Sin tramos: lineal (${a.puntos} pts por unidad).`)}
                </p>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setDraft((d) => { const l = d[id] ?? []; const last = l[l.length - 1]; return { ...d, [id]: [...l, { desde: last ? (last.hasta ?? last.desde) + (pctMode ? 0.01 : 1) : pctMode ? 0 : 1, hasta: null, puntos: 0 }] }; })} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
                <Plus className="h-3.5 w-3.5" /> {t("Tartea", "Tramo")}
              </button>
              <button type="button" disabled={saving === id} onClick={() => guardar(id)} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                <Save className="h-3.5 w-3.5" /> {t("Gorde", "Guardar")}
              </button>
            </div>
          </div>
        );
      })}
    </details>
  );
}

function fullName(p: { nombre: string; alias: string | null; apellido1: string | null; apellido2: string | null }) {
  return [p.nombre, p.apellido1, p.apellido2].filter(Boolean).join(" ") || p.alias || "";
}

const ESTADO_DOT: Record<PlayerEstado, string> = {
  disponible: "bg-primary",
  dudoso: "bg-[color:var(--gold,#d4a017)]",
  no_disponible: "bg-destructive",
};

function EstadoTag({
  estado,
  label,
  active,
}: {
  estado: PlayerEstado;
  label: string;
  active: boolean;
}) {
  const activeCls = active ? "bg-white/15" : "bg-secondary";
  return (
    <span
      className={`ml-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide ${activeCls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ESTADO_DOT[estado]}`} />
      {label}
    </span>
  );
}
