import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../src/App.js";

// F-09 Derived Team Milestone Status UI (contract docs/sprints/sprint-2/F-09-milestone-status.md).

type MockResponse = { status: number; body?: unknown };
type Handler = (url: string, init?: RequestInit) => MockResponse | undefined;

const student = { id: 1, name: "Student One", email: "student1@cpms.test", role: "STUDENT" };
const supervisor = { id: 7, name: "Supervisor One", email: "supervisor1@cpms.test", role: "SUPERVISOR" };

const alpha = {
  id: 1,
  name: "Team Alpha",
  members: [{ id: 1, name: "Student One", email: "student1@cpms.test" }],
  supervisors: [{ id: 7, name: "Supervisor One", email: "supervisor1@cpms.test" }],
};

function makeMilestone(id: number, title: string, status: string) {
  return {
    id,
    teamId: 1,
    title,
    description: null,
    deadline: "2026-12-01T10:00:00.000Z",
    createdAt: "2026-11-21T03:00:00.000Z",
    createdBy: { id: 7, name: "Supervisor One" },
    status,
  };
}

function mockApi(user: object, handler: Handler) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const res =
      handler(url, init) ??
      (url.includes("/api/auth/me")
        ? { status: 200, body: { user } }
        : { status: 200, body: { status: "ok" } });
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

describe("F-09 Derived Team Milestone Status UI", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("TEST-09-07: student dashboard renders all 5 derived status badges in the milestone list", async () => {
    const milestones = [
      makeMilestone(1, "M1 Not submitted", "Not submitted"),
      makeMilestone(2, "M2 Overdue", "Overdue"),
      makeMilestone(3, "M3 Submitted", "Submitted"),
      makeMilestone(4, "M4 Submitted late", "Submitted late"),
      makeMilestone(5, "M5 Reviewed", "Reviewed"),
    ];

    mockApi(student, (url) => {
      if (url.endsWith("/api/teams")) return { status: 200, body: { teams: [alpha] } };
      if (url.endsWith("/api/teams/1/milestones")) return { status: 200, body: { milestones } };
    });

    startAt("/student");
    render(<App />);

    const list = await screen.findByRole("list", { name: "Milestones" });
    for (const label of ["Not submitted", "Overdue", "Submitted", "Submitted late", "Reviewed"]) {
      expect(within(list).getByText(label)).toBeInTheDocument();
    }
  });

  it("TEST-09-08: supervisor team detail renders milestone status badges including after creating a new milestone", async () => {
    mockApi(supervisor, (url, init) => {
      if (url.endsWith("/api/teams") && !init?.method) return { status: 200, body: { teams: [alpha] } };
      if (url.endsWith("/api/teams/1") && !init?.method) return { status: 200, body: { team: alpha } };
      if (url.endsWith("/api/teams/1/milestones") && !init?.method) {
        return { status: 200, body: { milestones: [makeMilestone(1, "M1 Existing", "Reviewed")] } };
      }
      if (url.endsWith("/api/teams/1/milestones") && init?.method === "POST") {
        const sent = JSON.parse(String(init.body));
        return { status: 201, body: { milestone: makeMilestone(2, sent.title, "Not submitted") } };
      }
    });

    startAt("/supervisor/teams/1");
    render(<App />);

    const list = await screen.findByRole("list", { name: "Milestones" });
    expect(within(list).getByText("Reviewed")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "M2 New" } });
    fireEvent.change(screen.getByLabelText("Deadline"), { target: { value: "2026-12-01T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Create milestone" }));

    expect(await within(list).findByText("M2 New")).toBeInTheDocument();
    expect(within(list).getByText("Not submitted")).toBeInTheDocument();
  });
});
