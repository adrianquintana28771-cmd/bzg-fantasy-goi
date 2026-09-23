import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { LogIn, UserPlus, ArrowLeft } from "lucide-react";
import { loginWithUsername } from "@/lib/auth.functions";

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

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

const dniSchema = z
  .string()
  .trim()
  .regex(/^\d{8}[A-Za-z]$/, "DNI no válido (8 dígitos y 1 letra)")
  .transform((v) => v.toUpperCase())
  .refine((v) => {
    const num = parseInt(v.slice(0, 8), 10);
    return DNI_LETTERS[num % 23] === v[8];
  }, "La letra del DNI no es correcta");

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Mínimo 3 caracteres")
  .max(24, "Máximo 24 caracteres")
  .regex(/^[a-zA-Z0-9_]+$/, "Sólo letras, números y guion bajo")
  .transform((v) => v.toLowerCase());

const passwordSchema = z
  .string()
  .max(72, "Máximo 72 caracteres")
  .refine((v) => (v.match(/[A-Z]/g) ?? []).length >= 1, "Debe incluir al menos 1 mayúscula")
  .refine((v) => (v.match(/[a-z]/g) ?? []).length >= 5, "Debe incluir al menos 5 minúsculas")
  .refine((v) => (v.match(/\d/g) ?? []).length >= 2, "Debe incluir al menos 2 números");

const nameSchema = z
  .string()
  .trim()
  .min(2, "Demasiado corto")
  .max(40, "Máximo 40 caracteres")
  .regex(/^[\p{L}\s'-]+$/u, "Sólo letras");

const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "Introduce tu contraseña").max(72),
});

const signupSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  nombre: nameSchema,
  apellido: nameSchema,
  dni: dniSchema,
});

type Mode = "login" | "signup";

function emailForUsername(username: string) {
  return `${username}@bzgfantasy.app`;
}

async function rpc<T>(fn: string, args: Record<string, unknown>) {
  return (supabase.rpc as unknown as (
    f: string,
    a: Record<string, unknown>,
  ) => Promise<{ data: T | null; error: unknown }>)(fn, args);
}

function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
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
        <h1 className="font-display text-3xl">{mode === "login" ? "Entrar" : "Crear cuenta"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login"
            ? "Accede con tu nombre de usuario y contraseña."
            : "Regístrate con usuario, contraseña, nombre, apellido y DNI."}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-secondary/60 p-1">
          <button
            onClick={() => setMode("login")}
            className={`rounded-lg py-2 text-sm font-semibold transition ${mode === "login" ? "bg-background shadow-card" : "text-muted-foreground"}`}
          >
            Entrar
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`rounded-lg py-2 text-sm font-semibold transition ${mode === "signup" ? "bg-background shadow-card" : "text-muted-foreground"}`}
          >
            Registrarme
          </button>
        </div>

        {mode === "login" ? <LoginForm /> : <SignupForm />}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        🔒 Protegemos los datos personales de menores. El DNI se usa sólo para identificarte.
      </p>
    </div>
  );
}

const LOCK_KEY = "bzg_login_lock";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;

function getLock(): { count: number; until: number } {
  if (typeof window === "undefined") return { count: 0, until: 0 };
  try {
    return JSON.parse(window.sessionStorage.getItem(LOCK_KEY) ?? "") ?? { count: 0, until: 0 };
  } catch {
    return { count: 0, until: 0 };
  }
}
function setLock(v: { count: number; until: number }) {
  if (typeof window !== "undefined") window.sessionStorage.setItem(LOCK_KEY, JSON.stringify(v));
}
function clearLock() {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(LOCK_KEY);
}

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  function registerFailedAttempt() {
    const lock = getLock();
    const count = lock.count + 1;
    if (count >= MAX_ATTEMPTS) {
      setLock({ count: 0, until: Date.now() + LOCK_MS });
      toast.error(`Demasiados intentos. Espera ${LOCK_MS / 1000}s.`);
    } else {
      setLock({ count, until: 0 });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const lock = getLock();
    if (lock.until > Date.now()) {
      toast.error(`Demasiados intentos. Prueba en ${Math.ceil((lock.until - Date.now()) / 1000)}s.`);
      return;
    }
    const parsed = loginSchema.safeParse({ username, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const res = await loginWithUsername({ data: { username: parsed.data.username, password: parsed.data.password } });
      const { error } = res.ok
        ? await supabase.auth.setSession({ access_token: res.access_token, refresh_token: res.refresh_token })
        : { error: new Error("fail") };
      if (error) {
        registerFailedAttempt();
        toast.error("Usuario o contraseña incorrectos");
        return;
      }
      clearLock();
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
      <Field label="Usuario" value={username} onChange={setUsername} placeholder="anegk" autoComplete="username" maxLength={24} />
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

function SignupForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [dni, setDni] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ username, password, nombre, apellido, dni });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const [{ data: userTaken }, { data: dniTaken }] = await Promise.all([
        rpc<boolean>("username_exists", { _username: parsed.data.username }),
        rpc<boolean>("dni_exists", { _dni: parsed.data.dni }),
      ]);
      if (userTaken) {
        toast.error("Ese nombre de usuario ya está cogido");
        return;
      }
      if (dniTaken) {
        toast.error("Ese DNI ya está registrado. Prueba a entrar con tu contraseña.");
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: emailForUsername(parsed.data.username),
        password: parsed.data.password,
        options: {
          data: {
            username: parsed.data.username,
            display_name: parsed.data.username,
            nombre: parsed.data.nombre,
            apellido: parsed.data.apellido,
            dni: parsed.data.dni,
          },
        },
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("already") || msg.includes("registered") || msg.includes("duplicate")) {
          toast.error("Ese usuario o DNI ya está registrado");
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success("¡Cuenta creada! Ya puedes jugar.");
    } catch (err) {
      console.error(err);
      toast.error("Error al registrarte");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      <Field label="Usuario" value={username} onChange={setUsername} placeholder="anegk" autoComplete="username" maxLength={24} />
      <Field label="Contraseña" value={password} onChange={setPassword} type="password" autoComplete="new-password" maxLength={72} />
      <Field label="Nombre" value={nombre} onChange={setNombre} placeholder="Ane" maxLength={40} />
      <Field label="Apellido" value={apellido} onChange={setApellido} placeholder="Etxebarria" maxLength={40} />
      <Field label="DNI" value={dni} onChange={setDni} placeholder="12345678A" maxLength={9} />
      <p className="text-xs text-muted-foreground">
        La contraseña necesita al menos 1 mayúscula, 5 minúsculas y 2 números.
      </p>
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
