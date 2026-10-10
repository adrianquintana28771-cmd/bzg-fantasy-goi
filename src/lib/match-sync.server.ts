// Sincronización de partidos desde el calendario público de la FVBM (solo servidor).
// Idempotente: actualiza la fila existente de club_matches (equipo + jornada + competición).
import type { SupabaseClient } from "@supabase/supabase-js";

type Parsed = {
  jornada: number;
  local: string;
  visitante: string;
  fecha: string | null; // yyyy-mm-dd del partido (si la fuente la da)
  fechaJornada: string | null;
  hora: string | null;
  gl: number | null;
  gv: number | null;
};

const norm = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const up = (s: string) => norm(s).toUpperCase();
const isoDate = (d: string) => {
  const m = d.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

export function parseCalendario(html: string): Parsed[] {
  const out: Parsed[] = [];
  const tables = html.split(/<table class='calendario-completo'>/i).slice(1);
  tables.forEach((tb, idx) => {
    const head = norm(tb.match(/<th colspan='2'>([^<]*)<\/th>/i)?.[1] ?? "");
    const jornada = Number(head.match(/Jornada\s+(\d+)/i)?.[1] ?? idx + 1);
    const fechaJornada = isoDate(head);
    const rowRe = /<tr[^>]*>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<\/tr>/gi;
    for (const r of tb.matchAll(rowRe)) {
      const cell = r[3];
      const res = cell.match(/class='resultado'>\s*(\d+)\s*-\s*(\d+)/i);
      const fecha = isoDate(cell);
      const hora = cell.match(/(\d{1,2}:\d{2})/)?.[1] ?? null;
      out.push({
        jornada,
        local: norm(r[1]),
        visitante: norm(r[2]),
        fecha,
        fechaJornada,
        hora: res ? null : hora,
        gl: res ? Number(res[1]) : null,
        gv: res ? Number(res[2]) : null,
      });
    }
  });
  return out;
}

async function fetchText(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 BZGFantasy" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  const buf = await res.arrayBuffer();
  const utf = new TextDecoder("utf-8").decode(buf);
  if (!utf.includes("\uFFFD")) return utf;
  try {
    return new TextDecoder("windows-1252").decode(buf);
  } catch {
    return utf;
  }
}

type Source = { id: string; nombre: string; url: string; team_id: string | null; equipo_fed: string | null };

export async function syncSource(admin: SupabaseClient, src: Source) {
  const torneo = new URL(src.url).searchParams.get("id");
  if (!torneo || !src.team_id) throw new Error("Falta id de torneo o equipo");
  const base = "https://www.fvbm.eus/JSON";
  const [cal, datos, team] = await Promise.all([
    fetchText(`${base}/get_calendario.asp?id=${torneo}`),
    fetchText(`${base}/get_datos_torneo.asp?id=${torneo}`).catch(() => ""),
    admin.from("club_teams").select("season_id").eq("id", src.team_id).single(),
  ]);
  if (team.error) throw team.error;
  const competicion = norm(datos).slice(0, 200) || src.nombre;
  const nuestro = (n: string) =>
    src.equipo_fed ? up(n) === up(src.equipo_fed) : /\b(BZG|BERDEZURIGORRI)\b/i.test(n);

  const { data: existing, error } = await admin
    .from("club_matches")
    .select("id,jornada,rival,fecha,hora,es_local,goles_favor,goles_contra,competicion")
    .eq("team_id", src.team_id);
  if (error) throw error;

  let creados = 0;
  let actualizados = 0;
  for (const p of parseCalendario(cal)) {
    const local = nuestro(p.local);
    if (!local && !nuestro(p.visitante)) continue;
    const rival = local ? p.visitante : p.local;
    const row = (existing ?? []).find(
      (m) => m.jornada === p.jornada && (m.competicion == null || m.competicion === competicion),
    );
    const patch: Record<string, unknown> = {};
    const fecha = p.fecha ?? row?.fecha ?? p.fechaJornada;
    if (!row) {
      if (!fecha) continue;
      const { error: e } = await admin.from("club_matches").insert({
        season_id: team.data.season_id,
        team_id: src.team_id,
        jornada: p.jornada,
        rival,
        es_local: local,
        fecha,
        hora: p.hora,
        goles_favor: p.gl == null ? 0 : local ? p.gl : p.gv!,
        goles_contra: p.gl == null ? 0 : local ? p.gv! : p.gl,
        competicion,
        fuente_id: src.id,
      } as never);
      if (e) throw e;
      creados++;
      continue;
    }
    if (row.competicion == null) patch.competicion = competicion;
    if (row.rival !== rival) patch.rival = rival;
    if (row.es_local !== local) patch.es_local = local;
    if (p.fecha && row.fecha !== p.fecha) patch.fecha = p.fecha;
    if (p.hora && row.hora !== p.hora) patch.hora = p.hora;
    if (p.gl != null) {
      const gf = local ? p.gl : p.gv!;
      const gc = local ? p.gv! : p.gl;
      if (row.goles_favor !== gf) patch.goles_favor = gf;
      if (row.goles_contra !== gc) patch.goles_contra = gc;
    }
    if (Object.keys(patch).length) {
      patch.fuente_id = src.id;
      const { error: e } = await admin.from("club_matches").update(patch as never).eq("id", row.id);
      if (e) throw e;
      actualizados++;
    }
  }
  return { creados, actualizados };
}

export async function syncAll(admin: SupabaseClient) {
  const { data: sources, error } = await admin
    .from("match_sources")
    .select("id,nombre,url,team_id,equipo_fed")
    .eq("activo", true);
  if (error) throw error;
  const resumen: { fuente: string; ok: boolean; detalle: string }[] = [];
  for (const s of sources ?? []) {
    let detalle: string;
    let ok = true;
    try {
      const r = await syncSource(admin, s);
      detalle = `${r.actualizados} actualizados, ${r.creados} nuevos`;
    } catch (e) {
      ok = false;
      detalle = `Error: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300);
    }
    await admin
      .from("match_sources")
      .update({ ultima_sync: new Date().toISOString(), ultimo_resultado: detalle } as never)
      .eq("id", s.id);
    resumen.push({ fuente: s.nombre, ok, detalle });
  }
  return resumen;
}
