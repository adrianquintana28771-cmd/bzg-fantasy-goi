import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, UserPlus } from "lucide-react";
import { loginWithUsername } from "@/lib/auth.functions";
import { useT } from "@/lib/i18n";

type T = (eu: string, es: string) => string;
const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

function schemas(t: T) {
  const dni = z
    .string()
    .trim()
    .regex(
      /^\d{8}[A-Za-z]$/,
      t("NAN ez da zuzena (8 zenbaki eta letra 1)", "DNI no válido (8 dígitos y 1 letra)"),
    )
    .transform((v) => v.toUpperCase())
    .refine(
      (v) => DNI_LETTERS[parseInt(v.slice(0, 8), 10) % 23] === v[8],
      t("NANaren letra ez da zuzena", "La letra del DNI no es correcta"),
    );
  const username = z
    .string()
    .trim()
    .min(3, t("Gutxienez 3 karaktere", "Mínimo 3 caracteres"))
    .max(24, t("Gehienez 24 karaktere", "Máximo 24 caracteres"))
    .regex(
      /^[a-zA-Z0-9_]+$/,
      t("Letrak, zenbakiak eta azpimarra soilik", "Sólo letras, números y guion bajo"),
    )
    .transform((v) => v.toLowerCase());
  const password = z
    .string()
    .max(72, t("Gehienez 72 karaktere", "Máximo 72 caracteres"))
    .refine(
      (v) => (v.match(/[A-Z]/g) ?? []).length >= 1,
      t("Gutxienez letra larri 1 behar du", "Debe incluir al menos 1 mayúscula"),
    )
    .refine(
      (v) => (v.match(/[a-z]/g) ?? []).length >= 5,
      t("Gutxienez 5 letra xehe behar ditu", "Debe incluir al menos 5 minúsculas"),
    )
    .refine(
      (v) => (v.match(/\d/g) ?? []).length >= 2,
      t("Gutxienez 2 zenbaki behar ditu", "Debe incluir al menos 2 números"),
    );
  const name = z
    .string()
    .trim()
    .min(2, t("Laburregia", "Demasiado corto"))
    .max(40, t("Gehienez 40 karaktere", "Máximo 40 caracteres"))
    .regex(/^[\p{L}\s'-]+$/u, t("Letrak soilik", "Sólo letras"));
  return {
    login: z.object({
      username,
      password: z.string().min(1, t("Sartu pasahitza", "Introduce tu contraseña")).max(72),
    }),
    signup: z.object({ username, password, nombre: name, apellido: name, dni }),
  };
}

async function rpc<T>(fn: string, args: Record<string, unknown>) {
  return (
    supabase.rpc as unknown as (
      f: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: T | null; error: unknown }>
  )(fn, args);
}

const LOCK_KEY = "bzg_login_lock";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;
function getLock(): { count: number; until: number } {
  try {
    return JSON.parse(window.sessionStorage.getItem(LOCK_KEY) ?? "") ?? { count: 0, until: 0 };
  } catch {
    return { count: 0, until: 0 };
  }
}
const setLock = (v: { count: number; until: number }) =>
  window.sessionStorage.setItem(LOCK_KEY, JSON.stringify(v));

export function AuthPanel({ onDone }: { onDone?: () => void }) {
  const t = useT();
  const [mode, setMode] = useState<"login" | "signup">("login");
  return (
    <div>
      <h2 className="font-display text-3xl">
        {mode === "login" ? t("Sartu", "Entrar") : t("Kontua sortu", "Crear cuenta")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "login"
          ? t(
              "Sartu zure erabiltzaile-izenarekin eta pasahitzarekin.",
              "Accede con tu nombre de usuario y contraseña.",
            )
          : t(
              "Erregistratu erabiltzailea, pasahitza, izena, abizena eta NANarekin.",
              "Regístrate con usuario, contraseña, nombre, apellido y DNI.",
            )}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-secondary/60 p-1">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg py-2 text-sm font-semibold transition ${mode === m ? "bg-background shadow-card" : "text-muted-foreground"}`}
          >
            {m === "login" ? t("Sartu", "Entrar") : t("Erregistratu", "Registrarme")}
          </button>
        ))}
      </div>
      {mode === "login" ? <LoginForm onDone={onDone} /> : <SignupForm onDone={onDone} />}
      <p className="mt-4 text-center text-xs text-muted-foreground">
        🔒{" "}
        {t(
          "Adingabeen datu pertsonalak babesten ditugu. NANa zu identifikatzeko bakarrik erabiltzen da.",
          "Protegemos los datos personales de menores. El DNI se usa sólo para identificarte.",
        )}
      </p>
    </div>
  );
}

