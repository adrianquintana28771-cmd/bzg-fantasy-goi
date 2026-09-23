import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, QrCode, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/misiones")({
  head: () => ({
    meta: [
      { title: "Misiones · BZG Fantasy" },
      { name: "description", content: "Completa misiones para ganar sobres y escanea el QR del pabellón para conseguir un sobre premium." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ qr: typeof s.qr === "string" ? s.qr : undefined }),
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

function MisionesPage() {
  const { user, loading, isStaff } = useAuth();
  const { qr } = Route.useSearch();

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-10 text-center text-muted-foreground">Cargando…</div>;

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <BackButton />
        <h1 className="mt-4 font-display text-3xl">Misiones</h1>
        <p className="mt-2 text-muted-foreground">Inicia sesión para completar misiones y conseguir sobres.</p>
        <Link to="/auth" className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Entrar</Link>
      </div>
    );
  }

  if (isStaff) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <BackButton />
        <h1 className="mt-4 font-display text-3xl">Sección de juego</h1>
        <p className="mt-2 text-muted-foreground">Las cuentas de administración no tienen misiones ni sobres.</p>
      </div>
    );
  }

  return <Inner userId={user.id} initialQr={qr} />;
}

function Inner({ userId, initialQr }: { userId: string; initialQr?: string }) {
  const qc = useQueryClient();
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
      return { sobres: data?.sobres ?? 0, premium: (data as { sobres_premium?: number } | null)?.sobres_premium ?? 0 };
    },
  });

  const misiones = useQuery({
    queryKey: ["misiones", userId],
    queryFn: async (): Promise<{ mision: MisionRow; claimed: boolean }[]> => {
      const [{ data: ms }, { data: um }] = await Promise.all([
        supabase.from("misiones").select("id, nombre, descripcion, recompensa_sobres, tipo_sobre, requiere_qr").eq("is_active", true).order("created_at"),
        supabase.from("user_misiones").select("mision_id").eq("user_id", userId),
      ]);
      const claimedIds = new Set((um ?? []).map((r) => r.mision_id));
      return ((ms ?? []) as unknown as MisionRow[]).map((m) => ({ mision: m, claimed: claimedIds.has(m.id) }));
    },
  });

  const claimMut = useMutation({
    mutationFn: async (misionId: string) => {
      const { data, error } = await supabase.rpc("claim_mision", { _mision_id: misionId });
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      toast.success("¡Recompensa conseguida!");
      qc.invalidateQueries({ queryKey: ["wallet", userId] });
      qc.invalidateQueries({ queryKey: ["misiones", userId] });
    },
    onError: (e: Error) => toast.error(e.message ?? "No se pudo reclamar"),
  });

  const qrMut = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await (supabase.rpc as unknown as (
        f: string,
        a: Record<string, unknown>,
      ) => Promise<{ data: number | null; error: { message: string } | null }>)("claim_qr", { _codigo: code });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success("¡Sobre PREMIUM conseguido!");
      setCodigo("");
      qc.invalidateQueries({ queryKey: ["wallet", userId] });
      qc.invalidateQueries({ queryKey: ["misiones", userId] });
    },
    onError: (e: Error) =>
      toast.error(e.message.includes("canjeado") ? "Ya has canjeado este código" : "Código no válido"),
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
        <h1 className="font-display text-3xl leading-none">Misiones</h1>
        <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">Consigue sobres y amplía tu equipo</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <Package className="mx-auto h-6 w-6 text-primary" />
          <div className="mt-1 font-display text-3xl">{wallet.data?.sobres ?? 0}</div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Sobres normales</div>
        </div>
        <div className="rounded-2xl border-2 border-[color:var(--gold,#d4a017)] bg-card p-4 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-[color:var(--gold,#d4a017)]" />
          <div className="mt-1 font-display text-3xl">{wallet.data?.premium ?? 0}</div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Sobres premium</div>
        </div>
      </div>

      {/* QR premium */}
      <section className="rounded-2xl border-2 border-[color:var(--gold,#d4a017)]/60 bg-card p-4">
        <h2 className="flex items-center gap-2 font-display text-lg">
          <QrCode className="h-5 w-5 text-[color:var(--gold,#d4a017)]" /> Sobre PREMIUM con QR
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escanea el código QR de la pared del pabellón durante un partido, o escribe aquí el código.
          El sobre premium lleva un jugador raro o legendario asegurado.
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
            Canjear
          </button>
        </div>
        {premium.map(({ mision, claimed }) => (
          <p key={mision.id} className="mt-2 text-xs text-muted-foreground">
            {claimed ? "✅ Ya canjeado: " : "🎯 "} {mision.nombre}
          </p>
        ))}
      </section>

      {/* Misiones normales */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg">
          <Trophy className="h-5 w-5 text-[color:var(--gold,#d4a017)]" /> Misiones del club
        </h2>
        <ul className="space-y-2">
          {normales.map(({ mision, claimed }) => (
            <li key={mision.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{mision.nombre}</div>
                <div className="text-xs text-muted-foreground">{mision.descripcion}</div>
              </div>
              <button
                onClick={() => claimMut.mutate(mision.id)}
                disabled={claimed || claimMut.isPending}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-bold disabled:opacity-40"
              >
                {claimed ? "Hecha" : (<><Package className="h-3 w-3" /> +{mision.recompensa_sobres}</>)}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <Link to="/plantilla" className="block rounded-xl bg-primary py-3 text-center font-display text-lg text-primary-foreground">
        Ir a mi equipo
      </Link>
    </div>
  );
}
