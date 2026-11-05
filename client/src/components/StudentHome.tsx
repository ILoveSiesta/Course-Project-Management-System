import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.js";
import { ApiError, Milestone, Team, getTeamMilestonesApi, getTeamsApi } from "../api.js";
import { MilestoneList, TeamSummary } from "./TeamDetails.js";

export const StudentHome: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;

    (async () => {
      try {
        const [ownTeam] = await getTeamsApi(token);
        const list = ownTeam ? await getTeamMilestonesApi(token, ownTeam.id) : [];
        if (!active) return;
        setTeam(ownTeam ?? null);
        setMilestones(list);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return logout();
        if (active) setError(err instanceof Error ? err.message : "Could not load your team");
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token]); // logout is recreated each render; it is only called on 401

  return (
    <div>
      <h2 className="page-title">Student Dashboard</h2>
      <p className="page-subtitle">Welcome, {user?.name}!</p>
      {isLoading && <p className="loading">Loading…</p>}
      {error && <p role="alert" className="alert">{error}</p>}
      {!isLoading && !error && !team && <p className="empty-state">You are not assigned to a team yet.</p>}
      {team && (
        <>
          <TeamSummary team={team} />
          <section className="card">
            <h3>Milestones</h3>
            <MilestoneList milestones={milestones} />
          </section>
        </>
      )}
    </div>
  );
};
