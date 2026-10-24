import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";

export type JornadaSel = number | "total" | "media";

/** Jornadas del calendario real (tabla jornadas: una fila por jornada, sin límite de lectura). */
export function useCalendarJornadas() {
  return useQuery({
    queryKey: ["calendar-jornadas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jornadas").select("numero").order("numero");
      if (error) throw error;
      return (data ?? []).map((j) => j.numero);
    },
    staleTime: 60_000,
  });
}

/** Barra de selección de jornada (mismo estilo que Partidos) con "Total" primero. */
export function JornadaBar({
  jornadas,
  value,
  onChange,
  extra,
  showMedia,
}: {
  jornadas: number[];
  value: JornadaSel;
  onChange: (v: JornadaSel) => void;
  extra?: (j: JornadaSel) => ReactNode;
  showMedia?: boolean;
}) {
  const t = useT();
  const cls = (active: boolean) =>
    `shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card hover:bg-muted"
    }`;
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {showMedia && (
        <button type="button" className={cls(value === "media")} onClick={() => onChange("media")}>
          {t("Batez bestekoa", "Media")}
          {extra?.("media")}
        </button>
      )}
      <button type="button" className={cls(value === "total")} onClick={() => onChange("total")}>
        {t("Guztira", "Total")}
        {extra?.("total")}
      </button>
      {jornadas.map((j) => (
        <button key={j} type="button" className={cls(value === j)} onClick={() => onChange(j)}>
          J{j}
          {extra?.(j)}
        </button>
      ))}
    </div>
  );
}
