import React, { useState } from "react";
import { ApiError, Feedback } from "../api.js";
import { formatDeadline } from "../format.js";

const FIELD_MESSAGES: Record<string, string> = {
  REQUIRED: "Required",
  TOO_LONG: "Too long (max 5000 characters)",
  INVALID_TYPE: "Invalid value",
};

interface FeedbackSectionProps {
  version: number;
  feedback: Feedback[];
  // Present only for supervisors; resolves when saved, throws ApiError when rejected.
  onAdd?: (comment: string) => Promise<void>;
}

// Feedback entries of one submission version, plus the supervisor's "Add feedback" form (F-04).
export const FeedbackSection: React.FC<FeedbackSectionProps> = ({ version, feedback, onAdd }) => {
  const [comment, setComment] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputId = `feedback-v${version}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAdd) return;
    setFieldError(null);
    setFormError(null);
    setIsSaving(true);

    try {
      await onAdd(comment);
      setComment("");
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") {
        const code = err.details.comment;
        setFieldError(FIELD_MESSAGES[code] ?? code);
      } else {
        setFormError(err instanceof Error ? err.message : "Could not save the feedback");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="feedback-section">
      <div className="section-label">Feedback</div>
      {feedback.length === 0 ? (
        <p className="empty-state">No feedback yet.</p>
      ) : (
        <ul className="plain-list feedback-list">
          {feedback.map((f) => (
            <li key={f.id} className="feedback-item">
              <p className="feedback-comment">{f.comment}</p>
              <p className="feedback-meta">{`by ${f.author.name} on ${formatDeadline(f.createdAt)}`}</p>
            </li>
          ))}
        </ul>
      )}

      {onAdd && (
        <form className="feedback-form" onSubmit={handleSubmit} noValidate>
          {formError && <p role="alert" className="alert">{formError}</p>}
          <div className={`form-field${fieldError ? " has-error" : ""}`}>
            <label htmlFor={inputId}>{`Feedback for version ${version}`}</label>
            <textarea id={inputId} value={comment} onChange={(e) => setComment(e.target.value)} />
            {fieldError && <div className="field-error">{fieldError}</div>}
          </div>
          <button type="submit" className="btn" disabled={isSaving}>
            {isSaving ? "Saving…" : "Add feedback"}
          </button>
        </form>
      )}
    </div>
  );
};
