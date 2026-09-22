import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router";
import { GuestRoute } from "@/components/routing/GuestRoute";
import { ProtectedRoute } from "@/components/routing/ProtectedRoute";

// Each page is its own chunk, downloaded when first visited.
const loadSignIn = () => import("@/components/auth/SignInForm");
const loadSignUp = () => import("@/components/auth/SignUpForm");
const loadTracker = () => import("@/components/tracker/TrackerPage");

let warmed = false;

/**
 * Fetches every page in the background, so signing in or switching to sign-up
 * never waits on a download. Imports are cached, so re-running a loader for a
 * page already loaded costs nothing.
 */
function warmOtherPages() {
  if (warmed) return;
  warmed = true;
  const warm = () => {
    loadSignIn();
    loadSignUp();
    loadTracker();
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(warm, { timeout: 3000 });
  } else {
    setTimeout(warm, 1500); // Safari has no requestIdleCallback
  }
}

const SignInForm = lazy(() =>
  loadSignIn().then((m) => ({ default: m.SignInForm })),
);
const SignUpForm = lazy(() =>
  loadSignUp().then((m) => ({ default: m.SignUpForm })),
);
const TrackerPage = lazy(() =>
  loadTracker().then((m) => ({ default: m.TrackerPage })),
);

/**
 * Rendered beside each page, inside the same Suspense boundary, so its effect
 * runs only once that page is actually committed to the screen — never while
 * it is still downloading or waiting on the session. Then it waits for idle.
 * Measured: starting from the lazy loader instead fired a few ms before the
 * login form painted.
 */
function WarmOtherPages() {
  useEffect(warmOtherPages, []);
  return null;
}

/** Same blank canvas the route guards show while the session loads. */
const pageFallback = <div className="min-h-svh bg-background" />;

function App() {
  return (
    <Suspense fallback={pageFallback}>
      <Routes>
        {/* Signed-out only: a signed-in visitor is sent on to the tracker. */}
        <Route element={<GuestRoute />}>
          <Route
            path="/login"
            element={
              <>
                <SignInForm />
                <WarmOtherPages />
              </>
            }
          />
          <Route
            path="/signup"
            element={
              <>
                <SignUpForm />
                <WarmOtherPages />
              </>
            }
          />
        </Route>

        {/* Signed-in only: everyone else is redirected to /login. */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/"
            element={
              <>
                <TrackerPage />
                <WarmOtherPages />
              </>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
