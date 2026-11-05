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
    <div>
      <h2 className="page-title">Supervisor Dashboard</h2>
      <p className="page-subtitle">Welcome, {user?.name}!</p>
      <h3>My teams</h3>
      {isLoading && <p className="loading">Loading…</p>}
      {error && <p role="alert" className="alert">{error}</p>}
      {!isLoading && !error && teams.length === 0 && (
        <p className="empty-state">You are not assigned to any team yet.</p>
      )}
      <div className="card-grid">
        {teams.map((team) => (
          <section key={team.id} className="card">
            <h4>{team.name}</h4>
            <p className="muted">Members: {team.members.map((m) => m.name).join(", ") || "None"}</p>
            <Link className="btn" to={`/supervisor/teams/${team.id}`}>
              Open team
            </Link>
          </section>
        ))}
      </div>
    </div>
  );
};
