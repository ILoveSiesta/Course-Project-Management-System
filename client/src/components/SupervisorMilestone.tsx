import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import {
  ApiError,
  Milestone,
  MilestoneUpdate,
  Submission,
  createFeedbackApi,
  getMilestoneApi,
  getMilestoneSubmissionsApi,
  updateMilestoneApi,
} from "../api.js";
import { formatDeadline } from "../format.js";
import { SubmissionList } from "./SubmissionList.js";
import { MilestoneEditForm } from "./MilestoneEditForm.js";

export const SupervisorMilestone: React.FC = () => {
  const { token, logout } = useAuth();
  const milestoneId = Number(useParams().milestoneId);

  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

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

  // Saves feedback and shows it under its version; validation errors are rethrown for the form.
  const addFeedback = async (submissionId: number, comment: string) => {
    if (!token) return;
    try {
      const created = await createFeedbackApi(token, submissionId, comment);
      setSubmissions((list) =>
        list.map((s) => (s.id === submissionId ? { ...s, feedback: [...(s.feedback ?? []), created] } : s))
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return logout();
      throw err;
    }
  };

  // F-05: saves the edit; errors are rethrown so the form can show them (401 logs out).
  const saveMilestone = async (update: MilestoneUpdate) => {
    if (!token) return undefined;
    try {
      const saved = await updateMilestoneApi(token, milestoneId, update);
      setMilestone(saved);
      setIsEditing(false);
      return saved;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return undefined;
      }
      throw err;
    }
  };

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
            {isEditing ? (
              <MilestoneEditForm milestone={milestone} onSave={saveMilestone} onCancel={() => setIsEditing(false)} />
            ) : (
              <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(true)}>
                Edit milestone
              </button>
            )}
          </section>

          <SubmissionList submissions={submissions} onAddFeedback={addFeedback} />
        </>
      )}
    </div>
  );
};
