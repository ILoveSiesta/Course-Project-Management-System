import React, { useEffect, useState } from "react";
import { ApiError, GradeState, Submission, getGradeApi, releaseGradeApi, saveGradeApi } from "../api.js";
import { formatDeadline } from "../format.js";

// F-08 Grade card (contract docs/sprints/sprint-2/F-08-grades.md §3).

const FIELD_MESSAGES: Record<string, string> = {
  score: "Enter a whole number from 0 to 100",
  version: "Choose a version of this milestone",
};

function fieldMessage(field: string, code: string): string {
  if (field === "score" && code === "REQUIRED") return "Required";
  return FIELD_MESSAGES[field] ?? code;
}

function gradeLine(state: GradeState): string | null {
  return state.grade ? `${state.grade.score} / 100 (graded on Version ${state.grade.version})` : null;
}

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section className="card" aria-labelledby="grade-heading">
    <h3 id="grade-heading">Grade</h3>
    {children}
  </section>
);

// Student view: the API sends no grade before release (BR-11), so only a released grade is shown.
export const StudentGradeCard: React.FC<{ state: GradeState }> = ({ state }) => (
  <Card>
    {state.released && state.grade ? <p>{gradeLine(state)}</p> : <p className="muted">Grade not released</p>}
  </Card>
);

interface SupervisorGradeCardProps {
  token: string;
  milestoneId: number;
  submissions: Submission[];
  state: GradeState;
  onChange: (state: GradeState) => void;
  onUnauthorized: () => void;
}

export const SupervisorGradeCard: React.FC<SupervisorGradeCardProps> = ({
  token,
  milestoneId,
  submissions,
  state,
  onChange,
  onUnauthorized,
}) => {
  const latestVersion = submissions.reduce((max, s) => Math.max(max, s.version), 0);
  const [score, setScore] = useState(() => (state.grade ? String(state.grade.score) : ""));
  const [version, setVersion] = useState(() => String(state.grade?.version ?? latestVersion));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Fill the form with the stored grade, or the latest version when nothing is graded yet.
  useEffect(() => {
    setScore(state.grade ? String(state.grade.score) : "");
    setVersion(String(state.grade?.version ?? latestVersion));
  }, [state.grade?.score, state.grade?.version, latestVersion]);

  const hasUnsavedChanges =
    state.grade !== null &&
    (score.trim() === "" || Number(score) !== state.grade.score || version !== String(state.grade.version));

  const handleError = (err: unknown) => {
    if (err instanceof ApiError && err.status === 401) return onUnauthorized();
    if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setFieldErrors(err.details);
    else setFormError(err instanceof Error ? err.message : "Could not save the grade");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setIsBusy(true);
    try {
      onChange(
        await saveGradeApi(token, milestoneId, {
          score: score.trim() === "" ? undefined : Number(score),
          version: Number(version),
        })
      );
    } catch (err) {
      handleError(err);
    } finally {
      setIsBusy(false);
    }
  };

  const release = async () => {
    if (hasUnsavedChanges || !state.grade) return;
    setFieldErrors({});
    setFormError(null);
    setIsBusy(true);
    try {
      // Release the grade the card shows, not the form values (#100).
      onChange(await releaseGradeApi(token, milestoneId, { score: state.grade.score, version: state.grade.version }));
    } catch (err) {
      handleError(err);
      // The stored grade changed after this page loaded: show the current grade so it can be checked first.
      if (err instanceof ApiError && err.code === "GRADE_CHANGED") {
        try {
          onChange(await getGradeApi(token, milestoneId));
        } catch (reloadErr) {
          if (reloadErr instanceof ApiError && reloadErr.status === 401) onUnauthorized();
        }
      }
    } finally {
      setIsBusy(false);
    }
  };

  const errorFor = (field: string) =>
    fieldErrors[field] && <div className="field-error">{fieldMessage(field, fieldErrors[field])}</div>;
  const fieldClass = (field: string) => `form-field${fieldErrors[field] ? " has-error" : ""}`;

  if (submissions.length === 0 && !state.grade) {
    return (
      <Card>
        <p className="muted">Nothing to grade yet</p>
      </Card>
    );
  }

  return (
    <Card>
      <p>{gradeLine(state) ?? <span className="muted">Not graded yet</span>}</p>
      {state.released && state.releasedAt ? (
        <p className="muted">Released: {formatDeadline(state.releasedAt)}</p>
      ) : (
        <>
          {state.grade && <p className="muted">Not released</p>}
          {formError && <p role="alert" className="alert">{formError}</p>}
          <form onSubmit={save} noValidate>
            <div className={fieldClass("score")}>
              <label htmlFor="grade-score">Score</label>
              <input
                id="grade-score"
                type="number"
                min={0}
                max={100}
                step={1}
                disabled={isBusy}
                value={score}
                onChange={(e) => setScore(e.target.value)}
              />
              {errorFor("score")}
            </div>
            <div className={fieldClass("version")}>
              <label htmlFor="grade-version">Graded version</label>
              <select
                id="grade-version"
                disabled={isBusy}
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              >
                {submissions.map((s) => (
                  <option key={s.id} value={String(s.version)}>
                    Version {s.version}
                  </option>
                ))}
              </select>
              {errorFor("version")}
            </div>
            <div className="form-actions">
              <button type="submit" className="btn" disabled={isBusy}>
                Save grade
              </button>
              {state.grade && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isBusy || hasUnsavedChanges}
                  onClick={release}
                >
                  Release grade
                </button>
              )}
            </div>
            {hasUnsavedChanges && (
              <p className="muted" role="status">
                Save the grade before releasing
              </p>
            )}
          </form>
        </>
      )}
    </Card>
  );
};
