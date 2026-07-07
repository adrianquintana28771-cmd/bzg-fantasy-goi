import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useFantasy, fantasyStore } from "@/lib/fantasy/store";
import { AdminGuard } from "@/components/admin-guard";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/admin/reglas")({
  head: () => ({
    meta: [
      { title: "Reglas de puntuación · Admin BZG" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <SuperOnly>
        <Reglas />
      </SuperOnly>
    </AdminGuard>
  ),
});

function SuperOnly({ children }: { children: React.ReactNode }) {
  const { canManageAll } = useAuth();
  if (!canManageAll) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-warning" />
        <h1 className="mt-3 font-display text-3xl">Sólo super_admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Editar las reglas de puntuación está reservado al rol super_admin.
        </p>
        <Link to="/admin" className="mt-6 inline-block text-primary hover:underline">Volver al panel</Link>
      </div>
    );
  }
  return <>{children}</>;
}

function Reglas() {
  const { rules } = useFantasy((s) => s);
  const positives = rules.filter((r) => !r.isNegative);
  const negatives = rules.filter((r) => r.isNegative);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Admin
      </Link>
      <h1 className="mt-3 font-display text-4xl">Reglas de puntuación</h1>
      <p className="text-sm text-muted-foreground">
        Modifica los puntos Fantasy sin tocar código. En categorías benjamín y alevín se aplica
        <strong> modo educativo</strong>: las acciones negativas no restan puntos.
      </p>

      <Bloque titulo="Acciones positivas y bonificaciones" rules={positives} />
      <Bloque titulo="Acciones negativas" rules={negatives} intent="negative" />

      <div className="mt-8 flex justify-end">
        <button
          onClick={() => {
            fantasyStore.resetRules();
            toast.success("Reglas restauradas");
          }}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm hover:bg-secondary"
        >
          Restaurar valores por defecto
        </button>
      </div>
    </div>
  );
}

function Bloque({
  titulo, rules, intent = "positive",
}: {
  titulo: string;
  rules: import("@/lib/fantasy/types").ScoringRule[];
  intent?: "positive" | "negative";
}) {
  return (
    <div className="mt-8">
      <h2 className="font-display text-2xl">{titulo}</h2>
      <div className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {rules.map((r) => (
          <div key={r.key} className="flex items-center gap-3 p-4">
            <label className="flex flex-1 items-center gap-3">
              <input
                type="checkbox"
                checked={r.active}
                onChange={() => fantasyStore.toggleRule(r.key)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              <span className={r.active ? "font-medium" : "text-muted-foreground line-through"}>
                {r.label}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fantasyStore.updateRule(r.key, r.points - 1)}
                className="h-8 w-8 rounded-md border border-border bg-background text-lg hover:bg-secondary"
              >
                −
              </button>
              <input
                type="number"
                value={r.points}
                onChange={(e) => fantasyStore.updateRule(r.key, Number(e.target.value))}
                className={`w-16 rounded-md border border-input bg-background px-2 py-1.5 text-center font-display text-xl ${
                  intent === "negative" ? "text-destructive" : "text-primary"
                }`}
              />
              <button
                onClick={() => fantasyStore.updateRule(r.key, r.points + 1)}
                className="h-8 w-8 rounded-md border border-border bg-background text-lg hover:bg-secondary"
              >
                +
              </button>
              <span className="ml-1 hidden text-xs text-muted-foreground md:inline">pts</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
