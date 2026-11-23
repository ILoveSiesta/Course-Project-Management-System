import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.js";

// Signed-in user area of the app header: name, role badge and logout.
export const Header: React.FC = () => {
  const { user, logout, logoutError } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!user) return null;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout({ manual: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="app-user">
      {logoutError && <span role="alert" className="alert alert-inline">{logoutError}</span>}
      <span>{user.name}</span>
      <span className="badge">{user.role === "STUDENT" ? "Student" : "Supervisor"}</span>
      <button className="btn btn-secondary" onClick={handleLogout} disabled={isLoggingOut}>
        Log out
      </button>
    </div>
  );
};
