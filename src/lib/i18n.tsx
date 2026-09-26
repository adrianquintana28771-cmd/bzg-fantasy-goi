import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "eu" | "es";
const KEY = "bzg_lang";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (eu: string, es: string) => string;
  /** Traduce textos que vienen de la base de datos (acciones, grupos, posiciones). */
  td: (es: string) => string;
};

/** Textos guardados en castellano en la base de datos → euskera. */
const DB_EU: Record<string, string> = {
  Gol: "Gola",
  "Gol de fly": "Fly gola",
  "Gol de rosca": "Rosca gola",
  "Gol de vaselina": "Baselina gola",
  "Gol de 7 metros": "7 metroko gola",
  "Gol de contraataque": "Kontraerasoko gola",
  "Asistencia de gol": "Gol-pasea",
  "Asistencia de fly": "Fly pasea",
  "Asistencia de rosca": "Rosca pasea",
  "Asistencia de vaselina": "Baselina pasea",
  "Asistencia de portero/a": "Atezainaren gol-pasea",
  "7 metros provocado": "Eragindako 7 metrokoa",
  "Exclusión provocada": "Eragindako kanporaketa",
  "Robo de balón": "Baloi-lapurreta",
  "Corte de balón": "Baloi-mozketa",
  "Blocaje defensivo": "Defentsako blokeoa",
  Parada: "Geldiketa",
  "Parada de 7 metros": "7 metroko geldiketa",
  "Gol encajado": "Jasotako gola",
  "Lanzamiento fallado": "Huts egindako jaurtiketa",
  "Pase fallado": "Huts egindako pasea",
  "Pérdida de balón": "Baloi-galera",
  "7 metros fallado": "Huts egindako 7 metrokoa",
  "Pasos / dobles": "Urratsak / dobleak",
  "Falta en ataque": "Erasoko falta",
  "Exclusión de 2 minutos": "2 minutuko kanporaketa",
  "Tarjeta roja": "Txartel gorria",
  "MVP del partido": "Partidako MVPa",
  "Partido jugado": "Jokatutako partida",
  "Victoria del equipo": "Taldearen garaipena",
  "Entrenador/a: victoria": "Entrenatzailea: garaipena",
  "Entrenador/a: empate": "Entrenatzailea: berdinketa",
  "Entrenador/a: derrota": "Entrenatzailea: porrota",
  ataque: "erasoa",
  defensa: "defentsa",
  portero: "atezaina",
  "portería": "atea",
  entrenador: "entrenatzailea",
  negativo: "negatiboa",
  bonus: "bonusa",
  resultado: "emaitza",
  "Gol de penalti / 7 metros": "Penalti / 7 metroko gola",
  Asistencia: "Gol-pasea",
  "Dobles / pasos": "Dobleak / urratsak",
  "Robo de bote": "Botean lapurtzea",
  "Falta en ataque provocada": "Eragindako erasoko falta",
  "Tarjeta amarilla": "Txartel horia",
  Victoria: "Garaipena",
  Empate: "Berdinketa",
  Derrota: "Porrota",
  "Lanzamiento fuera": "Kanpora jaurtiketa",
  "Gol en contra": "Aurkako gola",
  "Portero/a": "Atezaina",
  "Extremo izquierdo": "Ezkerreko hegala",
  "Extremo derecho": "Eskuineko hegala",
  "Lateral izquierdo": "Ezkerreko alboa",
  "Lateral derecho": "Eskuineko alboa",
  Central: "Erdikoa",
  Pivote: "Pibota",
  "Especialista defensivo": "Defentsa-espezialista",
};

const LangContext = createContext<Ctx>({
  lang: "eu",
  setLang: () => {},
  t: (eu) => eu,
  td: (es) => dbEu(es),
});

function dbEu(es: string) {
  const m = /^Jornada (\d+)$/.exec(es);
  if (m) return `${m[1]}. jardunaldia`;
  return DB_EU[es] ?? es;
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("eu");
  useEffect(() => {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "es" || saved === "eu") setLangState(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem(KEY, l);
  }, []);
  const t = useCallback((eu: string, es: string) => (lang === "eu" ? eu : es), [lang]);
  const td = useCallback((es: string) => (lang === "eu" ? dbEu(es) : es), [lang]);
  return <LangContext.Provider value={{ lang, setLang, t, td }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
export const useT = () => useContext(LangContext).t;
export const useTd = () => useContext(LangContext).td;

export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div
      className={`inline-flex rounded-lg border border-border bg-secondary/60 p-0.5 text-xs font-bold ${className}`}
    >
      {(["eu", "es"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-md px-2.5 py-1.5 transition ${lang === l ? "bg-primary text-primary-foreground shadow-card" : "text-muted-foreground"}`}
        >
          {l === "eu" ? "EUS" : "ESP"}
        </button>
      ))}
    </div>
  );
}
