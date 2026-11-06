import React from "react";
import { Link } from "react-router-dom";
import { Milestone, Team } from "../api.js";
import { formatDeadline } from "../format.js";

export const TeamSummary: React.FC<{ team: Team }> = ({ team }) => (
  <section className="card">
    <h3>{team.name}</h3>
    <p className="muted">Supervisors: {team.supervisors.map((s) => s.name).join(", ") || "None"}</p>
    <div className="section-label">Members</div>
    <ul className="plain-list people-list">
      {team.members.map((m) => (
        <li key={m.id}>{`${m.name} (${m.email})`}</li>
      ))}
    </ul>
  </section>
);

export const MilestoneList: React.FC<{ milestones: Milestone[]; linkPrefix?: string }> = ({
  milestones,
  linkPrefix,
}) => {
  if (milestones.length === 0) return <p className="empty-state">No milestones yet.</p>;

  return (
    <ul aria-label="Milestones" className="plain-list milestone-list">
      {milestones.map((m) => (
        <li key={m.id}>
          <div className="milestone-title">
            {linkPrefix ? <Link to={`${linkPrefix}/${m.id}`}>{m.title}</Link> : m.title}
          </div>
          <div className="milestone-meta">
            Due: <span>{formatDeadline(m.deadline)}</span>
          </div>
          {m.description && <p className="milestone-description">{m.description}</p>}
        </li>
      ))}
    </ul>
  );
};
