import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ExternalLink, Package, QrCode, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import { openGuidedTour, TOUR_COMPLETED_EVENT } from "@/components/guided-tour";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/misiones")({
  head: () => ({
    meta: [
      { title: "Misiones · BZG Fantasy" },
      {
        name: "description",
        content:
          "Completa misiones para ganar sobres y escanea el QR del pabellón para conseguir un sobre premium.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    qr: typeof s.qr === "string" ? s.qr : undefined,
  }),
  component: MisionesPage,
});

interface MisionRow {
  id: string;
  nombre: string;
  descripcion: string;
  recompensa_sobres: number;
  tipo_sobre: string;
  requiere_qr: boolean | null;
}

const TUTORIAL_MISSION_ID = "a8d4a001-7985-4f2a-a23b-b2079a97bd01";
const FEDERATION_MISSION_ID = "a8d4a002-7985-4f2a-a23b-b2079a97bd02";
const BZG_MISSION_ID = "a8d4a003-7985-4f2a-a23b-b2079a97bd03";

const missionCopy: Record<
  string,
  { title: [string, string]; description: [string, string]; url?: string }
> = {
  [TUTORIAL_MISSION_ID]: {
    title: ["Osatu tutoriala", "Completa el tutorial"],
    description: [
      "Ikusi tutorial gidatua amaierara arte.",
      "Mira el tutorial guiado hasta el final.",
    ],
  },
  [FEDERATION_MISSION_ID]: {
    title: ["Bisitatu Federazioa", "Visita la Federación"],
    description: [
      "Bisitatu Federazioa emaitzak eta jardunaldiak ikusteko.",
      "Visita la Federación para ver los resultados y sus jornadas",
    ],
    url: "https://www.fvbm.eus/index?del=0",
  },
  [BZG_MISSION_ID]: {
    title: ["Bisitatu BerdeZuriGorri!", "¡Visita BerdeZuriGorri!"],
    description: [
      "Bisitatu BerdeZuriGorriren webgune ofiziala!",
      "Visita la pagina oficial de BerdeZuriGorri!!",
    ],
    url: "https://www.bzg.eus/",
  },
};

function MisionesPage() {
  const { user, loading, isStaff } = useAuth();
  const { qr } = Route.useSearch();
  const t = useT();

  if (loading)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center text-muted-foreground">
        {t("Kargatzen…", "Cargando…")}
      </div>
    );

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <BackButton />
        <h1 className="mt-4 font-display text-3xl">{t("Misioak", "Misiones")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t(
            "Hasi saioa misioak egiteko eta gutunazalak lortzeko.",
            "Inicia sesión para completar misiones y conseguir sobres.",
          )}
        </p>
        <Link
          to="/auth"
          className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          {t("Sartu", "Entrar")}
        </Link>
      </div>
    );
  }

  if (isStaff) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <BackButton />
        <h1 className="mt-4 font-display text-3xl">{t("Joko-atala", "Sección de juego")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t(
            "Administrazio-kontuek ez dute misiorik ez gutunazalik.",
            "Las cuentas de administración no tienen misiones ni sobres.",
          )}
        </p>
      </div>
    );
  }

  return <Inner userId={user.id} initialQr={qr} />;
}

