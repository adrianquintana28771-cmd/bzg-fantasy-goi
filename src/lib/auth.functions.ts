import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

function clientIp() {
  return (
    getRequestHeader("cf-connecting-ip") ??
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

const schema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(36)
    .regex(/^[A-Za-z0-9_.-]+$/),
  password: z.string().min(1).max(72),
});

/**
 * Login por usuario: el email se resuelve en el servidor y nunca llega al navegador.
 * Siempre devuelve el mismo error genérico para no revelar si el usuario existe.
 */
export const loginWithUsername = createServerFn({ method: "POST" })
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data }) => {
    const fail = { ok: false as const };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { createClient } = await import("@supabase/supabase-js");
      const userBucket = `login:u:${data.username.toLowerCase()}`;
      const ipBucket = `login:ip:${clientIp()}`;
      const [{ data: okUser }, { data: okIp }] = await Promise.all([
        supabaseAdmin.rpc("auth_rate_check", { _bucket: userBucket, _max: 8, _window_seconds: 900 }),
        supabaseAdmin.rpc("auth_rate_check", { _bucket: ipBucket, _max: 40, _window_seconds: 900 }),
      ]);
      if (okUser === false || okIp === false) return { ok: false as const, limited: true as const };
      const { data: email } = await supabaseAdmin.rpc("email_for_username", {
        _username: data.username,
      });
      const target = (email as string | null) ?? `${data.username.toLowerCase()}@bzg.invalid`;
      const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
      const pub = createClient(process.env.SUPABASE_URL!, key, {
        auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      });
      const { data: s, error } = await pub.auth.signInWithPassword({
        email: target,
        password: data.password,
      });
      if (error || !s.session) return fail;
      await supabaseAdmin.rpc("auth_rate_clear", { _bucket: userBucket });
      return {
        ok: true as const,
        access_token: s.session.access_token,
        refresh_token: s.session.refresh_token,
      };
    } catch {
      return fail;
    }
  });

const signupSchema = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[a-z0-9_]+$/),
  dni: z.string().trim().regex(/^\d{8}[A-Z]$/),
});

/** Comprueba en el servidor si usuario/DNI están libres, con límite por IP. */
export const checkSignupAvailability = createServerFn({ method: "POST" })
  .inputValidator((d) => signupSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ok } = await supabaseAdmin.rpc("auth_rate_check", {
      _bucket: `signup:ip:${clientIp()}`,
      _max: 15,
      _window_seconds: 3600,
    });
    if (ok === false) return { limited: true as const, userTaken: false, dniTaken: false };
    const { data: userTaken } = await supabaseAdmin.rpc("username_exists", { _username: data.username });
    // El registro de DNI no se revela públicamente.
    return { limited: false as const, userTaken: !!userTaken, dniTaken: false };
  });
