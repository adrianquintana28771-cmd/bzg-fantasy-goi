import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PRED_SLOTS, countAciertos, fetchIdealSeven, type PredSlot } from "@/lib/ideal-seven";
import { REWARD_BY_ACIERTOS } from "@/lib/prediction-rewards";

/** Primera jornada cerrada con predicción del usuario y sin recompensa recogida. */
export const getPendingPredictionReward = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const [{ data: preds }, { data: done }] = await Promise.all([
      db.from("predicciones").select("jornada_id, jornadas!inner(numero, is_locked)").eq("user_id", context.userId),
      db.from("prediccion_recompensas").select("jornada_id").eq("user_id", context.userId),
    ]);
    const claimed = new Set((done ?? []).map((d) => d.jornada_id));
    const pending = ((preds ?? []) as unknown as { jornada_id: string; jornadas: { numero: number; is_locked: boolean } }[])
      .filter((p) => p.jornadas.is_locked && !claimed.has(p.jornada_id))
      .sort((a, b) => a.jornadas.numero - b.jornadas.numero)[0];
    return pending ? { jornadaId: pending.jornada_id, numero: pending.jornadas.numero } : null;
  });

/** Calcula aciertos, entrega cartas aleatorias por rareza y marca la recompensa como recogida (una sola vez). */
export const claimPredictionReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jornadaId: string }) => ({ jornadaId: String(d.jornadaId) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    const { data: j } = await supabaseAdmin.from("jornadas").select("numero, is_locked").eq("id", data.jornadaId).maybeSingle();
    if (!j?.is_locked) throw new Error("Jornada no cerrada");
    const { data: pred } = await supabaseAdmin
      .from("predicciones").select("*").eq("user_id", uid).eq("jornada_id", data.jornadaId).maybeSingle();
    if (!pred) throw new Error("Sin predicción");

    const { ideal, cands, points } = await fetchIdealSeven(j.numero, supabaseAdmin);
    const pick = Object.fromEntries(PRED_SLOTS.map((s) => [s, pred[s] as string | null])) as Record<PredSlot, string | null>;
    const aciertos = countAciertos(pick, ideal, cands, points).length;

    // Reserva atómica: si ya existe, no se entrega nada otra vez.
    const { data: row, error: insErr } = await supabaseAdmin
      .from("prediccion_recompensas")
      .insert({ user_id: uid, jornada_id: data.jornadaId, aciertos })
      .select("id").maybeSingle();
    if (insErr || !row) throw new Error("Recompensa ya recogida");

    const cartas: { id: string; nombre: string; posicion: string; rating: number; rareza: string; club_player_id: string | null; team_id: string | null; estado: string }[] = [];
    for (const rareza of REWARD_BY_ACIERTOS[aciertos] ?? []) {
      const { data: pool } = await supabaseAdmin
        .from("player_pool")
        .select("id,nombre,posicion,rating,rareza,club_player_id,team_id,estado")
        .eq("rareza", rareza);
      if (!pool?.length) continue;
      const c = pool[Math.floor(Math.random() * pool.length)];
      const { error } = await supabaseAdmin.from("user_players").insert({ user_id: uid, player_id: c.id });
      if (error) throw new Error(error.message);
      cartas.push(c);
    }
    await supabaseAdmin.from("prediccion_recompensas").update({ cartas: cartas.map((c) => c.id) }).eq("id", row.id);
    return { aciertos, numero: j.numero, cartas };
  });
