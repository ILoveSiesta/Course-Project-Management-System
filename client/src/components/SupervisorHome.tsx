import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { ApiError, Team, getTeamsApi } from "../api.js";

export const SupervisorHome: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;

    getTeamsApi(token)
      .then((list) => active && setTeams(list))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) return logout();
        if (active) setError(err instanceof Error ? err.message : "Could not load your teams");
      })
      .finally(() => active && setIsLoading(false));

    return () => {
      active = false;
    };
  }, [token]); // logout is recreated each render; it is only called on 401

  return (
    <div style={{ padding: "20px" }}>
      <h2>Supervisor Dashboard</h2>
      <p>Welcome, {user?.name}!</p>
      <h3>My teams</h3>
      {isLoading && <p>Loading…</p>}
      {error && <p role="alert">{error}</p>}
      {!isLoading && !error && teams.length === 0 && <p>You are not assigned to any team yet.</p>}
      {teams.map((team) => (
        <section key={team.id} style={{ marginTop: "15px", padding: "15px", border: "1px solid #e0e0e0", borderRadius: "6px" }}>
          <h4 style={{ marginTop: 0 }}>{team.name}</h4>
          <p>Members: {team.members.map((m) => m.name).join(", ") || "None"}</p>
          <Link to={`/supervisor/teams/${team.id}`}>Open team</Link>
        </section>
      ))}
    </div>
  );
};
