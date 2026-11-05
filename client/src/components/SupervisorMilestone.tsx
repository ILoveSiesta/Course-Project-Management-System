import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { ApiError, Milestone, Submission, getMilestoneApi, getMilestoneSubmissionsApi } from "../api.js";
import { formatDeadline } from "../format.js";

export const SupervisorMilestone: React.FC = () => {
  const { token, logout } = useAuth();
  const milestoneId = Number(useParams().milestoneId);

  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;

    (async () => {
      try {
        const [m, subs] = await Promise.all([
          getMilestoneApi(token, milestoneId),
          getMilestoneSubmissionsApi(token, milestoneId),
        ]);
        if (!active) return;
        setMilestone(m);
        setSubmissions(subs);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return logout();
        if (!active) return;
        setLoadError(
          err instanceof ApiError && (err.status === 404 || err.status === 403)
            ? "Milestone not found or not allowed"
            : "Could not load the milestone"
        );
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token, milestoneId]);

  return (
    <div>
      <p>
        <Link to={milestone ? `/supervisor/teams/${milestone.teamId}` : "/supervisor"}>← Back to team</Link>
      </p>
      {isLoading && <p className="loading">Loading…</p>}
      {loadError && <p role="alert" className="alert">{loadError}</p>}

      {milestone && (
        <>
          <section className="card">
            <h2>{milestone.title}</h2>
            <div className="milestone-meta">
              Due: <span>{formatDeadline(milestone.deadline)}</span>
            </div>
            {milestone.description && <p className="milestone-description">{milestone.description}</p>}
          </section>

          <section className="card">
            <h3>Submissions</h3>
            {submissions.length === 0 ? (
              <p className="empty-state">No submissions yet.</p>
            ) : (
              <ul className="plain-list">
                {submissions.map((s) => (
                  <li key={s.id} className="card" style={{ marginBottom: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
        </>
      )}
    </div>
  );
};