function LoginForm({ onDone }: { onDone?: () => void }) {
  const t = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  function failed() {
    const count = getLock().count + 1;
    if (count >= MAX_ATTEMPTS) {
      setLock({ count: 0, until: Date.now() + LOCK_MS });
      toast.error(
        t(
          `Saiakera gehiegi. Itxaron ${LOCK_MS / 1000}s.`,
          `Demasiados intentos. Espera ${LOCK_MS / 1000}s.`,
        ),
      );
    } else setLock({ count, until: 0 });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const lock = getLock();
    if (lock.until > Date.now()) {
      const s = Math.ceil((lock.until - Date.now()) / 1000);
      toast.error(
        t(`Saiakera gehiegi. Saiatu berriro ${s}s barru.`, `Demasiados intentos. Prueba en ${s}s.`),
      );
      return;
    }
    const parsed = schemas(t).login.safeParse({ username, password });
    if (!parsed.success) return void toast.error(parsed.error.issues[0].message);
    setBusy(true);
    try {
      const res = await loginWithUsername({ data: parsed.data });
      const { error } = res.ok
        ? await supabase.auth.setSession({
            access_token: res.access_token,
            refresh_token: res.refresh_token,
          })
        : { error: new Error("fail") };
      if (error) {
        failed();
        toast.error(t("Erabiltzailea edo pasahitza okerra", "Usuario o contraseña incorrectos"));
        return;
      }
      window.sessionStorage.removeItem(LOCK_KEY);
      toast.success(t("Ongi etorri!", "¡Bienvenido/a!"));
      onDone?.();
    } catch (err) {
      console.error(err);
      toast.error(t("Errorea saioa hastean", "Error al iniciar sesión"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      <Field
        label={t("Erabiltzailea", "Usuario")}
        value={username}
        onChange={setUsername}
        placeholder="anegk"
        autoComplete="username"
        maxLength={24}
      />
      <Field
        label={t("Pasahitza", "Contraseña")}
        value={password}
        onChange={setPassword}
        type="password"
        autoComplete="current-password"
        maxLength={72}
      />
      <button
        type="submit"
        disabled={busy}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-display text-lg text-primary-foreground shadow-card transition hover:-translate-y-0.5 disabled:opacity-60"
      >
        <LogIn className="h-5 w-5" /> {busy ? t("Sartzen...", "Entrando...") : t("Sartu", "Entrar")}
      </button>
    </form>
  );
}

function SignupForm({ onDone }: { onDone?: () => void }) {
  const t = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [dni, setDni] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schemas(t).signup.safeParse({ username, password, nombre, apellido, dni });
    if (!parsed.success) return void toast.error(parsed.error.issues[0].message);
    setBusy(true);
    try {
      const [{ data: userTaken }, { data: dniTaken }] = await Promise.all([
        rpc<boolean>("username_exists", { _username: parsed.data.username }),
        rpc<boolean>("dni_exists", { _dni: parsed.data.dni }),
      ]);
      if (userTaken)
        return void toast.error(
          t("Erabiltzaile-izen hori hartuta dago", "Ese nombre de usuario ya está cogido"),
        );
      if (dniTaken)
        return void toast.error(
          t(
            "NAN hori erregistratuta dago jada. Saiatu zure pasahitzarekin sartzen.",
            "Ese DNI ya está registrado. Prueba a entrar con tu contraseña.",
          ),
        );
      const { error } = await supabase.auth.signUp({
        email: `${parsed.data.username}@bzgfantasy.app`,
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
        toast.error(
          msg.includes("already") || msg.includes("registered") || msg.includes("duplicate")
            ? t(
                "Erabiltzaile edo NAN hori erregistratuta dago",
                "Ese usuario o DNI ya está registrado",
              )
            : error.message,
        );
        return;
      }
      toast.success(
        t("Kontua sortuta! Jolastu dezakezu orain.", "¡Cuenta creada! Ya puedes jugar."),
      );
      onDone?.();
    } catch (err) {
      console.error(err);
      toast.error(t("Errorea erregistratzean", "Error al registrarte"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      <Field
        label={t("Erabiltzailea", "Usuario")}
        value={username}
        onChange={setUsername}
        placeholder="anegk"
        autoComplete="username"
        maxLength={24}
      />
      <Field
        label={t("Pasahitza", "Contraseña")}
        value={password}
        onChange={setPassword}
        type="password"
        autoComplete="new-password"
        maxLength={72}
      />
      <Field
        label={t("Izena", "Nombre")}
        value={nombre}
        onChange={setNombre}
        placeholder="Ane"
        maxLength={40}
      />
      <Field
        label={t("Abizena", "Apellido")}
        value={apellido}
        onChange={setApellido}
        placeholder="Etxebarria"
        maxLength={40}
      />
      <Field
        label={t("NAN", "DNI")}
        value={dni}
        onChange={setDni}
        placeholder="12345678A"
        maxLength={9}
      />
      <p className="text-xs text-muted-foreground">
        {t(
          "Pasahitzak gutxienez letra larri 1, 5 letra xehe eta 2 zenbaki behar ditu.",
          "La contraseña necesita al menos 1 mayúscula, 5 minúsculas y 2 números.",
        )}
      </p>
      <button
        type="submit"
        disabled={busy}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-display text-lg text-primary-foreground shadow-card transition hover:-translate-y-0.5 disabled:opacity-60"
      >
        <UserPlus className="h-5 w-5" />{" "}
        {busy ? t("Sortzen...", "Creando...") : t("Kontua sortu", "Crear cuenta")}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  maxLength,
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
