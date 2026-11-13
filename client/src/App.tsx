import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getHealth } from "./api.js";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { Login } from "./components/Login.js";
import { Header } from "./components/Header.js";
import { StudentHome } from "./components/StudentHome.js";
import { SupervisorHome } from "./components/SupervisorHome.js";
import { SupervisorTeam } from "./components/SupervisorTeam.js";
import { StudentMilestone } from "./components/StudentMilestone.js";
import { SupervisorMilestone } from "./components/SupervisorMilestone.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";

export function AppRoutes() {
  const [status, setStatus] = useState<string>("checking...");
  const { user } = useAuth();

  useEffect(() => {
    getHealth()
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("unreachable"));
  }, []);

  return (
    <>
      <header className="app-header">
        <h1 className="app-brand">Course Project Management System</h1>
        <Header />
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRole="STUDENT">
                <StudentHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/milestones/:milestoneId"
            element={
              <ProtectedRoute allowedRole="STUDENT">
                <StudentMilestone />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor"
            element={
              <ProtectedRoute allowedRole="SUPERVISOR">
                <SupervisorHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor/teams/:teamId"
            element={
              <ProtectedRoute allowedRole="SUPERVISOR">
                <SupervisorTeam />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor/milestones/:milestoneId"
            element={
              <ProtectedRoute allowedRole="SUPERVISOR">
                <SupervisorMilestone />
              </ProtectedRoute>
            }
          />
          <Route
            path="*"
            element={
              <Navigate
                to={user ? (user.role === "STUDENT" ? "/student" : "/supervisor") : "/login"}
                replace
              />
            }
          />
        </Routes>
      </main>

      <footer className="app-footer">
        <span data-testid="api-status">API: {status}</span>
        <span className="app-footer-release" data-testid="release-version">
          CPMS v0.1.1
        </span>
      </footer>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
