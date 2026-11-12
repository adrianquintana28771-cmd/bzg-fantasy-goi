import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "player-card-images";

/** Signed-in callers get short-lived download links; direct bucket reads are staff-only. */
export const signCardImagePaths = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { folders: string[] }) => {
    const folders = Array.isArray(input?.folders) ? input.folders : [];
    if (folders.length > 2000 || folders.some((f) => typeof f !== "string" || !/^([0-9a-f-]{36}|templates)$/i.test(f))) throw new Error("Invalid input");
    return { folders: [...new Set(folders)] };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bucket = supabaseAdmin.storage.from(BUCKET);
    const lists = await Promise.all(data.folders.map(async (folder) => {
      const { data: files } = await bucket.list(folder, { limit: 100 });
      return (files ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`);
    }));
    const paths = lists.flat();
    if (!paths.length) return { files: [] as string[], signed: {} as Record<string, string> };
    const { data: signed } = await bucket.createSignedUrls(paths, 60 * 60 * 6);
    const out: Record<string, string> = {};
    for (const s of signed ?? []) if (s.signedUrl && !s.error && s.path) out[s.path] = s.signedUrl;
    return { files: paths, signed: out };
  });
