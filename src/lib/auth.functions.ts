import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
      return {
        ok: true as const,
        access_token: s.session.access_token,
        refresh_token: s.session.refresh_token,
      };
    } catch {
      return fail;
    }
  });
