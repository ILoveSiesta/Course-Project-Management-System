import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { ApiError, Milestone, Team, createMilestoneApi, getTeamApi, getTeamMilestonesApi } from "../api.js";
import { MilestoneList, TeamSummary } from "./TeamDetails.js";

const FIELD_MESSAGES: Record<string, string> = {
  REQUIRED: "Required",
  INVALID_DATE: "Invalid date",
  MUST_BE_FUTURE: "Deadline must be in the future",
  INVALID_TYPE: "Invalid value",
};
const MAX_LENGTH: Record<string, number> = { title: 120, description: 2000 };

function fieldMessage(field: string, code: string): string {
  if (code === "TOO_LONG") return `Too long (max ${MAX_LENGTH[field]} characters)`;
  return FIELD_MESSAGES[code] ?? code;
}

const byDeadline = (a: Milestone, b: Milestone) => a.deadline.localeCompare(b.deadline) || a.id - b.id;

export const SupervisorTeam: React.FC = () => {
  const { token, logout } = useAuth();
  const teamId = Number(useParams().teamId);

  const [team, setTeam] = useState<Team | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;

    (async () => {
      try {
        const [loadedTeam, list] = await Promise.all([getTeamApi(token, teamId), getTeamMilestonesApi(token, teamId)]);
        if (!active) return;
        setTeam(loadedTeam);
        setMilestones(list);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return logout();
        if (!active) return;
        setLoadError(
          err instanceof ApiError && (err.status === 404 || err.status === 403)
            ? "Team not found or not allowed"
            : "Could not load the team"
        );
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token, teamId]); // logout is recreated each render; it is only called on 401

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFieldErrors({});
    setFormError(null);
    setIsSaving(true);

    try {
      // datetime-local has no zone: it is read in the browser's time zone and sent as UTC.
      const created = await createMilestoneApi(token, teamId, {
        title,
        description,
        deadline: deadline ? new Date(deadline).toISOString() : "",
      });
      setMilestones((list) => [...list, created].sort(byDeadline));
      setTitle("");
      setDescription("");
      setDeadline("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return logout();
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setFieldErrors(err.details);
      else setFormError(err instanceof Error ? err.message : "Could not create the milestone");
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
        <Link to="/supervisor">← My teams</Link>
      </p>
      {isLoading && <p className="loading">Loading…</p>}
      {loadError && <p role="alert" className="alert">{loadError}</p>}
      {team && (
        <>
          <TeamSummary team={team} />

          <section className="card">
            <h3>Milestones</h3>
            <MilestoneList milestones={milestones} linkPrefix="/supervisor/milestones" />
          </section>

          <section className="card">
            <h3>New milestone</h3>
            {formError && <p role="alert" className="alert">{formError}</p>}
            <form onSubmit={handleSubmit} noValidate>
              <div className={fieldClass("title")}>
                <label htmlFor="milestone-title">Title</label>
                <input id="milestone-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                {errorFor("title")}
              </div>
              <div className={fieldClass("description")}>
                <label htmlFor="milestone-description">Description</label>
                <textarea
                  id="milestone-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                {errorFor("description")}
              </div>
              <div className={fieldClass("deadline")}>
                <label htmlFor="milestone-deadline">Deadline</label>
                <input
                  id="milestone-deadline"
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
                {errorFor("deadline")}
              </div>
              <button type="submit" className="btn" disabled={isSaving}>
                {isSaving ? "Saving…" : "Create milestone"}
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
};
