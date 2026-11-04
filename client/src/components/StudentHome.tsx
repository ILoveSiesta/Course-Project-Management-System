import React from "react";
import { useAuth } from "../context/AuthContext.js";

export const StudentHome: React.FC = () => {
  const { user } = useAuth();

  return (
    <div style={{ padding: "20px" }}>
      <h2>Student Dashboard</h2>
      <p>Welcome, {user?.name}! You are registered in your team workspace.</p>
      <div style={{ marginTop: "20px", padding: "15px", border: "1px solid #e0e0e0", borderRadius: "6px" }}>
        <h3>My Team & Milestones</h3>
        <p>Milestone submissions and feedback will appear here (F-02 & F-03).</p>
      </div>
    </div>
  );
};
