import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  displayName: string | null;
  refreshRole: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadRole(userId: string | undefined) {
    if (!userId) {
      setIsAdmin(false);
      setDisplayName(null);
      return;
    }
    const client = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, val: string) => Promise<{ data: Array<Record<string, unknown>> | null }> & {
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
          };
        };
      };
    };
    const [rolesRes, profileRes] = await Promise.all([
      client.from("user_roles").select("role").eq("user_id", userId) as unknown as Promise<{ data: Array<{ role: string }> | null }>,
      (client.from("profiles").select("display_name, dni").eq("id", userId) as unknown as { maybeSingle: () => Promise<{ data: { display_name: string | null; dni: string } | null }> }).maybeSingle(),
    ]);
    setIsAdmin((rolesRes.data ?? []).some((r) => r.role === "admin"));
    setDisplayName(profileRes.data?.display_name ?? profileRes.data?.dni ?? null);
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT") {
        setIsAdmin(false);
        setDisplayName(null);
      } else if (s?.user) {
        // Defer to avoid deadlocks
        setTimeout(() => loadRole(s.user.id), 0);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadRole(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    loading,
    session,
    user: session?.user ?? null,
    isAdmin,
    displayName,
    refreshRole: async () => loadRole(session?.user.id),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
