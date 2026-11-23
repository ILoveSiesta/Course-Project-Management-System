export const API_URL: string = import.meta.env.VITE_API_URL ?? "/api";

export async function getHealth(): Promise<{ status: string; service: string }> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: "STUDENT" | "SUPERVISOR";
}

export async function loginApi(email: string, password: string): Promise<{ token: string; user: UserProfile }> {
  return sendRequest<{ token: string; user: UserProfile }>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function getMeApi(token: string): Promise<{ user: UserProfile }> {
  return sendRequest<{ user: UserProfile }>("/auth/me", { headers: { Authorization: `Bearer ${token}` } });
}

// --- F-02: teams and milestones ---

export interface Person {
  id: number;
  name: string;
  email: string;
}

export interface Team {
  id: number;
  name: string;
  members: Person[];
  supervisors: Person[];
}

export type MilestoneStatus =
  | "Not submitted"
  | "Overdue"
  | "Submitted"
  | "Submitted late"
  | "Reviewed";

export interface Milestone {
  id: number;
  teamId: number;
  title: string;
  description: string | null;
  deadline: string;
  createdAt: string;
  createdBy: { id: number; name: string };
  status?: MilestoneStatus;
}

export interface MilestoneDraft {
  title: string;
  description: string;
  deadline: string;
}

// --- F-03: submissions and versions ---

export interface Submission {
  id: number;
  milestoneId: number;
  version: number;
  title: string;
  description: string | null;
  link: string;
  submittedAt: string;
  daysLate: number;
  submittedBy: { id: number; name: string };
  feedback?: Feedback[];
}

// --- F-04: feedback on a submission version ---

export interface Feedback {
  id: number;
  submissionId: number;
  comment: string;
  createdAt: string;
  author: { id: number; name: string };
}

export interface SubmissionDraft {
  title: string;
  description?: string | null;
  link: string;
}

// Error from the API with its status, code and per-field details (SDS §4).
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, string> = {}
  ) {
    super(message);
  }
}

// #94 B5 (F-01 v0.12, SDS §3.2): fixed texts instead of "Failed to fetch", "Request failed" or JSON parser messages.
export const NETWORK_ERROR_MESSAGE = "Cannot reach the server. Check your connection and try again.";
export function serverUnavailableMessage(status: number): string {
  return `The server is not available right now (HTTP ${status}). Please try again later.`;
}

// Sends a request and returns the JSON body. Every failure is an ApiError: status 0 / NETWORK_ERROR when the
// server cannot be reached, the API error when the body has one, otherwise SERVER_UNAVAILABLE with the status.
async function sendRequest<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", NETWORK_ERROR_MESSAGE);
  }
  if (res.status === 204) return undefined as T;
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = undefined;
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: Record<string, string> } } | undefined)?.error;
    if (err?.message) throw new ApiError(res.status, err.code ?? "UNKNOWN", err.message, err.details);
    throw new ApiError(res.status, "SERVER_UNAVAILABLE", serverUnavailableMessage(res.status));
  }
  return (data ?? {}) as T;
}

async function apiRequest<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  return sendRequest<T>(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
  });
}

export async function getTeamsApi(token: string): Promise<Team[]> {
  const data = await apiRequest<{ teams?: Team[] }>(token, "/teams");
  return data.teams ?? [];
}

export async function getTeamApi(token: string, teamId: number): Promise<Team> {
  const data = await apiRequest<{ team: Team }>(token, `/teams/${teamId}`);
  return data.team;
}

// --- F-13: supervisor team creation and member management ---

