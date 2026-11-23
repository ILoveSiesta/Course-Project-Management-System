import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../src/App.js";

// Defect #94 group C2 (DEF-F03-CONTRACT): the student milestone page shows the team name (F-03 v0.5 TEST-03-28).

type MockResponse = { status: number; body?: unknown };

const student = { id: 1, name: "Student One", email: "student1@cpms.test", role: "STUDENT" };
const alpha = {
  id: 1,
  name: "Team Alpha",
  members: [{ id: 1, name: "Student One", email: "student1@cpms.test" }],
  supervisors: [{ id: 7, name: "Supervisor One", email: "supervisor1@cpms.test" }],
};
const milestone = {
  id: 10,
  teamId: 1,
  title: "SRS draft",
  description: "First version",
  deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: "2026-11-05T03:00:00.000Z",
  createdBy: { id: 7, name: "Supervisor One" },
};

function mockApi(teamResponse: MockResponse) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      let res: MockResponse = { status: 200, body: {} };
      if (url.includes("/api/auth/me")) res = { status: 200, body: { user: student } };
      else if (url.endsWith("/api/teams/1")) res = teamResponse;
      else if (url.endsWith("/api/milestones/10")) res = { status: 200, body: { milestone } };
      else if (url.endsWith("/api/milestones/10/submissions")) res = { status: 200, body: { submissions: [] } };
      else if (url.endsWith("/api/milestones/10/grade")) res = { status: 200, body: { grade: null, released: false, releasedAt: null } };
      return Promise.resolve({ ok: res.status >= 200 && res.status < 300, status: res.status, json: async () => res.body });
    })
  );
}

describe("#94 DEF-F03-CONTRACT: team name on the student milestone page", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    sessionStorage.setItem("cpms_token", "test-token");
    window.history.pushState({}, "Test", "/student/milestones/10");
  });

  it("TEST-03-28: shows \"Team: Team Alpha\" in the milestone card", async () => {
    mockApi({ status: 200, body: { team: alpha } });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "SRS draft" })).toBeInTheDocument();
    expect(await screen.findByText("Team: Team Alpha")).toBeInTheDocument();
  });

  it("TEST-03-28: if the team read fails, the milestone, versions and form are still shown", async () => {
    mockApi({ status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Internal server error" } } });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "SRS draft" })).toBeInTheDocument();
    expect(screen.getByText("No submissions yet.")).toBeInTheDocument();
    expect(screen.getByLabelText("Submission title")).toBeInTheDocument();
    expect(screen.queryByText(/^Team:/)).not.toBeInTheDocument();
  });
});
