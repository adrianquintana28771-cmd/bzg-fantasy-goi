import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { LogIn, UserPlus, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · BZG Fantasy" },
      { name: "description", content: "Accede o regístrate en BZG Fantasy Eskubaloia." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const dniSchema = z
  .string()
  .trim()
  .regex(/^\d{8}[A-Za-z]$/, "DNI no válido (8 dígitos y 1 letra)")
  .transform((v) => v.toUpperCase());

const loginSchema = z.object({
  dni: dniSchema,
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

const signupSchema = z.object({
  dni: dniSchema,
  email: z.string().trim().email("Email no válido").max(255),
  displayName: z.string().trim().min(2, "Mínimo 2 caracteres").max(60),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/", replace: true });
  }, [loading, user, navigate]);

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Inicio
      </Link>

      <div className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-card" style={{ background: "var(--gradient-card)" }}>
        <h1 className="font-display text-3xl">
          {mode === "login" ? "Entrar" : "Crear cuenta"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login" ? "Accede con tu DNI y contraseña." : "Regístrate con tu DNI, email y contraseña."}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-secondary/60 p-1">
          <button
            onClick={() => setMode("login")}
            className={`rounded-lg py-2 text-sm font-semibold transition ${
              mode === "login" ? "bg-background shadow-card" : "text-muted-foreground"
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`rounded-lg py-2 text-sm font-semibold transition ${
              mode === "signup" ? "bg-background shadow-card" : "text-muted-foreground"
            }`}
          >
            Registrarme
          </button>
        </div>

        {mode === "login" ? <LoginForm /> : <SignupForm onDone={() => setMode("login")} />}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        🔒 Protegemos los datos personales de menores. El DNI se usa sólo para identificarte.
      </p>
    </div>
  );
}

function LoginForm() {
  const [dni, setDni] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ dni, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const { data: emailData, error: rpcError } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: string | null; error: unknown }>)("email_for_dni", {
        _dni: parsed.data.dni,
      });
      if (rpcError) throw rpcError;
      if (!emailData) {
        toast.error("DNI o contraseña incorrectos");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: emailData as string,
        password: parsed.data.password,
      });
      if (error) {
        toast.error("DNI o contraseña incorrectos");
        return;
      }
      toast.success("¡Bienvenido/a!");
    } catch (err) {
      console.error(err);
      toast.error("Error al iniciar sesión");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      <Field label="DNI" value={dni} onChange={setDni} placeholder="12345678A" autoComplete="username" maxLength={9} />
      <Field label="Contraseña" value={password} onChange={setPassword} type="password" autoComplete="current-password" maxLength={72} />
      <button
        type="submit"
        disabled={busy}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-display text-lg text-primary-foreground shadow-card transition hover:-translate-y-0.5 disabled:opacity-60"
      >
        <LogIn className="h-5 w-5" /> {busy ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}

function SignupForm({ onDone }: { onDone: () => void }) {
  const [dni, setDni] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ dni, email, displayName, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            dni: parsed.data.dni,
            display_name: parsed.data.displayName,
          },
        },
      });
      if (error) {
        if (error.message.toLowerCase().includes("already")) {
          toast.error("Ese email ya está registrado");
        } else if (error.message.toLowerCase().includes("duplicate") || error.message.includes("profiles_dni_key")) {
          toast.error("Ese DNI ya está registrado");
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success("Cuenta creada. Ya puedes entrar con tu DNI.");
      onDone();
    } catch (err) {
      console.error(err);
      toast.error("Error al registrarte");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      <Field label="Nombre visible" value={displayName} onChange={setDisplayName} placeholder="Ane G." maxLength={60} />
      <Field label="DNI" value={dni} onChange={setDni} placeholder="12345678A" autoComplete="username" maxLength={9} />
      <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" maxLength={255} />
      <Field label="Contraseña" value={password} onChange={setPassword} type="password" autoComplete="new-password" maxLength={72} />
      <button
        type="submit"
        disabled={busy}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-display text-lg text-primary-foreground shadow-card transition hover:-translate-y-0.5 disabled:opacity-60"
      >
        <UserPlus className="h-5 w-5" /> {busy ? "Creando..." : "Crear cuenta"}
      </button>
    </form>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, autoComplete, maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        required
        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
