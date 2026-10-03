import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { Session, User } from "@supabase/supabase-js";

import { recordSessionContext } from "@/features/journal/journal.functions";
import { recordLocationHints } from "@/features/location/location.functions";
import { browserHints } from "@/features/profiles/location";
import { supabase } from "@/integrations/supabase/client";

/**
 * Journal de l'administration : appareil, IP, pays et fuseau de la connexion, envoyés une
 * fois par session (sans effet sur la connexion si l'envoi échoue).
 */
function recordSessionOnce(session: Session | null) {
  if (!session || typeof window === "undefined") return;
  const key = `yona.session-context.${session.user.id}.${session.user.last_sign_in_at ?? ""}`;
  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Stockage indisponible : envoi quand même (la base ignore les doublons).
  }
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  void recordSessionContext({ data: { timezone } }).catch(() => {});
  // Localisation (tâche E) : pays de l'IP et fuseau comparés à la position retenue.
  void recordLocationHints({ data: browserHints() }).catch(() => {});
}

interface AuthState {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  isAuthenticated: false,
  loading: true,
});

/**
 * Unique abonnement aux changements de session pour toute l'application.
 * Expose l'état de session et rafraîchit le routeur / le cache sur les transitions d'identité.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setLoading(false);
      if (event === "SIGNED_IN") recordSessionOnce(next);
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, isAuthenticated: !!session, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
