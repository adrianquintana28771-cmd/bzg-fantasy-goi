import { useAuth } from "@/lib/auth-context";
import { canSeeNegativePoints, displayPts } from "@/lib/utils";

/** Role-aware score formatting, without changing the score or its sort order. */
export function useDisplayPoints() {
  const { roles } = useAuth();
  const showNegative = canSeeNegativePoints(roles);
  return (pts: number | null | undefined) => displayPts(pts, showNegative);
}