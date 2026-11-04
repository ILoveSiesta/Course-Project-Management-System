import { useEffect, useState } from "react";
import { getHealth } from "./api.js";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { Login } from "./components/Login.js";
import { Header } from "./components/Header.js";
import { StudentHome } from "./components/StudentHome.js";
import { SupervisorHome } from "./components/SupervisorHome.js";

function AppContent() {
  const [status, setStatus] = useState<string>("checking...");
  const { user, isLoading } = useAuth();

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

      {!isLoading && !user && <Login />}
      {!isLoading && user?.role === "STUDENT" && <StudentHome />}
      {!isLoading && user?.role === "SUPERVISOR" && <SupervisorHome />}
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
