import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, CircleHelp, Sparkles, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";

const TOUR_EVENT = "bzg:open-tour";
const TOUR_VERSION = "v1";

type TourStep = {
  target?: string;
  icon: typeof CircleHelp;
  title: [string, string];
  description: [string, string];
};

export function openGuidedTour() {
  window.dispatchEvent(new Event(TOUR_EVENT));
}

export function GuidedTour() {
  const { user, loading, isStaff, isSuperAdmin, isManager } = useAuth();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const audience = !user ? "visitor" : isStaff ? "staff" : "player";
  const storageKey = `bzg_tour_${TOUR_VERSION}_${audience}`;

  const steps = useMemo<TourStep[]>(() => {
    if (isStaff) {
      return [
        {
          icon: Sparkles,
          title: ["Ongi etorri BZG Fantasy-ra", "Te damos la bienvenida a BZG Fantasy"],
          description: [
            "Ibilbide labur honetan zure administrazio-tresna nagusiak ikusiko dituzu.",
            "En este recorrido breve verás tus principales herramientas de administración.",
          ],
        },
        {
          target: "nav-performance",
          icon: BarChart3,
          title: ["Jokalarien errendimendua", "Desempeño de jugadores"],
          description: [
            "Sartu partidako ekintzak hemen: golak, geldiketak, galerak eta gainerako estatistikak. Puntuak automatikoki kalkulatuko dira.",
            "Introduce aquí las acciones del partido: goles, paradas, pérdidas y demás estadísticas. Los puntos se calcularán automáticamente.",
          ],
        },
        ...(isSuperAdmin || isManager
          ? [
              {
                target: "nav-admin",
                icon: Users,
                title: ["Administrazio-panela", "Panel de administración"],
                description: [
                  isSuperAdmin
                    ? "Hemendik arauak, erabiltzaileak eta klubaren gainerako aukerak kudea ditzakezu."
                    : "Hemendik baimendutako taldeko eta partidako aukerak kudea ditzakezu.",
                  isSuperAdmin
                    ? "Desde aquí puedes gestionar reglas, usuarios y el resto de opciones del club."
                    : "Desde aquí puedes gestionar las opciones de equipos y partidos que tienes permitidas.",
                ],
              } satisfies TourStep,
            ]
          : []),
        {
          target: "nav-rankings",
          icon: Trophy,
          title: ["Egiaztatu sailkapenak", "Comprueba las clasificaciones"],
          description: [
            "Ikusi jokalarien eta erabiltzaileen puntuak guztira edo jardunaldika.",
            "Consulta los puntos de jugadores y usuarios, en total o por jornada.",
          ],
        },
      ];
    }

    if (user) {
      return [
        {
          icon: Sparkles,
          title: ["Ongi etorri BZG Fantasy-ra!", "¡Te damos la bienvenida a BZG Fantasy!"],
          description: [
            "Gutunazalak ireki, zure taldea osatu eta jardunaldi bakoitzean puntuak lortu.",
            "Abre sobres, forma tu equipo y consigue puntos en cada jornada.",
          ],
        },
        {
          target: "nav-missions",
          icon: Sparkles,
          title: ["Lortu gutunazalak", "Consigue sobres"],
          description: [
            "Bete misioak gutunazalak irabazteko. Partidetan pabiloiko QR kodea eskaneatuta premium gutunazalak lor ditzakezu.",
            "Completa misiones para ganar sobres. En los partidos puedes escanear el QR del pabellón para conseguir sobres premium.",
          ],
        },
        {
          target: "nav-team",
          icon: Users,
          title: ["Ireki eta lerrokatu", "Abre y alinea"],
          description: [
            "Ireki zure gutunazalak eta jarri 7 jokalari eta entrenatzaile bat dagokien postuetan. Gorde taldea jardunaldia itxi aurretik.",
            "Abre tus sobres y coloca 7 jugadores y un entrenador en sus posiciones. Guarda el equipo antes de que cierre la jornada.",
          ],
        },
        {
          target: "nav-rankings",
          icon: Trophy,
          title: ["Jarraitu puntuei", "Sigue los puntos"],
          description: [
            "Alderatu jokalarien eta erabiltzaileen sailkapena. 'Guztira' edo jardunaldi zehatz bat aukera dezakezu.",
            "Compara la clasificación de jugadores y usuarios. Puedes elegir 'Total' o una jornada concreta.",
          ],
        },
        {
          target: "nav-matches",
          icon: CircleHelp,
          title: ["Begiratu jardunaldiak", "Consulta las jornadas"],
          description: [
            "Aukeratu jardunaldia klubeko talde bakoitzaren partida, aurkaria, data eta ordua ikusteko.",
            "Elige una jornada para ver el partido, rival, fecha y hora de cada equipo del club.",
          ],
        },
      ];
    }

    return [
      {
        icon: Sparkles,
        title: ["Ongi etorri BZG Fantasy-ra!", "¡Te damos la bienvenida a BZG Fantasy!"],
        description: [
          "Etxebarriko eskubaloi-fantasya da. Ibilbide labur honetan webgunean zer ikus dezakezun erakutsiko dizugu.",
          "Este es el fantasy de balonmano de Etxebarri. En este recorrido breve te enseñamos qué puedes ver en la web.",
        ],
      },
      {
        target: "nav-rankings",
        icon: Trophy,
        title: ["Sailkapenak", "Clasificaciones"],
        description: [
          "Ikusi jokalarien eta erabiltzaileen sailkapena, denboraldiko guztizkoa edo jardunaldika.",
          "Consulta la clasificación de jugadores y usuarios, tanto el total de la temporada como cada jornada.",
        ],
      },
      {
        target: "nav-teams",
        icon: Users,
        title: ["Taldeak eta jokalariak", "Equipos y jugadores"],
        description: [
          "Ezagutu klubeko taldeak. Sakatu jokalari bat bere posizioak eta jardunaldi bakoitzeko estatistikak ikusteko.",
          "Conoce los equipos del club. Pulsa un jugador para ver sus posiciones y estadísticas de cada jornada.",
        ],
      },
      {
        target: "nav-matches",
        icon: CircleHelp,
        title: ["Partidak", "Partidos"],
        description: [
          "Aukeratu jardunaldia talde bakoitzaren aurkaria, data eta ordua ikusteko.",
          "Elige una jornada para ver el rival, la fecha y la hora de cada equipo.",
        ],
      },
      {
        target: "login",
        icon: Users,
        title: ["Sortu zure taldea", "Crea tu equipo"],
        description: [
          "Sakatu Sartu kontu bat sortzeko. Saioa hastean gutunazalak, misioak eta zure taldea izango dituzu.",
          "Pulsa Entrar para crear una cuenta. Al iniciar sesión tendrás sobres, misiones y tu propio equipo.",
        ],
      },
    ];
  }, [isManager, isStaff, isSuperAdmin, user]);

  useEffect(() => {
    if (loading) return;
    const timer = window.setTimeout(() => {
      if (!window.localStorage.getItem(storageKey)) {
        setStep(0);
        setOpen(true);
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [loading, storageKey]);

  useEffect(() => {
    const launch = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(TOUR_EVENT, launch);
    return () => window.removeEventListener(TOUR_EVENT, launch);
  }, []);

  useEffect(() => {
    if (!open) return;
    const updateTarget = () => {
      const target = steps[step]?.target;
      const element = target ? document.querySelector<HTMLElement>(`[data-tour="${target}"]`) : null;
      if (element) {
        element.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
        setTargetRect(element.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };
    updateTarget();
    const timer = window.setTimeout(updateTarget, 250);
    window.addEventListener("resize", updateTarget);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateTarget);
    };
  }, [open, step, steps]);

  useEffect(() => {
    if (!open) return;
    cardRef.current?.focus();
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        finish();
        return;
      }
      if (event.key !== "Tab" || !cardRef.current) return;
      const focusable = Array.from(
        cardRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        cardRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  });

  function finish() {
    window.localStorage.setItem(storageKey, "done");
    setOpen(false);
  }

  if (!open || !steps[step]) return null;

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;
  const cardNearBottom = targetRect ? targetRect.top > window.innerHeight * 0.62 : false;

  return (
    <div className="fixed inset-0 z-[80]" role="presentation">
      <div className="absolute inset-0 bg-foreground/70" aria-hidden />
      {targetRect && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[81] rounded-xl ring-4 ring-primary-foreground shadow-[0_0_0_9999px_color-mix(in_oklab,var(--foreground)_70%,transparent)] transition-all duration-300 motion-reduce:transition-none"
          style={{
            left: Math.max(6, targetRect.left - 5),
            top: Math.max(6, targetRect.top - 5),
            width: Math.min(window.innerWidth - 12, targetRect.width + 10),
            height: targetRect.height + 10,
          }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-description"
        tabIndex={-1}
        className={`fixed left-4 right-4 z-[82] mx-auto max-w-md rounded-xl border border-border bg-background p-5 shadow-elevated outline-none ${
          cardNearBottom ? "bottom-28" : "top-1/2 -translate-y-1/2"
        } sm:left-auto sm:right-6 sm:w-[26rem]`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase text-primary">
            {t("Urratsa", "Paso")} {step + 1} / {steps.length}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={finish}>
            {t("Saltatu", "Omitir")}
          </Button>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-secondary text-primary">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
        <h2 id="tour-title" className="mt-4 font-display text-2xl">
          {t(current.title[0], current.title[1])}
        </h2>
        <p id="tour-description" className="mt-2 text-sm leading-6 text-muted-foreground">
          {t(current.description[0], current.description[1])}
        </p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            disabled={step === 0}
          >
            <ChevronLeft aria-hidden /> {t("Atzera", "Atrás")}
          </Button>
          <div className="flex gap-1" aria-hidden>
            {steps.map((_, index) => (
              <span
                key={index}
                className={`h-1.5 rounded-full transition-all ${index === step ? "w-5 bg-primary" : "w-1.5 bg-border"}`}
              />
            ))}
          </div>
          <Button
            type="button"
            onClick={() => (isLast ? finish() : setStep((value) => value + 1))}
          >
            {isLast ? t("Amaitu", "Terminar") : t("Hurrengoa", "Siguiente")}
            {!isLast && <ChevronRight aria-hidden />}
          </Button>
        </div>
      </div>
    </div>
  );
}