function Inner({ userId, initialQr }: { userId: string; initialQr?: string }) {
  const qc = useQueryClient();
  const t = useT();
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState(initialQr ?? "");

  const wallet = useQuery({
    queryKey: ["wallet", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_wallet")
        .select("sobres, sobres_premium")
        .eq("user_id", userId)
        .maybeSingle();
      return {
        sobres: data?.sobres ?? 0,
        premium: (data as { sobres_premium?: number } | null)?.sobres_premium ?? 0,
      };
    },
  });

  const misiones = useQuery({
    queryKey: ["misiones", userId],
    queryFn: async (): Promise<{ mision: MisionRow; claimed: boolean }[]> => {
      const [{ data: ms }, { data: um }] = await Promise.all([
        supabase
          .from("misiones")
          .select("id, nombre, descripcion, recompensa_sobres, tipo_sobre, requiere_qr")
          .eq("is_active", true)
          .order("created_at"),
        supabase.from("user_misiones").select("mision_id").eq("user_id", userId),
      ]);
      const claimedIds = new Set((um ?? []).map((r) => r.mision_id));
      return ((ms ?? []) as unknown as MisionRow[]).map((m) => ({
        mision: m,
        claimed: claimedIds.has(m.id),
      }));
    },
  });

  const claimMut = useMutation({
    mutationFn: async (misionId: string) => {
      const { data, error } = await supabase.rpc("claim_mision", { _mision_id: misionId });
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      toast.success(t("Saria lortuta!", "¡Recompensa conseguida!"));
      qc.invalidateQueries({ queryKey: ["wallet", userId] });
      qc.invalidateQueries({ queryKey: ["misiones", userId] });
    },
    onError: (e: Error) =>
      toast.error(e.message ?? t("Ezin izan da eskatu", "No se pudo reclamar")),
  });

  useEffect(() => {
    const tutorial = (misiones.data ?? []).find(
      ({ mision }) => mision.id === TUTORIAL_MISSION_ID,
    );
    const claimCompletedTutorial = () => {
      if (
        tutorial &&
        !tutorial.claimed &&
        window.localStorage.getItem("bzg_tour_v1_player") === "done" &&
        !claimMut.isPending
      ) {
        claimMut.mutate(TUTORIAL_MISSION_ID);
      }
    };

    claimCompletedTutorial();
    window.addEventListener(TOUR_COMPLETED_EVENT, claimCompletedTutorial);
    return () => window.removeEventListener(TOUR_COMPLETED_EVENT, claimCompletedTutorial);
  }, [misiones.data, claimMut.isPending]);

  const qrMut = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await (
        supabase.rpc as unknown as (
          f: string,
          a: Record<string, unknown>,
        ) => Promise<{ data: number | null; error: { message: string } | null }>
      )("claim_qr", { _codigo: code });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success(t("PREMIUM gutunazala lortuta!", "¡Sobre PREMIUM conseguido!"));
      setCodigo("");
      qc.invalidateQueries({ queryKey: ["wallet", userId] });
      qc.invalidateQueries({ queryKey: ["misiones", userId] });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("canjeado")
          ? t("Kode hau trukatu duzu jada", "Ya has canjeado este código")
          : t("Kodea ez da baliozkoa", "Código no válido"),
      ),
  });

  // Auto-canjea cuando se llega desde el QR del pabellón
  useEffect(() => {
    if (initialQr) {
      qrMut.mutate(initialQr);
      navigate({ to: "/misiones", search: { qr: undefined }, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQr]);

  const normales = (misiones.data ?? []).filter((m) => m.mision.tipo_sobre !== "premium");
  const premium = (misiones.data ?? []).filter((m) => m.mision.tipo_sobre === "premium");

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <BackButton />

      <header>
        <h1 className="font-display text-3xl leading-none">{t("Misioak", "Misiones")}</h1>
        <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
          {t("Lortu gutunazalak eta handitu zure taldea", "Consigue sobres y amplía tu equipo")}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <Package className="mx-auto h-6 w-6 text-primary" />
          <div className="mt-1 font-display text-3xl">{wallet.data?.sobres ?? 0}</div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {t("Gutunazal arruntak", "Sobres normales")}
          </div>
        </div>
        <div className="rounded-2xl border-2 border-[color:var(--gold,#d4a017)] bg-card p-4 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-[color:var(--gold,#d4a017)]" />
          <div className="mt-1 font-display text-3xl">{wallet.data?.premium ?? 0}</div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {t("Premium gutunazalak", "Sobres premium")}
          </div>
        </div>
      </div>

      {/* QR premium */}
      <section className="rounded-2xl border-2 border-[color:var(--gold,#d4a017)]/60 bg-card p-4">
        <h2 className="flex items-center gap-2 font-display text-lg">
          <QrCode className="h-5 w-5 text-[color:var(--gold,#d4a017)]" />{" "}
          {t("PREMIUM gutunazala QRarekin", "Sobre PREMIUM con QR")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "Eskaneatu pabiloiko hormako QR kodea partida batean, edo idatzi kodea hemen. Premium gutunazalak jokalari arraro edo legendario bat du ziur.",
            "Escanea el código QR de la pared del pabellón durante un partido, o escribe aquí el código. El sobre premium lleva un jugador raro o legendario asegurado.",
          )}
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="BZG-PARTIDO-2025"
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={() => codigo.trim() && qrMut.mutate(codigo.trim())}
            disabled={qrMut.isPending}
            className="shrink-0 rounded-lg bg-[color:var(--gold,#d4a017)] px-3 py-2 text-sm font-bold text-black disabled:opacity-50"
          >
            {t("Trukatu", "Canjear")}
          </button>
        </div>
        {premium.map(({ mision, claimed }) => (
          <p key={mision.id} className="mt-2 text-xs text-muted-foreground">
            {claimed ? t("✅ Trukatuta: ", "✅ Ya canjeado: ") : "🎯 "} {mision.nombre}
          </p>
        ))}
      </section>

      {/* Misiones normales */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg">
          <Trophy className="h-5 w-5 text-[color:var(--gold,#d4a017)]" />{" "}
          {t("Klubaren misioak", "Misiones del club")}
        </h2>
        <ul className="space-y-2">
          {normales.map(({ mision, claimed }) => {
            const copy = missionCopy[mision.id];
            const isTutorial = mision.id === TUTORIAL_MISSION_ID;
            const actionLabel = isTutorial
              ? t("Tutoriala ikusi", "Ver tutorial")
              : t("Webgunea bisitatu", "Visitar web");

            return (
              <li key={mision.id} className="rounded-lg border border-border p-3">
                <div className="text-sm font-semibold">
                  {copy ? t(copy.title[0], copy.title[1]) : mision.nombre}
                </div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  {copy ? t(copy.description[0], copy.description[1]) : mision.descripcion}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                    <Package className="h-3.5 w-3.5" /> +{mision.recompensa_sobres}
                  </span>
                  {claimed ? (
                    <span className="text-xs font-bold text-muted-foreground">
                      {t("Eginda", "Hecha")}
                    </span>
                  ) : isTutorial ? (
                    <Button type="button" size="sm" variant="secondary" onClick={openGuidedTour}>
                      <BookOpen aria-hidden /> {actionLabel}
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="secondary">
                      <a
                        href={copy?.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => claimMut.mutate(mision.id)}
                      >
                        {actionLabel} <ExternalLink aria-hidden />
                      </a>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <Link
        to="/plantilla"
        className="block rounded-xl bg-primary py-3 text-center font-display text-lg text-primary-foreground"
      >
        {t("Joan nire taldera", "Ir a mi equipo")}
      </Link>
    </div>
  );
}
