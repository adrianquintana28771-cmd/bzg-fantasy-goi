import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function canSeeNegativePoints(roles: readonly string[]): boolean {
  return roles.includes("admin") || roles.includes("super_admin");
}

// Only the visual representation changes; calculations always retain the original value.
export const displayPts = (pts: number | null | undefined, showNegative = false): string => {
  const value = Number(pts) || 0;
  const visual = showNegative ? value : Math.max(0, value);
  return String(Math.round(visual * 100) / 100).replace(".", ",");
};
