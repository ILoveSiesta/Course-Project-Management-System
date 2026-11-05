import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import {
  ApiError,
  Milestone,
  Submission,
  createSubmissionApi,
  getMilestoneApi,
  getMilestoneSubmissionsApi,
} from "../api.js";
import { formatDeadline } from "../format.js";

const FIELD_MESSAGES: Record<string, string> = {
  REQUIRED: "Required",
  INVALID_URL: "Link must be an http or https URL",
  INVALID_TYPE: "Invalid value",
};
const MAX_LENGTH: Record<string, number> = { title: 120, description: 2000, link: 2048 };

function fieldMessage(field: string, code: string): string {
  if (code === "TOO_LONG") return `Too long (max ${MAX_LENGTH[field]} characters)`;
  return FIELD_MESSAGES[code] ?? code;
}

export const StudentMilestone: React.FC = () => {
  const { token, logout } = useAuth();
  const milestoneId = Number(useParams().milestoneId);

  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFieldErrors({});
    setFormError(null);
    setIsSaving(true);

    try {
      const created = await createSubmissionApi(token, milestoneId, {
        title,
        description,
        link,
      });
      setSubmissions((list) => [...list, created]);
      setTitle("");
      setDescription("");
      setLink("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return logout();
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") {
        setFieldErrors(err.details);
      } else if (err instanceof ApiError && err.code === "VERSION_LIMIT_REACHED") {
        setFormError(err.message);
      } else {
        setFormError(err instanceof Error ? err.message : "Could not submit work");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const errorFor = (field: string) =>
    fieldErrors[field] && <div className="field-error">{fieldMessage(field, fieldErrors[field])}</div>;

  const fieldClass = (field: string) => `form-field${fieldErrors[field] ? " has-error" : ""}`;

  return (
    <div>
      <p>
        <Link to="/student">← My team</Link>
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

          <section className="card">
            <h3>{submissions.length > 0 ? "Resubmit work" : "Submit work"}</h3>
            {submissions.length >= 3 ? (
              <p className="alert">Maximum of 3 versions reached for this milestone.</p>
            ) : (
              <>
                {formError && <p role="alert" className="alert">{formError}</p>}
                <form onSubmit={handleSubmit} noValidate>
                  <div className={fieldClass("title")}>
                    <label htmlFor="submission-title">Submission title</label>
                    <input id="submission-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                    {errorFor("title")}
                  </div>
                  <div className={fieldClass("description")}>
                    <label htmlFor="submission-description">Description</label>
                    <textarea
                      id="submission-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                    {errorFor("description")}
                  </div>
                  <div className={fieldClass("link")}>
                    <label htmlFor="submission-link">Link</label>
                    <input
                      id="submission-link"
                      type="url"
                      placeholder="https://..."
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                    />
                    {errorFor("link")}
                  </div>
                  <button type="submit" className="btn" disabled={isSaving}>
                    {isSaving ? "Saving…" : "Submit work"}
                  </button>
                </form>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
};
