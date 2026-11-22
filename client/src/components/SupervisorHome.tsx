import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { ApiError, Team, createTeamApi, getTeamsApi } from "../api.js";

function teamNameErrorText(code: string): string {
  if (code === "REQUIRED") return "Required";
  if (code === "TOO_LONG") return "Too long (max 80 characters)";
  if (code === "INVALID_TYPE") return "Invalid value";
  return code;
}

export const SupervisorHome: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [teamName, setTeamName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setNameError(null);
    setCreateError(null);
    setCreateStatus(null);
    setIsCreating(true);

    try {
      const created = await createTeamApi(token, teamName);
      setTeams((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setTeamName("");
      setCreateStatus(`Created "${created.name}".`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return logout();
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR" && err.details.name) {
        setNameError(teamNameErrorText(err.details.name));
      } else {
        setCreateError(err instanceof Error ? err.message : "Could not create the team");
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div>
      <h2 className="page-title">Supervisor Dashboard</h2>
      <p className="page-subtitle">Welcome, {user?.name}!</p>

      <section className="card">
        <h3>New team</h3>
        {createError && <p role="alert" className="alert">{createError}</p>}
        {createStatus && <p role="status" className="status-notice">{createStatus}</p>}
        <form onSubmit={handleCreateTeam} className="inline-form" noValidate>
          <div className={`form-field${nameError ? " has-error" : ""}`}>
            <label htmlFor="team-name">Team name</label>
            <input id="team-name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            {nameError && <div className="field-error">{nameError}</div>}
          </div>
          <button type="submit" className="btn" disabled={isCreating}>
            {isCreating ? "Saving…" : "Create team"}
          </button>
        </form>
      </section>

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