export async function createTeamApi(token: string, name: string): Promise<Team> {
  const data = await apiRequest<{ team: Team }>(token, "/teams", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return data.team;
}

export async function getAvailableStudentsApi(token: string): Promise<Person[]> {
  const data = await apiRequest<{ students?: Person[] }>(token, "/teams/available-students");
  return data.students ?? [];
}

export async function addTeamMemberApi(token: string, teamId: number, studentId: number): Promise<Team> {
  const data = await apiRequest<{ team: Team }>(token, `/teams/${teamId}/members`, {
    method: "POST",
    body: JSON.stringify({ studentId }),
  });
  return data.team;
}

export async function removeTeamMemberApi(token: string, teamId: number, studentId: number): Promise<Team> {
  const data = await apiRequest<{ team: Team }>(token, `/teams/${teamId}/members/${studentId}`, {
    method: "DELETE",
  });
  return data.team;
}

export async function getTeamMilestonesApi(token: string, teamId: number): Promise<Milestone[]> {
  const data = await apiRequest<{ milestones?: Milestone[] }>(token, `/teams/${teamId}/milestones`);
  return data.milestones ?? [];
}

export async function createMilestoneApi(token: string, teamId: number, draft: MilestoneDraft): Promise<Milestone> {
  const data = await apiRequest<{ milestone: Milestone }>(token, `/teams/${teamId}/milestones`, {
    method: "POST",
    body: JSON.stringify(draft),
  });
  return data.milestone;
}

// F-06: the same milestone for several assigned teams; one milestone per team is returned.
export async function createMilestoneForTeamsApi(
  token: string,
  draft: MilestoneDraft & { teamIds: number[] }
): Promise<Milestone[]> {
  const data = await apiRequest<{ milestones: Milestone[] }>(token, "/milestones", {
    method: "POST",
    body: JSON.stringify(draft),
  });
  return data.milestones;
}

export async function getMilestoneApi(token: string, milestoneId: number): Promise<Milestone> {
  const data = await apiRequest<{ milestone: Milestone }>(token, `/milestones/${milestoneId}`);
  return data.milestone;
}

// F-05: partial update; only the fields present are changed.
export interface MilestoneUpdate {
  title?: string;
  description?: string | null;
  deadline?: string;
}

export async function updateMilestoneApi(token: string, milestoneId: number, update: MilestoneUpdate): Promise<Milestone> {
  const data = await apiRequest<{ milestone: Milestone }>(token, `/milestones/${milestoneId}`, {
    method: "PATCH",
    body: JSON.stringify(update),
  });
  return data.milestone;
}

export async function getMilestoneSubmissionsApi(token: string, milestoneId: number): Promise<Submission[]> {
  const data = await apiRequest<{ submissions?: Submission[] }>(token, `/milestones/${milestoneId}/submissions`);
  return data.submissions ?? [];
}

// F-07 (FR-15): dedicated milestone revision history with server-computed metadata and sort order.
export type HistoryOrder = "desc" | "asc";

export interface RevisionHistoryItem extends Submission {
  isLatest: boolean;
  isLate: boolean;
  feedbackCount: number;
  feedback: Feedback[];
}

export interface MilestoneRevisionHistory {
  milestone: {
    id: number;
    teamId: number;
    teamName: string;
    title: string;
    description: string | null;
    deadline: string;
  };
  totalVersions: number;
  latestVersion: number | null;
  revisions: RevisionHistoryItem[];
}

export async function getMilestoneHistoryApi(
  token: string,
  milestoneId: number,
  order: HistoryOrder = "desc"
): Promise<MilestoneRevisionHistory> {
  const data = await apiRequest<{ history: MilestoneRevisionHistory }>(
    token,
    `/milestones/${milestoneId}/history?order=${order}`
  );
  return data.history;
}

export async function createSubmissionApi(
  token: string,
  milestoneId: number,
  draft: SubmissionDraft
): Promise<Submission> {
  const data = await apiRequest<{ submission: Submission }>(token, `/milestones/${milestoneId}/submissions`, {
    method: "POST",
    body: JSON.stringify(draft),
  });
  return data.submission;
}

// --- F-08: grade per milestone ---

export interface GradeState {
  grade: {
    score: number;
    version: number;
    submissionId: number;
    gradedBy: { id: number; name: string };
    gradedAt: string;
  } | null;
  released: boolean;
  releasedAt: string | null;
}

function toGradeState(data: Partial<GradeState>): GradeState {
  return { grade: data.grade ?? null, released: data.released === true, releasedAt: data.releasedAt ?? null };
}

export async function getGradeApi(token: string, milestoneId: number): Promise<GradeState> {
  return toGradeState(await apiRequest<Partial<GradeState>>(token, `/milestones/${milestoneId}/grade`));
}

export async function saveGradeApi(
  token: string,
  milestoneId: number,
  input: { score?: number; version: number }
): Promise<GradeState> {
  const data = await apiRequest<Partial<GradeState>>(token, `/milestones/${milestoneId}/grade`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return toGradeState(data);
}

// `shown` is the grade the page displays; the server releases only if it is still the stored grade (#100).
export async function releaseGradeApi(
  token: string,
  milestoneId: number,
  shown: { score: number; version: number }
): Promise<GradeState> {
  const data = await apiRequest<Partial<GradeState>>(token, `/milestones/${milestoneId}/grade/release`, {
    method: "POST",
    body: JSON.stringify(shown),
  });
  return toGradeState(data);
}

export async function createFeedbackApi(token: string, submissionId: number, comment: string): Promise<Feedback> {
  const data = await apiRequest<{ feedback: Feedback }>(token, `/submissions/${submissionId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
  return data.feedback;
}

// Throws ApiError when the token could not be revoked (#94 B3); a 401 means it is already invalid.
export async function logoutApi(token: string): Promise<void> {
  await sendRequest<void>("/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
}
