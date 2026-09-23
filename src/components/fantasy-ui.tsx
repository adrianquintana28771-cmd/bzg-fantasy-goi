import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABEL,
  CATEGORY_LABEL_EU,
  POSITION_LABEL,
  POSITION_LABEL_EU,
} from "@/lib/fantasy/types";
import type { PlayerAggregate } from "@/lib/fantasy/queries";
import { useLang } from "@/lib/i18n";

export function CategoryBadge({ category }: { category: keyof typeof CATEGORY_LABEL }) {
  const { lang } = useLang();
  const label = lang === "eu" ? CATEGORY_LABEL_EU : CATEGORY_LABEL;
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
      {label[category]}
    </span>
  );
}
