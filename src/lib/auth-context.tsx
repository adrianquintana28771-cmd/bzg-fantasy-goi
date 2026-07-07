import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "user" | "admin" | "manager" | "super_admin";

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  isSuperAdmin: boolean;
  isManager: boolean;
  isAdmin: boolean;
  /** Has any staff role (admin | manager | super_admin) */
  isStaff: boolean;
  /** Can edit player performance / stats in matches */
  canEditStats: boolean;
  /** Can edit match info (create/edit/delete partidos) */
  canEditMatches: boolean;
  /** Can add / remove jugadores */
  canManagePlayers: boolean;
  /** Can do everything (super_admin) */
  canManageAll: boolean;
  displayName: string | null;
  refreshRole: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadRole(userId: string | undefined) {
    if (!userId) {
      setRoles([]);
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
      client.from("user_roles").select("role").eq("user_id", userId) as unknown as Promise<{ data: Array<{ role: AppRole }> | null }>,
      (client.from("profiles").select("display_name, dni").eq("id", userId) as unknown as { maybeSingle: () => Promise<{ data: { display_name: string | null; dni: string } | null }> }).maybeSingle(),
    ]);
    setRoles((rolesRes.data ?? []).map((r) => r.role));
    setDisplayName(profileRes.data?.display_name ?? profileRes.data?.dni ?? null);
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT") {
        setRoles([]);
        setDisplayName(null);
      } else if (s?.user) {
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

  const value: AuthState = useMemo(() => {
    const isSuperAdmin = roles.includes("super_admin");
    const isManager = roles.includes("manager");
    const isAdmin = roles.includes("admin");
    const isStaff = isSuperAdmin || isManager || isAdmin;
    return {
      loading,
      session,
      user: session?.user ?? null,
      roles,
      isSuperAdmin,
      isManager,
      isAdmin,
      isStaff,
      canEditStats: isSuperAdmin || isAdmin,
      canEditMatches: isSuperAdmin || isManager,
      canManagePlayers: isSuperAdmin || isManager,
      canManageAll: isSuperAdmin,
      displayName,
      refreshRole: async () => loadRole(session?.user.id),
      signOut: async () => {
        await supabase.auth.signOut();
      },
    };
  }, [loading, session, roles, displayName]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
