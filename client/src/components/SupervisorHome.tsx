import React from "react";
import { useAuth } from "../context/AuthContext.js";

export const SupervisorHome: React.FC = () => {
  const { user } = useAuth();

  return (
    <div style={{ padding: "20px" }}>
      <h2>Supervisor Dashboard</h2>
      <p>Welcome, {user?.name}! You can manage your assigned teams and milestones.</p>
      <div style={{ marginTop: "20px", padding: "15px", border: "1px solid #e0e0e0", borderRadius: "6px" }}>
        <h3>Assigned Teams</h3>
        <p>Your supervised teams and milestone management will appear here (F-02 & F-04).</p>
      </div>
    </div>
  );
};
