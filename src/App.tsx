import { Navigate, Route, Routes } from "react-router";
import { SignInForm } from "@/components/auth/SignInForm";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { GuestRoute } from "@/components/routing/GuestRoute";
import { ProtectedRoute } from "@/components/routing/ProtectedRoute";
import { TrackerPage } from "@/components/tracker/TrackerPage";

function App() {
  return (
    <Routes>
      {/* Signed-out only: a signed-in visitor is sent on to the tracker. */}
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<SignInForm />} />
        <Route path="/signup" element={<SignUpForm />} />
      </Route>

      {/* Signed-in only: everyone else is redirected to /login. */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<TrackerPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
