import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

/** Visibilidad de los bloques destacados de Inicio. Super admin: siempre; resto: según permiso (oculto por defecto). */
export function useHomeVisibility() {
  const { user, isSuperAdmin } = useAuth();
  const { data } = useQuery({
    queryKey: ["home-visibility", user?.id],
    enabled: !!user && !isSuperAdmin,
    queryFn: async () =>
      (await supabase
        .from("home_featured_visibility")
        .select("show_player_of_week, show_top_team, show_ideal_seven")
        .eq("user_id", user!.id)
        .maybeSingle()).data,
  });
  if (isSuperAdmin) return { playerOfWeek: true, topTeam: true, idealSeven: true };
  return {
    playerOfWeek: !!data?.show_player_of_week,
    topTeam: !!data?.show_top_team,
    idealSeven: !!data?.show_ideal_seven,
  };
}
