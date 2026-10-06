import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { passwordSchema } from "@/components/auth-panel";

/** super_admin: cambia la contraseña de un usuario mediante Auth Admin. */
export const adminSetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    // Mismas reglas que el registro: passwordSchema con mensajes en castellano.
    z.object({ userId: z.string().uuid(), password: passwordSchema((_eus, esp) => esp) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: ok, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (roleErr || ok !== true) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
