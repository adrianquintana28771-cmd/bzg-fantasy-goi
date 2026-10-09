import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Si el valor es negativo o nulo, devuelve 0; si es positivo, mantiene hasta 2 decimales con coma
export const displayPts = (pts: number | null | undefined): string => {
  const visual = Math.max(0, Number(pts) || 0);
  return String(Math.round(visual * 100) / 100).replace(".", ",");
};
