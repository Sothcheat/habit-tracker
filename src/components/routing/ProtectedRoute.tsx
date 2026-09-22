import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/lib/auth";

/**
 * Guards every route nested under it. No session → redirect to /login,
 * remembering where the user was headed so sign-in can send them back.
 *
 * This is a UX guard, not a security boundary: the data behind these routes
 * is protected by row-level security in the database, so bypassing this
 * component in devtools reveals an empty page, not anyone's habits.
 */
function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  // Wait for the stored session to be read, or a signed-in user would be
  // bounced to /login for a frame on every refresh.
  if (loading) return <div className="min-h-svh bg-background" />;

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export { ProtectedRoute };
