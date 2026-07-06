import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { LogIn, UserPlus, ArrowLeft, KeyRound, MailCheck } from "lucide-react";

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

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "Máximo 72 caracteres")
  .regex(/[a-z]/, "Debe incluir una letra minúscula")
  .regex(/[A-Z]/, "Debe incluir una letra mayúscula")
  .regex(/\d/, "Debe incluir un número");

const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Nombre demasiado corto")
  .max(60, "Máximo 60 caracteres")
  .regex(/^[\p{L}\p{M}\s'.\-]+$/u, "Sólo letras, espacios, guiones y apóstrofos");

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email no válido")
  .max(255, "Email demasiado largo");

const loginSchema = z.object({
  dni: dniSchema,
  password: z.string().min(1, "Introduce tu contraseña").max(72),
});

const signupSchema = z.object({
  dni: dniSchema,
  email: emailSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
});

type Mode = "login" | "signup" | "forgot";

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
        <h1 className="font-display text-3xl">
          {mode === "login" ? "Entrar" : mode === "signup" ? "Crear cuenta" : "Recuperar contraseña"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login"
            ? "Accede con tu DNI y contraseña."
            : mode === "signup"
              ? "Regístrate con tu DNI, email y contraseña."
              : "Introduce tu DNI y te enviaremos un enlace al email registrado."}
        </p>

        {mode !== "forgot" && (
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
        )}

        {mode === "login" && <LoginForm onForgot={() => setMode("forgot")} />}
        {mode === "signup" && <SignupForm onDone={() => setMode("login")} />}
        {mode === "forgot" && <ForgotForm onBack={() => setMode("login")} />}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        🔒 Protegemos los datos personales de menores. El DNI se usa sólo para identificarte.
      </p>
    </div>
  );
}

function LoginForm({ onForgot }: { onForgot: () => void }) {
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
        const msg = error.message.toLowerCase();
        if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
          toast.error("Aún no has validado tu email. Revisa tu bandeja de entrada.");
        } else {
          toast.error("DNI o contraseña incorrectos");
        }
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
      <button
        type="button"
        onClick={onForgot}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <KeyRound className="h-4 w-4" /> ¿Has olvidado la contraseña?
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
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [resending, setResending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ dni, email, displayName, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const { data: exists, error: existsErr } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: boolean | null; error: unknown }>)("dni_exists", {
        _dni: parsed.data.dni,
      });
      if (existsErr) throw existsErr;
      if (exists) {
        toast.error("Ese DNI ya está registrado. Prueba a entrar con tu contraseña.");
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: {
            dni: parsed.data.dni,
            display_name: parsed.data.displayName,
          },
        },
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("profiles_dni_key")) {
          toast.error("Ese DNI ya está registrado");
        } else if (msg.includes("already") || msg.includes("registered")) {
          toast.error("Ese email ya está registrado");
        } else if (msg.includes("duplicate") || msg.includes("database error")) {
          toast.error("Ese DNI o email ya está registrado");
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success("Te hemos enviado un código de 6 dígitos al email.");
      setPendingEmail(parsed.data.email);
    } catch (err) {
      console.error(err);
      toast.error("Error al registrarte");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingEmail) return;
    if (!/^\d{6}$/.test(otp)) {
      toast.error("El código son 6 dígitos");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token: otp,
        type: "email",
      });
      if (error) {
        toast.error("Código incorrecto o caducado");
        return;
      }
      toast.success("Email validado. ¡Ya puedes entrar!");
      await supabase.auth.signOut();
      setPendingEmail(null);
      setOtp("");
      onDone();
    } catch (err) {
      console.error(err);
      toast.error("Error al validar el código");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!pendingEmail) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth` },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Te hemos enviado un nuevo código.");
    } finally {
      setResending(false);
    }
  }

  if (pendingEmail) {
    return (
      <form onSubmit={verify} className="mt-5 space-y-4">
        <div className="rounded-xl bg-secondary/50 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <MailCheck className="h-4 w-4" /> Revisa tu email
          </p>
          <p className="mt-1 text-muted-foreground">
            Hemos enviado un código de 6 dígitos a <span className="font-mono">{pendingEmail}</span>. Introdúcelo para validar tu cuenta.
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Código de 6 dígitos
          </span>
          <input
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            required
            autoComplete="one-time-code"
            className="w-full rounded-lg border border-input bg-background px-3 py-3 text-center font-mono text-2xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-display text-lg text-primary-foreground shadow-card transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          <MailCheck className="h-5 w-5" /> {busy ? "Validando..." : "Validar email"}
        </button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={resend} disabled={resending} className="text-muted-foreground hover:text-foreground disabled:opacity-60">
            {resending ? "Reenviando..." : "Reenviar código"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPendingEmail(null);
              setOtp("");
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            Cambiar datos
          </button>
        </div>
      </form>
    );
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
        <UserPlus className="h-5 w-5" /> {busy ? "Enviando código..." : "Crear cuenta"}
      </button>
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [dni, setDni] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = dniSchema.safeParse(dni);
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
        _dni: parsed.data,
      });
      if (rpcError) throw rpcError;
      // Always show the same message to avoid revealing whether a DNI exists.
      if (emailData) {
        const { error } = await supabase.auth.resetPasswordForEmail(emailData as string, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) console.error(error);
      }
      setSent(true);
    } catch (err) {
      console.error(err);
      toast.error("Error al enviar el enlace");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-5 space-y-4">
        <div className="rounded-xl bg-secondary/50 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <MailCheck className="h-4 w-4" /> Revisa tu email
          </p>
          <p className="mt-1 text-muted-foreground">
            Si el DNI está registrado, hemos enviado un enlace para restablecer tu contraseña. Puede tardar unos minutos.
          </p>
        </div>
        <button
          onClick={onBack}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-display text-lg text-primary-foreground shadow-card"
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      <Field label="DNI" value={dni} onChange={setDni} placeholder="12345678A" autoComplete="username" maxLength={9} />
      <button
        type="submit"
        disabled={busy}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-display text-lg text-primary-foreground shadow-card transition hover:-translate-y-0.5 disabled:opacity-60"
      >
        <KeyRound className="h-5 w-5" /> {busy ? "Enviando..." : "Enviar enlace"}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a entrar
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
