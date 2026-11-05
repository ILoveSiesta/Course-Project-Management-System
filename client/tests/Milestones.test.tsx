import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../src/App.js";

type MockResponse = { status: number; body?: unknown };
type Handler = (url: string, init?: RequestInit) => MockResponse | undefined;

const student = { id: 1, name: "Student One", email: "student1@cpms.test", role: "STUDENT" };
const supervisor = { id: 7, name: "Supervisor One", email: "supervisor1@cpms.test", role: "SUPERVISOR" };

const alpha = {
  id: 1,
  name: "Team Alpha",
  members: [
    { id: 1, name: "Student One", email: "student1@cpms.test" },
    { id: 2, name: "Student Two", email: "student2@cpms.test" },
  ],
  supervisors: [{ id: 7, name: "Supervisor One", email: "supervisor1@cpms.test" }],
};

const srsMilestone = {
  id: 10,
  teamId: 1,
  title: "SRS draft",
  description: "First version",
  deadline: "2026-11-08T16:59:00.000Z",
  createdAt: "2026-11-05T03:00:00.000Z",
  createdBy: { id: 7, name: "Supervisor One" },
};

const releaseMilestone = {
  ...srsMilestone,
  id: 11,
  title: "Sprint 1 release",
  description: null,
  deadline: "2026-11-20T05:00:00.000Z",
};

function mockApi(me: object, handler: Handler) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const res = handler(url, init) ??
      (url.includes("/api/auth/me") ? { status: 200, body: { user: me } } : { status: 200, body: { status: "ok" } });
    return Promise.resolve({
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      json: async () => res.body,
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function startAt(path: string) {
  sessionStorage.setItem("cpms_token", "test-token");
  window.history.pushState({}, "Test", path);
}

describe("F-02 Team view and milestone UI", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("TEST-02-12: student home shows team, members, supervisors and milestones with ICT deadlines", async () => {
    mockApi(student, (url) => {
      if (url.endsWith("/api/teams")) return { status: 200, body: { teams: [alpha] } };
      if (url.endsWith("/api/teams/1/milestones")) return { status: 200, body: { milestones: [srsMilestone, releaseMilestone] } };
    });
    startAt("/student");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Team Alpha" })).toBeInTheDocument();
    expect(screen.getByText("student2@cpms.test", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/Supervisors:.*Supervisor One/)).toBeInTheDocument();
    expect(await screen.findByText("SRS draft")).toBeInTheDocument();
    expect(screen.getByText("Sprint 1 release")).toBeInTheDocument();
    expect(screen.getByText("8 Nov 2026, 23:59 (ICT)")).toBeInTheDocument();
  });

  it("TEST-02-13: student home shows an empty state when the team has no milestones", async () => {
    mockApi(student, (url) => {
      if (url.endsWith("/api/teams")) return { status: 200, body: { teams: [alpha] } };
      if (url.endsWith("/api/teams/1/milestones")) return { status: 200, body: { milestones: [] } };
    });
    startAt("/student");

    render(<App />);

    expect(await screen.findByText("No milestones yet.")).toBeInTheDocument();
  });

  it("TEST-02-14: supervisor creates a milestone from the team page and sees it listed", async () => {
    const fetchMock = mockApi(supervisor, (url, init) => {
      if (url.endsWith("/api/teams/1") && !init?.method) return { status: 200, body: { team: alpha } };
      if (url.endsWith("/api/teams/1/milestones") && init?.method === "POST") {
        const sent = JSON.parse(String(init.body));
        return { status: 201, body: { milestone: { ...srsMilestone, id: 12, title: sent.title, deadline: sent.deadline } } };
      }
      if (url.endsWith("/api/teams/1/milestones")) return { status: 200, body: { milestones: [] } };
    });
    startAt("/supervisor/teams/1");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Team Alpha" })).toBeInTheDocument();
    expect(await screen.findByText("No milestones yet.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Design review" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Bring the SDS" } });
    fireEvent.change(screen.getByLabelText("Deadline"), { target: { value: "2026-12-01T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Create milestone" }));

    const list = await screen.findByRole("list", { name: "Milestones" });
    expect(await within(list).findByText("Design review")).toBeInTheDocument();

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post).toBeDefined();
    expect(JSON.parse(String(post![1]!.body))).toEqual({
      title: "Design review",
      description: "Bring the SDS",
      deadline: new Date("2026-12-01T10:00").toISOString(),
    });
    expect((post![1]!.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
  });

  it("TEST-02-15: supervisor sees API validation errors under each field", async () => {
    mockApi(supervisor, (url, init) => {
      if (url.endsWith("/api/teams/1") && !init?.method) return { status: 200, body: { team: alpha } };
      if (url.endsWith("/api/teams/1/milestones") && init?.method === "POST") {
        return {
          status: 400,
          body: {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid milestone",
              details: { title: "REQUIRED", deadline: "MUST_BE_FUTURE" },
            },
          },
        };
      }
      if (url.endsWith("/api/teams/1/milestones")) return { status: 200, body: { milestones: [] } };
    });
    startAt("/supervisor/teams/1");

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Create milestone" }));

    expect(await screen.findByText("Required")).toBeInTheDocument();
    expect(screen.getByText("Deadline must be in the future")).toBeInTheDocument();
  });
});
