import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "eu" | "es";
const KEY = "bzg_lang";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (eu: string, es: string) => string };
const LangContext = createContext<Ctx>({ lang: "eu", setLang: () => {}, t: (eu) => eu });

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
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
export const useT = () => useContext(LangContext).t;

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
