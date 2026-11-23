import React, { useState } from "react";
import { ApiError, Milestone, MilestoneUpdate } from "../api.js";
import { localDeadlineToIso, milestoneFieldMessage, toDateTimeLocal } from "../milestoneFields.js";

interface Props {
  milestone: Milestone;
  // Sends the update; resolves with the saved milestone or throws ApiError.
  onSave: (update: MilestoneUpdate) => Promise<Milestone | undefined>;
  onCancel: () => void;
}

// F-05: edit title/description and extend the deadline. Only changed fields are sent: the deadline
// input has minutes only, so sending an untouched deadline could move it earlier by its seconds (BR-13).
export const MilestoneEditForm: React.FC<Props> = ({ milestone, onSave, onCancel }) => {
  const initial = {
    title: milestone.title,
    description: milestone.description ?? "",
    deadline: toDateTimeLocal(milestone.deadline),
  };
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [deadline, setDeadline] = useState(initial.deadline);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const update: MilestoneUpdate = {};
    if (title !== initial.title) update.title = title;
    if (description !== initial.description) update.description = description;
    if (deadline !== initial.deadline) {
      const deadlineIso = deadline ? localDeadlineToIso(deadline) : "";
      if (deadlineIso === null) {
        setFieldErrors({ deadline: "INVALID_DATE" });
        return;
      }
      update.deadline = deadlineIso;
    }

    setIsSaving(true);
    try {
      await onSave(update);
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setFieldErrors(err.details);
      else setFormError(err instanceof Error ? err.message : "Could not save the milestone");
    } finally {
      setIsSaving(false);
    }
  };

  const errorFor = (field: string) =>
    fieldErrors[field] && <div className="field-error">{milestoneFieldMessage(field, fieldErrors[field])}</div>;
  const fieldClass = (field: string) => `form-field${fieldErrors[field] ? " has-error" : ""}`;

  return (
    <form aria-label="Edit milestone" onSubmit={handleSubmit} noValidate>
      {formError && <p role="alert" className="alert">{formError}</p>}
      {fieldErrors.body && <p role="alert" className="alert">{milestoneFieldMessage("body", fieldErrors.body)}</p>}
      <div className={fieldClass("title")}>
        <label htmlFor="edit-milestone-title">Title</label>
        <input id="edit-milestone-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        {errorFor("title")}
      </div>
      <div className={fieldClass("description")}>
        <label htmlFor="edit-milestone-description">Description</label>
        <textarea
          id="edit-milestone-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {errorFor("description")}
      </div>
      <div className={fieldClass("deadline")}>
        <label htmlFor="edit-milestone-deadline">Deadline</label>
        <input
          id="edit-milestone-deadline"
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
        {errorFor("deadline")}
      </div>
      <div className="form-actions">
        <button type="submit" className="btn" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save changes"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
      </div>
    </form>
  );
};
