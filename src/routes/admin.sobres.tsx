import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/back-button";
import { AdminGuard } from "@/components/admin-guard";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/admin/sobres")({
  head: () => ({
    meta: [
      { title: "Probabilidades de sobres · BZG Fantasy" },
      { name: "description", content: "Configura la probabilidad de cada rareza en los sobres." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <Page />
    </AdminGuard>
  ),
});

type Key = "normal" | "raro" | "legendario";
const rpc = supabase.rpc as unknown as (
  f: string,
  a?: Record<string, unknown>,
) => Promise<{ data: any; error: { message: string } | null }>;

function Page() {
  const t = useT();
  const { canManageAll } = useAuth();
  const [vals, setVals] = useState<Record<Key, string>>({ normal: "", raro: "", legendario: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin-sobre-config"],
    enabled: canManageAll,
    queryFn: async () => {
      const { data, error } = await rpc("admin_get_sobre_config");
      if (error) throw error;
      return data?.[0] as { pct_normal: number; pct_raro: number; pct_legendario: number } | undefined;
    },
  });
  useEffect(() => {
    if (data)
      setVals({
        normal: String(data.pct_normal),
        raro: String(data.pct_raro),
        legendario: String(data.pct_legendario),
      });
  }, [data]);

  if (!canManageAll)
    return <div className="p-10 text-center text-muted-foreground">{t("super_admin bakarrik.", "Sólo super_admin.")}</div>;

  const nums = (Object.keys(vals) as Key[]).map((k) => Number(vals[k].replace(",", ".")));
  const valid = nums.every((n) => vals.normal !== "" && Number.isFinite(n) && n >= 0);
  const sum = Math.round(nums.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) * 1000) / 1000;
  const ok = valid && Math.abs(sum - 100) < 0.001;

  const save = async () => {
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    const { error } = await rpc("admin_save_sobre_config", { _normal: nums[0], _raro: nums[1], _legendario: nums[2] });
    setBusy(false);
    setMsg(error ? error.message : t("Gordeta.", "Guardado."));
  };

  const labels: Record<Key, string> = {
    normal: t("Arrunta", "Común"),
    raro: t("Bitxia", "Raro"),
    legendario: t("Legendarioa", "Legendario"),
  };

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <BackButton />
      <h1 className="font-display text-3xl">{t("Gutunazalen probabilitateak", "Probabilidades de sobres")}</h1>
      <p className="text-sm text-muted-foreground">
        {t(
          "Gutunazal berriei aplikatzen zaie. Erraritate bakoitzaren barruan, puntu-batez besteko altuagoa duten jokalariek %10 arte probabilitate txikiagoa dute.",
          "Se aplica a los sobres nuevos. Dentro de cada rareza, quien tenga mayor media de puntos tiene hasta un 10 % menos de probabilidad.",
        )}
      </p>
      {(Object.keys(vals) as Key[]).map((k) => (
        <label key={k} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
          <span className="font-semibold">{labels[k]}</span>
          <span className="flex items-center gap-1">
            <input
              inputMode="decimal"
              value={vals[k]}
              onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))}
              className="w-24 rounded-md border border-input bg-background px-2 py-1 text-right"
            />
            %
          </span>
        </label>
      ))}
      <p className={ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
        {t("Guztira", "Total")}: {String(sum).replace(".", ",")} %{" "}
        {!ok && t("(zenbaki ez-negatiboak, 100 % batu behar dute)", "(números no negativos que sumen 100 %)")}
      </p>
      <button
        onClick={save}
        disabled={!ok || busy}
        className="w-full rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
      >
        {t("Gorde", "Guardar")}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
