import React from "react";
import { useAuth } from "../context/AuthContext.js";

// Signed-in user area of the app header: name, role badge and logout.
export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="app-user">
      <span>{user.name}</span>
      <span className="badge">{user.role === "STUDENT" ? "Student" : "Supervisor"}</span>
      <button className="btn btn-secondary" onClick={logout}>
        Log out
      </button>
    </div>
  );
};
