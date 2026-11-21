import React from "react";
import { Link } from "react-router-dom";
import { Milestone, MilestoneStatus, Team } from "../api.js";
import { formatDeadline } from "../format.js";

const STATUS_BADGE_CLASS: Record<MilestoneStatus, string> = {
  "Not submitted": "badge badge-neutral",
  Overdue: "badge badge-danger",
  Submitted: "badge",
  "Submitted late": "badge badge-warning",
  Reviewed: "badge badge-success",
};

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
          <div className="milestone-header">
            <div className="milestone-title">
              {linkPrefix ? <Link to={`${linkPrefix}/${m.id}`}>{m.title}</Link> : m.title}
            </div>
            {m.status && <span className={STATUS_BADGE_CLASS[m.status]}>{m.status}</span>}
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
