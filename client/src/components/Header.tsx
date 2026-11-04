import React from "react";
import { useAuth } from "../context/AuthContext.js";

export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid #ddd", background: "#f8f9fa" }}>
      <div>
        <strong>Course Project Management System</strong>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
        <span>
          {user.name} (<strong>{user.role}</strong>)
        </span>
        <button
          onClick={logout}
          style={{ padding: "6px 12px", background: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Log out
        </button>
      </div>
    </header>
  );
};
