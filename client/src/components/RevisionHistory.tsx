import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { ApiError, HistoryOrder, MilestoneRevisionHistory, getMilestoneHistoryApi } from "../api.js";
import { formatDeadline } from "../format.js";

interface RevisionHistoryProps {
  role: "STUDENT" | "SUPERVISOR";
}

// Dedicated read-only milestone revision history (F-07, FR-15).
// Keyed by milestoneId so Back/Forward navigation clears previous milestone history while loading (#102).
export const RevisionHistory: React.FC<RevisionHistoryProps> = ({ role }) => {
  const milestoneId = Number(useParams().milestoneId);
  return <RevisionHistoryContent key={milestoneId} role={role} milestoneId={milestoneId} />;
};

const RevisionHistoryContent: React.FC<RevisionHistoryProps & { milestoneId: number }> = ({
  role,
  milestoneId,
}) => {
  const { token, logout } = useAuth();

  const [order, setOrder] = useState<HistoryOrder>("desc");
  const [history, setHistory] = useState<MilestoneRevisionHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setIsLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const data = await getMilestoneHistoryApi(token, milestoneId, order);
        if (!active) return;
        setHistory(data);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return logout();
        if (!active) return;
        setHistory(null);
        setLoadError(
          err instanceof ApiError && (err.status === 404 || err.status === 403)
            ? "Milestone not found or not allowed"
            : "Could not load revision history"
        );
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token, milestoneId, order]);

  const milestoneLink = role === "STUDENT" ? `/student/milestones/${milestoneId}` : `/supervisor/milestones/${milestoneId}`;

  return (
    <div>
      <p>
        <Link to={milestoneLink}>← Back to milestone</Link>
      </p>
      {isLoading && <p className="loading">Loading…</p>}
      {loadError && <p role="alert" className="alert">{loadError}</p>}

      {history && (
        <>
          <section className="card">
            <h2>{`${history.milestone.title} — Revision history`}</h2>
            <div className="milestone-meta">
              {history.milestone.teamName} · Due: <span>{formatDeadline(history.milestone.deadline)}</span>
            </div>
            <p className="muted">{`Total versions: ${history.totalVersions} / 3`}</p>
            {history.milestone.description && <p className="milestone-description">{history.milestone.description}</p>}
          </section>

          <section className="card">
            <div className="submission-header">
              <h3>Revisions</h3>
              <div className="history-toolbar">
                <button
                  type="button"
                  className={order === "desc" ? "btn" : "btn btn-secondary"}
                  aria-pressed={order === "desc"}
                  onClick={() => setOrder("desc")}
                >
                  Newest first
                </button>
                <button
                  type="button"
                  className={order === "asc" ? "btn" : "btn btn-secondary"}
                  aria-pressed={order === "asc"}
                  onClick={() => setOrder("asc")}
                >
                  Oldest first
                </button>
              </div>
            </div>

            {history.revisions.length === 0 ? (
              <p className="empty-state">No submissions in revision history yet.</p>
            ) : (
              <ul className="plain-list" aria-label="Revision history">
                {history.revisions.map((r) => (
                  <li key={r.id} className="card submission-item">
                    <div className="submission-header">
                      <h4>{`Version ${r.version}: ${r.title}`}</h4>
                      <div className="history-badges">
                        {r.isLatest && <span className="badge badge-primary">Latest</span>}
                        {r.isLate ? (
                          <span className="badge badge-warning">{`Late (+${r.daysLate} d)`}</span>
                        ) : (
                          <span className="badge badge-success">On time</span>
                        )}
                      </div>
                    </div>
                    <p className="muted">
                      {`Submitted by: ${r.submittedBy.name} at ${formatDeadline(r.submittedAt)}`}
                    </p>
                    {r.description && <p>{r.description}</p>}
                    <p>
                      Link:{" "}
                      <a href={r.link} target="_blank" rel="noreferrer">
                        {r.link}
                      </a>
                    </p>
                    <div className="feedback-section">
                      <div className="section-label">{`Feedback (${r.feedbackCount})`}</div>
                      {r.feedback.length === 0 ? (
                        <p className="empty-state">No feedback on this version.</p>
                      ) : (
                        <ul className="plain-list feedback-list">
                          {r.feedback.map((f) => (
                            <li key={f.id} className="feedback-item">
                              <p className="feedback-comment">{f.comment}</p>
                              <p className="feedback-meta">{`by ${f.author.name} on ${formatDeadline(f.createdAt)}`}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};
