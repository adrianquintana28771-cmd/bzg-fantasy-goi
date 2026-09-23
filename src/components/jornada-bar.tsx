import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";

export type JornadaSel = number | "total";

/** Jornadas del calendario real (club_matches). */
export function useCalendarJornadas() {
  return useQuery({
    queryKey: ["calendar-jornadas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("club_matches").select("jornada");
      if (error) throw error;
      return [...new Set((data ?? []).map((m) => m.jornada))].sort((a, b) => a - b);
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
}: {
  jornadas: number[];
  value: JornadaSel;
  onChange: (v: JornadaSel) => void;
  extra?: (j: JornadaSel) => ReactNode;
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
