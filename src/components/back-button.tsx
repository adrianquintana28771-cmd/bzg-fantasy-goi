import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function BackButton({ fallback = "/", label = "Volver" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.history.back();
        } else {
          router.navigate({ to: fallback });
        }
      }}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> {label}
    </button>
  );
}
