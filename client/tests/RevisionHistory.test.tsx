import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../src/App.js";

// F-07 Milestone Revision History UI (contract docs/sprints/sprint-2/F-07-revision-history.md).

type MockResponse = { status: number; body?: unknown };
type Handler = (url: string, init?: RequestInit) => MockResponse | undefined;

const student = { id: 1, name: "Student One", email: "student1@cpms.test", role: "STUDENT" };
const supervisor = { id: 7, name: "Supervisor One", email: "supervisor1@cpms.test", role: "SUPERVISOR" };

const milestoneSummary = {
  id: 10,
  teamId: 1,
  teamName: "Team Alpha",
  title: "SRS draft",
  description: "First version",
  deadline: "2026-11-08T16:59:00.000Z",
};

const rev1 = {
  id: 101,
  version: 1,
  isLatest: false,
  title: "SRS draft v1",
  description: "Initial",
  link: "https://github.com/my-team/repo/pull/1",
  submittedAt: "2026-11-08T10:00:00.000Z",
  daysLate: 0,
  isLate: false,
  submittedBy: { id: 1, name: "Student One" },
  feedbackCount: 1,
  feedback: [
    {
      id: 201,
      submissionId: 101,
      comment: "Clarify BR-05",
      createdAt: "2026-11-08T12:00:00.000Z",
      author: { id: 7, name: "Supervisor One" },
    },
  ],
};

const rev2 = {
  id: 102,
  version: 2,
  isLatest: true,
  title: "SRS draft v2",
  description: "Fixed scope",
  link: "https://github.com/my-team/repo/pull/2",
  submittedAt: "2026-11-09T10:00:00.000Z",
  daysLate: 1,
  isLate: true,
  submittedBy: { id: 2, name: "Student Two" },
  feedbackCount: 0,
  feedback: [],
};

function mockApi(user: typeof student, handler: Handler) {
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

describe("F-07 Revision History UI", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("TEST-07-07: student views ordered revision history, toggles sort order, and accesses it from milestone detail", async () => {
    const fetchMock = mockApi(student, (url) => {
      if (url.includes("/api/milestones/10/history?order=asc")) {
        return {
          status: 200,
          body: { history: { milestone: milestoneSummary, totalVersions: 2, latestVersion: 2, revisions: [rev1, rev2] } },
        };
      }
      if (url.includes("/api/milestones/10/history")) {
        return {
          status: 200,
          body: { history: { milestone: milestoneSummary, totalVersions: 2, latestVersion: 2, revisions: [rev2, rev1] } },
        };
      }
      if (url.endsWith("/api/milestones/10")) {
        return { status: 200, body: { milestone: milestoneSummary } };
      }
      if (url.endsWith("/api/milestones/10/submissions")) {
        return { status: 200, body: { submissions: [] } };
      }
    });

    startAt("/student/milestones/10/history");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "SRS draft — Revision history" })).toBeInTheDocument();
    expect(screen.getByText(/Team Alpha/)).toBeInTheDocument();
    expect(screen.getByText(/Total versions: 2 \/ 3/)).toBeInTheDocument();

    const listDesc = await screen.findByRole("list", { name: "Revision history" });
    const descHeadings = within(listDesc).getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    expect(descHeadings).toEqual(["Version 2: SRS draft v2", "Version 1: SRS draft v1"]);

    expect(within(listDesc).getAllByText("Latest")).toHaveLength(1);
    expect(within(listDesc).getByText("Late (+1 d)")).toBeInTheDocument();
    expect(within(listDesc).getByText("On time")).toBeInTheDocument();
    expect(within(listDesc).getByText("Clarify BR-05")).toBeInTheDocument();
    expect(within(listDesc).getByText(/by Supervisor One on/)).toBeInTheDocument();
    expect(within(listDesc).getByText("No feedback on this version.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Oldest first" }));
    const listAsc = await screen.findByRole("list", { name: "Revision history" });
    await waitFor(() => {
      const ascHeadings = within(listAsc).getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
      expect(ascHeadings).toEqual(["Version 1: SRS draft v1", "Version 2: SRS draft v2"]);
    });
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/api/milestones/10/history?order=asc"))).toBe(true);

    // Detail screen links to revision history
    startAt("/student/milestones/10");
    render(<App />);
    const historyLink = await screen.findByRole("link", { name: "View revision history" });
    expect(historyLink).toHaveAttribute("href", "/student/milestones/10/history");
  });

  it("TEST-07-08: supervisor sees empty history message and 404 error without partial data", async () => {
    mockApi(supervisor, (url) => {
      if (url.includes("/api/milestones/10/history")) {
        return {
          status: 200,
          body: { history: { milestone: milestoneSummary, totalVersions: 0, latestVersion: null, revisions: [] } },
        };
      }
      if (url.includes("/api/milestones/999/history")) {
        return {
          status: 404,
          body: { error: { code: "NOT_FOUND", message: "Resource not found" } },
        };
      }
    });

    startAt("/supervisor/milestones/10/history");
    const first = render(<App />);
    expect(await screen.findByText("No submissions in revision history yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Back to milestone" })).toHaveAttribute("href", "/supervisor/milestones/10");
    first.unmount();

    startAt("/supervisor/milestones/999/history");
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Milestone not found or not allowed");
    expect(screen.queryByRole("list", { name: "Revision history" })).not.toBeInTheDocument();
  });
});
