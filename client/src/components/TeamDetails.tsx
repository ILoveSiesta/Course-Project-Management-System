import React from "react";
import { Milestone, Team } from "../api.js";
import { formatDeadline } from "../format.js";

export const TeamSummary: React.FC<{ team: Team }> = ({ team }) => (
  <section style={{ marginTop: "20px", padding: "15px", border: "1px solid #e0e0e0", borderRadius: "6px" }}>
    <h3>{team.name}</h3>
    <p>Supervisors: {team.supervisors.map((s) => s.name).join(", ") || "None"}</p>
    <h4>Members</h4>
    <ul>
      {team.members.map((m) => (
        <li key={m.id}>{`${m.name} (${m.email})`}</li>
      ))}
    </ul>
  </section>
);

export const MilestoneList: React.FC<{ milestones: Milestone[] }> = ({ milestones }) => {
  if (milestones.length === 0) return <p>No milestones yet.</p>;

  return (
    <ul aria-label="Milestones" style={{ listStyle: "none", padding: 0 }}>
      {milestones.map((m) => (
        <li key={m.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee" }}>
          <strong>{m.title}</strong>
          <div>
            Due: <span>{formatDeadline(m.deadline)}</span>
          </div>
          {m.description && <p style={{ margin: "5px 0 0" }}>{m.description}</p>}
        </li>
      ))}
    </ul>
  );
};
