import { createFileRoute } from "@tanstack/react-router";

// Llamado cada hora por la tarea programada de la base de datos con un token privado.
export const Route = createFileRoute("/api/public/hooks/sync-matches")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-cron-token") ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: ok } = await supabaseAdmin.rpc("check_cron_token" as never, {
          _nombre: "sync_partidos",
          _token: token,
        } as never);
        if (!ok) return new Response("Unauthorized", { status: 401 });
        const { syncAll } = await import("@/lib/match-sync.server");
        const resumen = await syncAll(supabaseAdmin as never);
        return Response.json({ ok: true, resumen });
      },
    },
  },
});
