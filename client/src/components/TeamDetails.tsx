import React from "react";
import { Link } from "react-router-dom";
import { Milestone, MilestoneStatus, Person, Team } from "../api.js";
import { formatDeadline } from "../format.js";

const STATUS_BADGE_CLASS: Record<MilestoneStatus, string> = {
  "Not submitted": "badge badge-neutral",
  Overdue: "badge badge-danger",
  Submitted: "badge",
  "Submitted late": "badge badge-warning",
  Reviewed: "badge badge-success",
};

interface TeamSummaryProps {
  team: Team;
  onRemoveMember?: (member: Person) => void;
  removingMemberId?: number | null;
  children?: React.ReactNode;
}

export const TeamSummary: React.FC<TeamSummaryProps> = ({
  team,
  onRemoveMember,
  removingMemberId = null,
  children,
}) => (
  <section className="card">
    <h3>{team.name}</h3>
    <p className="muted">Supervisors: {team.supervisors.map((s) => s.name).join(", ") || "None"}</p>
    <div className="section-label">Members</div>
    {team.members.length === 0 ? (
      <p className="empty-state">No members yet.</p>
    ) : (
      <ul className="plain-list people-list">
        {team.members.map((m) => (
          <li key={m.id} className={onRemoveMember ? "member-row" : undefined}>
            <span className="member-info">{`${m.name} (${m.email})`}</span>
            {onRemoveMember && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                aria-label={`Remove ${m.name}`}
                disabled={removingMemberId === m.id}
                onClick={() => onRemoveMember(m)}
              >
                {removingMemberId === m.id ? "Removing…" : "Remove"}
              </button>
            )}
          </li>
        ))}
      </ul>
    )}
    {children}
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
