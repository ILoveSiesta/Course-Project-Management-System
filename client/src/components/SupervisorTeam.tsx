import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import {
  ApiError,
  Milestone,
  Person,
  Team,
  addTeamMemberApi,
  createMilestoneApi,
  createMilestoneForTeamsApi,
  getAvailableStudentsApi,
  getTeamApi,
  getTeamMilestonesApi,
  getTeamsApi,
  removeTeamMemberApi,
} from "../api.js";
import { MilestoneList, TeamSummary } from "./TeamDetails.js";
import { milestoneFieldMessage as fieldMessage } from "../milestoneFields.js";


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
  // F-06: the supervisor's assigned teams and the other teams ticked for the new milestone.
  const [assignedTeams, setAssignedTeams] = useState<Team[]>([]);
  const [otherTeamIds, setOtherTeamIds] = useState<number[]>([]);
  const [createdFor, setCreatedFor] = useState<string | null>(null);

  // F-13: unassigned student picker and member add/remove state.
  const [availableStudents, setAvailableStudents] = useState<Person[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [memberStatus, setMemberStatus] = useState<string | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);

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

    // F-06: the team list only adds options to the form; if it cannot be loaded the form still works
    // for this team (F-02 path).
    getTeamsApi(token)
      .then((teams) => {
        if (active) setAssignedTeams(teams);
      })
      .catch(() => undefined);

    getAvailableStudentsApi(token)
      .then((students) => {
        if (active) setAvailableStudents(students);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [token, teamId]); // logout is recreated each render; it is only called on 401

  const refreshAvailableStudents = () => {
    if (!token) return;
    getAvailableStudentsApi(token)
      .then((students) => setAvailableStudents(students))
      .catch(() => undefined);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedStudentId) return;
    setMemberError(null);
    setMemberStatus(null);
    setIsAddingMember(true);

    const picked = availableStudents.find((s) => s.id === Number(selectedStudentId));
    try {
      const updated = await addTeamMemberApi(token, teamId, Number(selectedStudentId));
      setTeam(updated);
      setSelectedStudentId("");
      setMemberStatus(picked ? `Added ${picked.name} to the team.` : "Added student to the team.");
      refreshAvailableStudents();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return logout();
      setMemberError(err instanceof Error ? err.message : "Could not add member");
      if (err instanceof ApiError && err.status === 409) refreshAvailableStudents();
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (member: Person) => {
    if (!token) return;
    setMemberError(null);
    setMemberStatus(null);
    setRemovingMemberId(member.id);

    try {
      const updated = await removeTeamMemberApi(token, teamId, member.id);
      setTeam(updated);
      setMemberStatus(`Removed ${member.name} from the team.`);
      refreshAvailableStudents();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return logout();
      setMemberError(err instanceof Error ? err.message : "Could not remove member");
    } finally {
      setRemovingMemberId(null);
    }
  };

  const toggleTeam = (id: number) =>
    setOtherTeamIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFieldErrors({});
    setFormError(null);
    setCreatedFor(null);
    setIsSaving(true);

    try {
      // datetime-local has no zone: it is read in the browser's time zone and sent as UTC.
      const draft = { title, description, deadline: deadline ? new Date(deadline).toISOString() : "" };
      if (otherTeamIds.length === 0) {
        const created = await createMilestoneApi(token, teamId, draft);
        setMilestones((list) => [...list, created].sort(byDeadline));
      } else {
        // F-06: this team first, then the ticked teams; one milestone per team comes back.
        const createdList = await createMilestoneForTeamsApi(token, { teamIds: [teamId, ...otherTeamIds], ...draft });
        const own = createdList.filter((m) => m.teamId === teamId);
        setMilestones((list) => [...list, ...own].sort(byDeadline));
        const nameOf = (id: number) => assignedTeams.find((t) => t.id === id)?.name ?? (id === teamId ? team?.name : `#${id}`);
        setCreatedFor(
          `Milestone created for ${createdList.length} teams: ${createdList.map((m) => nameOf(m.teamId)).join(", ")}`
        );
        setOtherTeamIds([]);
      }
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
          <TeamSummary team={team} onRemoveMember={handleRemoveMember} removingMemberId={removingMemberId}>
            {memberError && <p role="alert" className="alert">{memberError}</p>}
            {memberStatus && <p role="status" className="status-notice">{memberStatus}</p>}
            <form onSubmit={handleAddMember} className="inline-form" noValidate>
              <div className="form-field">
                <label htmlFor="add-member-student">Student</label>
                <select
                  id="add-member-student"
                  aria-label="Student"
                  value={selectedStudentId}
                  disabled={availableStudents.length === 0 || isAddingMember}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                >
                  {availableStudents.length === 0 ? (
                    <option value="">No unassigned students available</option>
                  ) : (
                    <>
                      <option value="">Select a student…</option>
                      {availableStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {`${s.name} (${s.email})`}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
              <button
                type="submit"
                className="btn"
                disabled={availableStudents.length === 0 || !selectedStudentId || isAddingMember}
              >
                {isAddingMember ? "Adding…" : "Add member"}
              </button>
            </form>
          </TeamSummary>

          <section className="card">
            <h3>Milestones</h3>
            <MilestoneList milestones={milestones} linkPrefix="/supervisor/milestones" />
          </section>

          <section className="card">
            <h3>New milestone</h3>
            {formError && <p role="alert" className="alert">{formError}</p>}
            {createdFor && <p role="status" className="muted">{createdFor}</p>}
            <form onSubmit={handleSubmit} noValidate>
              {assignedTeams.length > 0 && (
                <fieldset className={`form-field team-options${fieldErrors.teamIds ? " has-error" : ""}`}>
                  <legend>Teams</legend>
                  {assignedTeams.map((t) => (
                    <label key={t.id}>
                      <input
                        type="checkbox"
                        checked={t.id === teamId || otherTeamIds.includes(t.id)}
                        disabled={t.id === teamId}
                        onChange={() => toggleTeam(t.id)}
                      />
                      {t.id === teamId ? `${t.name} (this team)` : t.name}
                    </label>
                  ))}
                  {errorFor("teamIds")}
                </fieldset>
              )}
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
