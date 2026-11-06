import React from "react";
import { Submission } from "../api.js";
import { formatDeadline } from "../format.js";

interface SubmissionListProps {
  submissions: Submission[];
}

export const SubmissionList: React.FC<SubmissionListProps> = ({ submissions }) => {
  return (
    <section className="card">
      <h3>Submissions</h3>
      {submissions.length === 0 ? (
        <p className="empty-state">No submissions yet.</p>
      ) : (
        <ul className="plain-list">
          {submissions.map((s) => (
            <li key={s.id} className="card submission-item">
              <div className="submission-header">
                <h4>
                  Version {s.version}: {s.title}
                </h4>
                {s.daysLate === 0 ? (
                  <span className="badge badge-success">On time</span>
                ) : (
                  <span className="badge badge-warning">Late (+{s.daysLate} d)</span>
                )}
              </div>
              <p className="muted">
                Submitted by: {s.submittedBy.name} at {formatDeadline(s.submittedAt)}
              </p>
              {s.description && <p>{s.description}</p>}
              <p>
                Link:{" "}
                <a href={s.link} target="_blank" rel="noreferrer">
                  {s.link}
                </a>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
