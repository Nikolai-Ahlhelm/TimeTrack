import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import Setup from "./pages/Setup";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";

function Gate({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, loading, setupComplete } = useAuth();

  if (loading) return <FullScreenLoading />;
  if (setupComplete === false) return <Navigate to="/setup" replace />;
  if (!user) return <Navigate to="/login" replace />;
  if (requireAdmin && user.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function FullScreenLoading() {
  return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">Loading...</div>;
}

function SetupRoute() {
  const { setupComplete, loading } = useAuth();
  if (loading) return <FullScreenLoading />;
  if (setupComplete === true) return <Navigate to="/login" replace />;
  return <Setup />;
}

function LoginRoute() {
  const { user, setupComplete, loading } = useAuth();
  if (loading) return <FullScreenLoading />;
  if (setupComplete === false) return <Navigate to="/setup" replace />;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/setup" element={<SetupRoute />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/"
          element={
            <Gate>
              <Dashboard />
            </Gate>
          }
        />
        <Route
          path="/admin"
          element={
            <Gate requireAdmin>
              <Admin />
            </Gate>
          }
        />
        <Route
          path="/settings"
          element={
            <Gate>
              <Settings />
            </Gate>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
