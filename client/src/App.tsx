import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getHealth } from "./api.js";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { Login } from "./components/Login.js";
import { Header } from "./components/Header.js";
import { StudentHome } from "./components/StudentHome.js";
import { SupervisorHome } from "./components/SupervisorHome.js";
import { SupervisorTeam } from "./components/SupervisorTeam.js";
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
    <main>
      <Header />
      <div style={{ padding: "10px 20px" }}>
        <h1>Course Project Management System</h1>
        <p data-testid="api-status">API: {status}</p>
      </div>

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
