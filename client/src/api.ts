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
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Login failed");
  }

  return data;
}

export async function getMeApi(token: string): Promise<{ user: UserProfile }> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to fetch user");
  }

  return data;
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

export interface Milestone {
  id: number;
  teamId: number;
  title: string;
  description: string | null;
  deadline: string;
  createdAt: string;
  createdBy: { id: number; name: string };
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

async function apiRequest<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(res.status, err.code ?? "UNKNOWN", err.message ?? "Request failed", err.details);
  }
  return data as T;
}

export async function getTeamsApi(token: string): Promise<Team[]> {
  const data = await apiRequest<{ teams?: Team[] }>(token, "/teams");
  return data.teams ?? [];
}

export async function getTeamApi(token: string, teamId: number): Promise<Team> {
  const data = await apiRequest<{ team: Team }>(token, `/teams/${teamId}`);
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

export async function getMilestoneApi(token: string, milestoneId: number): Promise<Milestone> {
  const data = await apiRequest<{ milestone: Milestone }>(token, `/milestones/${milestoneId}`);
  return data.milestone;
}

export async function getMilestoneSubmissionsApi(token: string, milestoneId: number): Promise<Submission[]> {
  const data = await apiRequest<{ submissions?: Submission[] }>(token, `/milestones/${milestoneId}/submissions`);
  return data.submissions ?? [];
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

export async function logoutApi(token: string): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}
