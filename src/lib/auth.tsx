import type { Session, User } from "@supabase/supabase-js";
import { createContext, use, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { clearSnapshot } from "@/lib/tasks/snapshot";

type AuthState = {
  session: Session | null;
  user: User | null;
  /** True until the initial session lookup resolves. */
  loading: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * Who is signed in, readable from the auth callback. `SIGNED_OUT` arrives
   * with a null session and so cannot say whose data is being left behind.
   */
  const signedIn = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      signedIn.current = data.session?.user.id ?? null;
      setSession(data.session);
      setLoading(false);
    });

    // Fires for sign in, sign out, token refresh and the OAuth redirect
    // landing back on the page, so the UI never goes stale.
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (event === "SIGNED_OUT" && signedIn.current) {
          // The offline copy of this account's tasks goes with the session.
          // Handled here rather than on the Sign out button so it also covers
          // an expired token and a sign-out in another tab. The outbox is
          // deliberately left alone: a snapshot is a copy of what the server
          // already has, but unsent writes are work still owed to it.
          clearSnapshot(signedIn.current);
        }
        signedIn.current = nextSession?.user.id ?? null;
        setSession(nextSession);
        setLoading(false);
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const context = use(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return context;
}
