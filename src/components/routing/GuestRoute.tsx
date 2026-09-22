import type { Location } from "react-router";
import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/lib/auth";

/**
 * The inverse of ProtectedRoute, for /login and /signup: a signed-in user is
 * sent on — back to the page that bounced them, or home.
 *
 * This is also what completes sign-in and sign-up: once the auth listener
 * reports a session, this re-renders and redirects. The forms never navigate
 * by hand.
 */
function GuestRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="min-h-svh bg-background" />;

  if (session) {
    const from = (location.state as { from?: Location } | null)?.from;
    return <Navigate to={from?.pathname ?? "/"} replace />;
  }

  return <Outlet />;
}

export { GuestRoute };
