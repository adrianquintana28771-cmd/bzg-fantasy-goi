import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, Download, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/back-button";
import { AdminGuard } from "@/components/admin-guard";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";
import {
  CARD_BUCKET,
  FILE_OF,
  RAREZAS,
  TEMPLATE_PATH,
  useCardImages,
  type Rareza,
} from "@/lib/card-images";

export const Route = createFileRoute("/admin/fotos")({
  head: () => ({
    meta: [
      { title: "Gestión de fotografías · BZG Fantasy" },
      { name: "description", content: "Importa y gestiona las fotos de las fichas de jugadores/as." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <Fotos />
    </AdminGuard>
  ),
});

type Person = { id: string; nombre: string; apellido1: string | null; apellido2: string | null; alias: string | null; es_entrenador: boolean; activo: boolean; equipos: string };
type Entry = { folder: string; files: Partial<Record<Rareza, File>>; candidates: string[]; chosen: string | null };

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
const fullName = (p: Person) => [p.nombre, p.apellido1, p.apellido2].filter(Boolean).join(" ");
const RZ_FROM_FILE: Record<string, Rareza> = { comun: "normal", raro: "raro", legendario: "legendario" };
const TPL_FROM_FILE: Record<string, Rareza> = { ficha_comun: "normal", ficha_raro: "raro", ficha_legendario: "legendario" };

function Fotos() {
  const t = useT();
  const { canManageAll } = useAuth();
  const qc = useQueryClient();
  const ci = useCardImages();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [templates, setTemplates] = useState<Partial<Record<Rareza, File>>>({});
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string[] | null>(null);
  const [filter, setFilter] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const people = useQuery({
    queryKey: ["fotos-personas"],
    queryFn: async () => {
      const [pl, lk, tm] = await Promise.all([
        supabase.from("club_players").select("id,nombre,apellido1,apellido2,alias,es_entrenador,activo").order("nombre"),
        supabase.from("club_player_teams").select("player_id,team_id"),
        supabase.from("club_teams").select("id,nombre"),
      ]);
      for (const r of [pl, lk, tm]) if (r.error) throw r.error;
      const tn = new Map((tm.data ?? []).map((x) => [x.id, x.nombre]));
      return (pl.data ?? []).map((p) => ({
        ...p,
        equipos: (lk.data ?? []).filter((l) => l.player_id === p.id).map((l) => tn.get(l.team_id)).filter(Boolean).join(", "),
      })) as Person[];
    },
  });
  const byId = useMemo(() => new Map((people.data ?? []).map((p) => [p.id, p])), [people.data]);

  const match = (folder: string): string[] => {
    const f = norm(folder);
    const ps = people.data ?? [];
    const keys = (p: Person) =>
      [fullName(p), [p.nombre, p.apellido1].filter(Boolean).join(" "), p.alias ?? ""].filter(Boolean).map(norm);
    const exact = ps.filter((p) => keys(p).includes(f));
    if (exact.length) return exact.map((p) => p.id);
    const words = f.split(" ");
    return ps.filter((p) => words.every((w) => norm(fullName(p)).split(" ").includes(w))).map((p) => p.id);
  };

  const onPick = (list: FileList | null) => {
    if (!list) return;
    setReport(null);
    const map = new Map<string, Entry>();
    const tpl: Partial<Record<Rareza, File>> = {};
    for (const file of Array.from(list)) {
      const parts = (file.webkitRelativePath || file.name).split("/");
      const base = file.name.replace(/\.[^.]+$/, "").toLowerCase();
      const i = parts.findIndex((x) => x.toLowerCase() === "jugadores");
      if (parts.some((x) => x.toLowerCase() === "plantillas") && TPL_FROM_FILE[base]) {
        tpl[TPL_FROM_FILE[base]] = file;
      } else if (i >= 0 && parts.length === i + 3 && RZ_FROM_FILE[base]) {
        const folder = parts[i + 1];
        const e = map.get(folder) ?? { folder, files: {}, candidates: [], chosen: null };
        e.files[RZ_FROM_FILE[base]] = file;
        map.set(folder, e);
      }
    }
    const list2 = [...map.values()].map((e) => {
      const c = match(e.folder);
      return { ...e, candidates: c, chosen: c.length === 1 ? c[0] : null };
    });
    setTemplates(tpl);
    setEntries(list2.sort((a, b) => a.folder.localeCompare(b.folder)));
  };

  const existing = (pid: string | null, rz: Rareza) => (pid ? ci.data?.paths[pid]?.[rz] : undefined);
  const replacements = entries.flatMap((e) =>
    RAREZAS.filter((rz) => e.files[rz] && existing(e.chosen, rz)).map((rz) => `${fullName(byId.get(e.chosen!)!)} · ${FILE_OF[rz]}`),
  );
  const tplReplace = RAREZAS.filter((rz) => templates[rz] && ci.data?.templates[rz]);

  const upload = async (path: string, file: File) =>
    supabase.storage.from(CARD_BUCKET).upload(path, file, { upsert: true, contentType: file.type || undefined, cacheControl: "3600" });

  const runImport = async () => {
    const reps = [...replacements, ...tplReplace.map((rz) => `${t("Txantiloia", "Plantilla")} ${FILE_OF[rz]}`)];
    if (reps.length && !window.confirm(`${t("Ordezkatuko dira:", "Se reemplazarán:")}\n\n${reps.join("\n")}\n\n${t("Jarraitu?", "¿Continuar?")}`)) return;
    setBusy(true);
    const log: string[] = [];
    let ok = 0, skip = 0, repl = 0, err = 0, jug = 0, ent = 0;
    for (const rz of RAREZAS) {
      const f = templates[rz];
      if (!f) continue;
      const { error } = await upload(TEMPLATE_PATH[rz], f);
      if (error) { err++; log.push(`ERROR plantilla ${FILE_OF[rz]}: ${error.message}`); } else ok++;
    }
    for (const e of entries) {
      const p = e.chosen ? byId.get(e.chosen) : undefined;
      if (!p) { skip += Object.keys(e.files).length; log.push(`${e.candidates.length > 1 ? "AMBIGUA" : "SIN COINCIDENCIA"}: ${e.folder}`); continue; }
      if (p.es_entrenador) ent++; else jug++;
      for (const rz of RAREZAS) {
        const f = e.files[rz];
        if (!f) { log.push(`PENDIENTE: ${fullName(p)} (${p.id}) · ${FILE_OF[rz]}`); continue; }
        const path = `${p.id}/${FILE_OF[rz]}.${(f.name.split(".").pop() || "webp").toLowerCase()}`;
        const had = existing(p.id, rz);
        const { error } = await upload(path, f);
        if (error) { err++; log.push(`ERROR ${fullName(p)} · ${FILE_OF[rz]}: ${error.message}`); continue; }
        const { error: e2 } = await supabase.from("player_card_images").upsert({ player_id: p.id, rareza: rz, path }, { onConflict: "player_id,rareza" });
        if (e2) { err++; log.push(`ERROR ${fullName(p)} · ${FILE_OF[rz]}: ${e2.message}`); continue; }
        if (had) repl++; else ok++;
      }
    }
    setBusy(false);
    setReport([
      `${t("Aurkitutako pertsonak", "Personas encontradas")}: ${entries.filter((e) => e.chosen).length}`,
      `${t("Jokalariak", "Jugadores")}: ${jug} · ${t("Entrenatzaileak", "Entrenadores")}: ${ent}`,
      `${t("Inportatuak", "Importadas")}: ${ok} · ${t("Ordezkatuak", "Reemplazadas")}: ${repl} · ${t("Saltatuak", "Omitidas")}: ${skip} · ${t("Erroreak", "Errores")}: ${err}`,
      `${t("Koinzidentziarik gabe", "Sin coincidencia")}: ${entries.filter((e) => !e.chosen && e.candidates.length === 0).length} · ${t("Anbiguoak", "Ambiguas")}: ${entries.filter((e) => !e.chosen && e.candidates.length > 1).length}`,
      ...log,
    ]);
    qc.invalidateQueries({ queryKey: ["card-images"] });
  };

  const downloadPending = () => {
    const rows = [["ID", "Nombre completo", "Tipo", "Equipos", "Faltan"]];
    for (const p of people.data ?? []) {
      const miss = RAREZAS.filter((rz) => !ci.data?.paths[p.id]?.[rz]).map((rz) => FILE_OF[rz]);
      if (miss.length) rows.push([p.id, fullName(p), p.es_entrenador ? "ENTRENADOR" : "JUGADOR", p.equipos, miss.join(", ")]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
    a.download = "fotos_pendientes.csv";
    a.click();
  };

  const single = async (p: Person, rz: Rareza, file: File | null) => {
    const had = existing(p.id, rz);
    if (file) {
      if (had && !window.confirm(t(`${FILE_OF[rz]} argazkia ordezkatu?`, `¿Reemplazar la foto ${FILE_OF[rz]} de ${fullName(p)}?`))) return;
      const path = `${p.id}/${FILE_OF[rz]}.${(file.name.split(".").pop() || "webp").toLowerCase()}`;
      const { error } = await upload(path, file);
      if (error) return alert(error.message);
      const { error: e2 } = await supabase.from("player_card_images").upsert({ player_id: p.id, rareza: rz, path }, { onConflict: "player_id,rareza" });
      if (e2) return alert(e2.message);
    } else if (had) {
      if (!window.confirm(t("Argazkia ezabatu?", `¿Eliminar la foto ${FILE_OF[rz]} de ${fullName(p)}?`))) return;
      const { error } = await supabase.from("player_card_images").delete().eq("player_id", p.id).eq("rareza", rz);
      if (error) return alert(error.message);
      await supabase.storage.from(CARD_BUCKET).remove([had]);
    }
    qc.invalidateQueries({ queryKey: ["card-images"] });
  };

  const list = useMemo(() => {
    const f = norm(filter);
    return (people.data ?? []).filter(
      (p) =>
        (!f || norm(`${fullName(p)} ${p.alias ?? ""} ${p.equipos}`).includes(f)) &&
        (!onlyMissing || RAREZAS.some((rz) => !ci.data?.paths[p.id]?.[rz])),
    );
  }, [people.data, filter, onlyMissing, ci.data]);

  if (!canManageAll) return <div className="p-10 text-center text-sm text-muted-foreground">{t("super_admin bakarrik.", "Sólo super_admin.")}</div>;

  const Thumb = ({ src }: { src?: string }) =>
    src ? (
      <img src={src} alt="" loading="lazy" className="h-14 w-11 rounded object-cover" />
    ) : (
      <div className="grid h-14 w-11 place-items-center rounded bg-muted text-muted-foreground"><UserRound className="h-5 w-5" /></div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BackButton />
      <h1 className="mt-3 font-display text-4xl">{t("Argazkien kudeaketa", "Gestión de fotografías")}</h1>

      <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-card">
        <h2 className="font-display text-2xl">{t("Txantiloiak", "Plantillas")}</h2>
        <div className="mt-2 flex flex-wrap gap-4">
          {RAREZAS.map((rz) => (
            <div key={rz} className="text-center text-xs">
              {ci.data?.templates[rz] ? <img src={ci.data.templates[rz]} alt="" className="h-32 rounded object-contain" /> : <div className="grid h-32 w-24 place-items-center rounded bg-muted">—</div>}
              <div className="mt-1">ficha_{FILE_OF[rz]}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-card">
        <h2 className="font-display text-2xl">{t("Inportatu fotos_jugadores", "Importar fotos_jugadores")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("Aukeratu fotos_jugadores karpeta. Ez da ezer inportatuko berretsi arte.", "Selecciona la carpeta fotos_jugadores. No se importa nada hasta que confirmes.")}
        </p>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Upload className="h-4 w-4" /> {t("Karpeta aukeratu", "Seleccionar carpeta")}
          <input type="file" multiple className="hidden" {...({ webkitdirectory: "", directory: "" } as object)} onChange={(e) => onPick(e.target.files)} />
        </label>

        {(entries.length > 0 || Object.keys(templates).length > 0) && (
          <>
            {Object.keys(templates).length > 0 && (
              <p className="mt-3 text-sm">
                {t("Txantiloiak", "Plantillas")}: {RAREZAS.filter((rz) => templates[rz]).map((rz) => `ficha_${FILE_OF[rz]}${tplReplace.includes(rz) ? ` (${t("ordezkatuko da", "se reemplazará")})` : ""}`).join(", ")}
              </p>
            )}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="p-2">{t("Karpeta", "Carpeta")}</th><th className="p-2">{t("Pertsona", "Persona")}</th>{RAREZAS.map((rz) => <th key={rz} className="p-2">{FILE_OF[rz]}</th>)}</tr>
                </thead>
                <tbody>
                  {entries.map((e, idx) => {
                    const p = e.chosen ? byId.get(e.chosen) : undefined;
                    const opts = e.candidates.length ? e.candidates : (people.data ?? []).map((x) => x.id);
                    return (
                      <tr key={e.folder} className="border-t border-border align-top">
                        <td className="p-2" translate="no">{e.folder}</td>
                        <td className="p-2">
                          <div className={`text-xs font-semibold ${p ? "text-primary" : "text-destructive"}`}>
                            {p ? t("Berretsita", "Coincidencia confirmada") : e.candidates.length > 1 ? t("Anbiguoa", "Coincidencia ambigua") : t("Ez da aurkitu", "Persona no encontrada")}
                          </div>
                          <select
                            className="mt-1 w-56 rounded border border-border bg-background px-2 py-1 text-xs"
                            value={e.chosen ?? ""}
                            onChange={(ev) => setEntries(entries.map((x, i) => (i === idx ? { ...x, chosen: ev.target.value || null } : x)))}
                          >
                            <option value="">{t("— aukeratu —", "— elegir —")}</option>
                            {opts.map((id) => { const q = byId.get(id)!; return <option key={id} value={id}>{fullName(q)} · {q.equipos || "—"} · {q.es_entrenador ? "ENT" : "JUG"}</option>; })}
                          </select>
                        </td>
                        {RAREZAS.map((rz) => (
                          <td key={rz} className="p-2 text-xs">
                            {!e.files[rz] ? <span className="text-muted-foreground">{t("Zain", "Pendiente")}</span>
                              : existing(e.chosen, rz) ? <span className="text-warning-foreground">{t("Ordezkatuko da", "Se reemplazará")}</span>
                              : <span className="text-primary">{t("Prest", "Lista")}</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button type="button" disabled={busy} onClick={runImport} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {busy ? t("Inportatzen…", "Importando…") : t("Berretsi inportazioa", "Confirmar importación")}
            </button>
          </>
        )}
        {report && <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">{report.join("\n")}</pre>}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl">{t("Pertsonak", "Personas")}</h2>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("Bilatu…", "Buscar…")} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />{t("Argazkirik gabe", "Sin fotos")}</label>
          <button type="button" onClick={downloadPending} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm"><Download className="h-4 w-4" />{t("Zain daudenak", "Pendientes (CSV)")}</button>
        </div>
        <div className="mt-3 divide-y divide-border">
          {list.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 py-2">
              <div className="min-w-48 flex-1">
                <div translate="no" className="font-semibold">{fullName(p)}</div>
                <div className="text-xs text-muted-foreground">{p.equipos || "—"} · {p.es_entrenador ? t("Entrenatzailea", "Entrenador/a") : t("Jokalaria", "Jugador/a")}</div>
              </div>
              {RAREZAS.map((rz) => (
                <div key={rz} className="flex items-center gap-1">
                  <Thumb src={ci.data?.photos[p.id]?.[rz]} />
                  <div className="flex flex-col gap-1 text-[10px]">
                    <span>{FILE_OF[rz]}</span>
                    <label className="cursor-pointer text-primary">
                      <Upload className="h-3.5 w-3.5" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { single(p, rz, e.target.files?.[0] ?? null); e.target.value = ""; }} />
                    </label>
                    {ci.data?.paths[p.id]?.[rz] && <button type="button" onClick={() => single(p, rz, null)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
