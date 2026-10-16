import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/back-button";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/admin/codigos")({
  head: () => ({
    meta: [
      { title: "Códigos de misión · BZG Fantasy" },
      { name: "description", content: "Crear códigos de misión temporales." },
      { property: "og:title", content: "Códigos de misión · BZG Fantasy" },
      { property: "og:description", content: "Códigos de partidos con activación programada y validez de cuatro horas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard allowMisiones>
      <Page />
    </AdminGuard>
  ),
});

function Page() {
  const t = useT();
  const { canManageAll: isSA, isAdminMisiones } = useAuth();
  const canManageAll = isSA || isAdminMisiones;
  const [codigo, setCodigo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [programar, setProgramar] = useState(false);
  const [matchId, setMatchId] = useState("");
  const [inicio, setInicio] = useState("");

  const { data: matches = [], isError: matchesError } = useQuery({
    queryKey: ["mission-code-matches"],
    enabled: isSA,
    queryFn: async () => {
      const rows = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("club_matches")
          .select("id, jornada, rival, fecha, hora, competicion, club_teams(nombre, categoria, sexo)")
          .order("fecha", { ascending: false }).order("id").range(offset, offset + 999);
        if (error) throw error;
        rows.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) break;
      }
      return rows.filter((m) => m.rival.trim().toLowerCase() !== "descansa");
    },
  });

  const { data: codes = [], refetch } = useQuery({
    queryKey: ["admin-scheduled-mission-codes"],
    enabled: canManageAll,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_scheduled_mission_codes");
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60000,
  });

  if (!canManageAll) {
    return <div className="p-10 text-center text-muted-foreground">{t("super_admin bakarrik.", "Sólo super_admin.")}</div>;
  }

  const create = async () => {
    const c = codigo.trim();
    if (!c || (programar && (!isSA || !matchId || !inicio))) return;
    setBusy(true);
    setMsg(null);
    const { error } = programar
      ? await supabase.rpc("admin_schedule_mission_code", { _codigo: c, _match_id: matchId, _inicio_local: inicio })
      : await supabase.rpc("admin_create_mission_code", { _codigo: c });
    setBusy(false);
    if (error) {
      setMsg(
        error.message.includes("ya está activo")
          ? t("Kode hori aktibo edo programatuta dago jada.", "Ese código ya está activo o programado.")
          : error.message.includes("hora debe ser futura")
            ? t("Aukeratu etorkizuneko data eta ordua.", "Elige una fecha y hora futuras.")
          : error.message.includes("partido ya tiene")
            ? t("Partida horrek kode aktibo edo programatu bat du jada.", "Ese partido ya tiene un código activo o programado.")
          : error.message.includes("no válido")
            ? t("Kodea: 3-40 karaktere, letrak, zenbakiak, - edo _.", "Código: 3-40 caracteres, letras, números, - o _.")
            : error.message,
      );
      return;
    }
    setCodigo("");
    setMsg(programar
      ? t("Kodea programatuta. Aukeratutako ordutik 4 orduz aktibo.", "Código programado. Activo durante 4 horas desde la hora elegida.")
      : t("Kodea sortuta (4 orduz aktibo).", "Código creado (activo 4 horas)."));
    refetch();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <BackButton />
      <h1 className="mt-4 font-display text-3xl">{t("Misio-kodeak", "Códigos de misión")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(
          "Kode bakoitzak 4 orduko balioa du aktibatzen denetik.",
          "Cada código es válido durante 4 horas desde su activación.",
        )}
      </p>
      {isSA && (
        <div className="mt-5 space-y-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={programar} onChange={(e) => { setProgramar(e.target.checked); setMsg(null); }} className="h-4 w-4 accent-primary" />
            {t("Partida baterako programatu", "Programar para un partido")}
          </label>
          {programar && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="min-w-0 space-y-1 text-sm">
                <span>{t("Partida", "Partido")}</span>
                <select value={matchId} onChange={(e) => {
                  setMatchId(e.target.value);
                  const match = matches.find((m) => m.id === e.target.value);
                  if (match) {
                    setCodigo(`BZG-${match.id.slice(0, 8)}`.toUpperCase());
                    setInicio(match.hora && /^\d{2}:\d{2}/.test(match.hora) ? `${match.fecha}T${match.hora.slice(0, 5)}` : "");
                  }
                }} className="w-full rounded-lg border border-border bg-background px-3 py-2">
                  <option value="">{t("Aukeratu partida", "Selecciona un partido")}</option>
                  {matches.map((m) => <option key={m.id} value={m.id} translate="no">{m.fecha} · J{m.jornada} · {m.club_teams?.nombre ?? "BZG"} ({m.club_teams?.categoria} · {m.club_teams?.sexo}) vs {m.rival}{m.competicion ? ` · ${m.competicion}` : ""}</option>)}
                </select>
                {matchesError && <span className="text-destructive">{t("Ezin izan dira partidak kargatu.", "No se pudieron cargar los partidos.")}</span>}
              </label>
              <label className="min-w-0 space-y-1 text-sm">
                <span>{t("Aktibazio data eta ordua (Madril)", "Fecha y hora de activación (Madrid)")}</span>
                <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2" />
              </label>
            </div>
          )}
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          maxLength={40}
          placeholder="BZG-..."
          aria-label={t("Misio-kodea", "Código de misión")}
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <Button
          type="button"
          disabled={busy || !codigo.trim() || (programar && (!matchId || !inicio))}
          onClick={create}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {programar ? t("Programatu", "Programar") : t("Sortu", "Crear")}
        </Button>
      </div>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
      <h2 className="mt-8 font-display text-xl">{t("Kode aktiboak eta programatuak", "Códigos activos y programados")}</h2>
      {codes.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("Ez dago kode aktibo edo programaturik.", "No hay códigos activos ni programados.")}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
          {codes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <div className="min-w-0">
                <span translate="no" className="break-all font-mono font-semibold">{c.codigo_qr}</span>
                {c.match_id && <p translate="no" className="mt-1 text-xs text-muted-foreground">{(() => {
                  const match = matches.find((m) => m.id === c.match_id);
                  return match ? `${match.club_teams?.nombre ?? "BZG"} vs ${match.rival} · J${match.jornada}` : "";
                })()}</p>}
              </div>
              <span className="text-xs text-muted-foreground">
                <span className="block font-semibold">{c.activa_desde && new Date(c.activa_desde).getTime() > Date.now() ? t("Programatuta", "Programado") : t("Aktibo", "Activo")}</span>
                {c.activa_desde && <span className="block">{t("Aktibazioa", "Activación")}: {new Date(c.activa_desde).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}</span>}
                {t("Iraungitzea", "Caduca")}: {new Date(c.caduca_at as string).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
