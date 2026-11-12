import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/back-button";
import { AdminGuard } from "@/components/admin-guard";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";
import { fetchAllRows } from "@/lib/club-data";

export const Route = createFileRoute("/admin/inicio")({
  head: () => ({
    meta: [
      { title: "Visibilidad de inicio · BZG Fantasy" },
      { name: "description", content: "Elige qué usuarios ven los destacados de Inicio." },
      { property: "og:title", content: "Visibilidad de inicio · BZG Fantasy" },
      { property: "og:description", content: "Gestión de visibilidad de destacados de Inicio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <Page />
    </AdminGuard>
  ),
});

type Key = "show_player_of_week" | "show_top_team" | "show_ideal_seven";
type Vis = Record<Key, boolean>;
const EMPTY: Vis = { show_player_of_week: false, show_top_team: false, show_ideal_seven: false };

function Page() {
  const t = useT();
  const qc = useQueryClient();
  const { isSuperAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const { data: users = [] } = useQuery({
    queryKey: ["admin-inicio-users"],
    enabled: isSuperAdmin,
    queryFn: () =>
      fetchAllRows((from, to) =>
        supabase.from("profiles").select("id, username, nombre, apellido").order("username").range(from, to),
      ),
  });
  const { data: visRows = [] } = useQuery({
    queryKey: ["admin-inicio-vis"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("home_featured_visibility").select("*");
      if (error) throw error;
      return data;
    },
  });
  const visMap = useMemo(() => new Map(visRows.map((r) => [r.user_id, r as Vis & { user_id: string }])), [visRows]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users.filter((u) => !s || [u.username, u.nombre, u.apellido].some((v) => v?.toLowerCase().includes(s)));
  }, [users, q]);

  if (!isSuperAdmin)
    return <div className="p-10 text-center text-muted-foreground">{t("super_admin bakarrik.", "Sólo super_admin.")}</div>;

  const toggle = async (userId: string, key: Key) => {
    const cur = visMap.get(userId) ?? EMPTY;
    const flags: Vis = { show_player_of_week: cur.show_player_of_week, show_top_team: cur.show_top_team, show_ideal_seven: cur.show_ideal_seven };
    flags[key] = !cur[key];
    const next = { user_id: userId, ...flags };
    setBusy(userId + key);
    setMsg(null);
    const { error } = await supabase.from("home_featured_visibility").upsert(next);
    setBusy(null);
    if (error) setMsg(error.message);
    qc.invalidateQueries({ queryKey: ["admin-inicio-vis"] });
    qc.invalidateQueries({ queryKey: ["home-visibility"] });
  };

  const cols: [Key, string][] = [
    ["show_player_of_week", t("Jardunaldiko jokalaria", "Jugador/a de la jornada")],
    ["show_top_team", t("Talde nabarmendua", "Equipo destacado")],
    ["show_ideal_seven", t("8 ideala", "8 ideal")],
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BackButton />
      <h1 className="mt-4 font-display text-3xl">{t("Hasierako ikusgarritasuna", "Visibilidad de inicio")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(
          "Lehenetsita ezkutuan daude guztientzat (super_admin izan ezik). Aktibatu erabiltzaile bakoitzarentzat.",
          "Por defecto están ocultos para todos (salvo super_admin). Actívalos para cada usuario.",
        )}
      </p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("Bilatu erabiltzailea...", "Buscar usuario...")}
        className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      {msg && <p className="mt-2 text-sm text-destructive">{msg}</p>}
      <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
        {filtered.map((u) => {
          const v = visMap.get(u.id) ?? EMPTY;
          return (
            <div key={u.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <span className="font-semibold" translate="no">{u.username ?? "—"}</span>
                <span className="ml-2 text-muted-foreground" translate="no">
                  {[u.nombre, u.apellido].filter(Boolean).join(" ")}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cols.map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    disabled={busy === u.id + k}
                    onClick={() => toggle(u.id, k)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                      v[k] ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-muted-foreground"
                    }`}
                  >
                    {v[k] ? "✓ " : ""}{label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
