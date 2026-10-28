import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useDisplayPoints } from "@/hooks/use-display-points";
import { useT } from "@/lib/i18n";
import { POS_SHORT, POS_SHORT_EU } from "@/components/equipo-card";
import type { JornadaSel } from "@/components/jornada-bar";

export function RankingLineupDialog({ user, jornada, onClose }: {
  user: { userId: string; nombre: string } | null;
  jornada: JornadaSel;
  onClose: () => void;
}) {
  const t = useT();
  const displayPts = useDisplayPoints();
  const number = typeof jornada === "number" ? jornada : null;
  const query = useQuery({
    queryKey: ["ranking-user-lineup", user?.userId, number],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc("ranking_user_lineup", {
        _user_id: user.userId,
        ...(number === null ? {} : { _jornada: number }),
      });
      if (error) throw error;
      return data ?? [];
    },
  });
  const jornadas = [...new Set((query.data ?? []).map((row) => row.jornada))].sort((a, b) => b - a);
  return (
    <Dialog open={!!user} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("Lerrokadura", "Alineación")} · <span translate="no">{user?.nombre}</span>
            {number !== null && ` · J${number}`}
          </DialogTitle>
        </DialogHeader>
        {query.isPending && <p className="text-sm text-muted-foreground">{t("Kargatzen…", "Cargando…")}</p>}
        {query.isError && <p role="alert" className="text-sm text-destructive">{t("Ezin izan da lerrokadura kargatu.", "No se pudo cargar la alineación.")}</p>}
        {query.isSuccess && jornadas.length === 0 && <p className="text-sm text-muted-foreground">{t("Ez dago lerrokadurarik jardunaldi honetan.", "No hay alineación en esta jornada.")}</p>}
        {jornadas.map((j) => {
          const rows = (query.data ?? []).filter((row) => row.jornada === j);
          const total = rows.reduce((sum, row) => sum + Number(row.puntos), 0);
          return (
            <section key={j}>
              <div className="mb-2 flex items-center justify-between border-b border-border pb-2">
                <h3 className="font-semibold">J{j}</h3>
                <span className="font-display text-xl text-primary">{displayPts(total)} pts</span>
              </div>
              <ul className="divide-y divide-border">
                {rows.map((row) => (
                  <li key={row.posicion} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-8 shrink-0 font-bold text-muted-foreground">{t(POS_SHORT_EU[row.posicion], POS_SHORT[row.posicion])}</span>
                    {row.player_id ? (
                      <Link to="/jugadores/$playerId" params={{ playerId: row.player_id }} className="min-w-0 flex-1 break-words font-semibold hover:underline" translate="no" onClick={onClose}>
                        {row.nombre ?? row.player_id}
                      </Link>
                    ) : <span className="flex-1 text-muted-foreground">—</span>}
                    {row.player_id && <span className="shrink-0 tabular-nums">{displayPts(Number(row.puntos))} pts</span>}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </DialogContent>
    </Dialog>
  );
}