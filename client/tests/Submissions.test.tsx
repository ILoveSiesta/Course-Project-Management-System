import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../src/App.js";

type MockResponse = { status: number; body?: unknown };
type Handler = (url: string, init?: RequestInit) => MockResponse | undefined;

const student = { id: 1, name: "Student One", email: "student1@cpms.test", role: "STUDENT" };
const supervisor = { id: 7, name: "Supervisor One", email: "supervisor1@cpms.test", role: "SUPERVISOR" };

const srsMilestone = {
  id: 10,
  teamId: 1,
  title: "SRS draft",
  description: "First version",
  deadline: "2026-11-08T16:59:00.000Z",
  createdAt: "2026-11-05T03:00:00.000Z",
  createdBy: { id: 7, name: "Supervisor One" },
};

const subV1 = {
  id: 101,
  milestoneId: 10,
  version: 1,
  title: "SRS draft v1",
  description: "Initial submission",
  link: "https://github.com/my-team/repo/pull/1",
  submittedAt: "2026-11-08T10:00:00.000Z",
  daysLate: 0,
  submittedBy: { id: 1, name: "Student One" },
};

const subV2 = {
  id: 102,
  milestoneId: 10,
  version: 2,
  title: "SRS draft v2",
  description: "Fix comments",
  link: "https://github.com/my-team/repo/pull/2",
  submittedAt: "2026-11-09T02:00:00.000Z",
  daysLate: 1,
  submittedBy: { id: 1, name: "Student One" },
};

const subV3 = {
  id: 103,
  milestoneId: 10,
  version: 3,
  title: "SRS draft v3",
  description: "Final fixes",
  link: "https://github.com/my-team/repo/pull/3",
  submittedAt: "2026-11-09T15:00:00.000Z",
  daysLate: 1,
  submittedBy: { id: 2, name: "Student Two" },
};

function mockApi(me: object, handler: Handler) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const res =
      handler(url, init) ??
      (url.includes("/api/auth/me")
        ? { status: 200, body: { user: me } }
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

describe("F-03 Submissions UI", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("TEST-03-15: student views milestone detail, submissions list and submits a new version", async () => {
    const fetchMock = mockApi(student, (url, init) => {
      if (url.endsWith("/api/milestones/10") && !init?.method) {
        return { status: 200, body: { milestone: srsMilestone } };
      }
      if (url.endsWith("/api/milestones/10/submissions") && init?.method === "POST") {
        const sent = JSON.parse(String(init.body));
        return {
          status: 201,
          body: {
            submission: {
              ...subV2,
              title: sent.title,
              description: sent.description,
              link: sent.link,
            },
          },
        };
      }
      if (url.endsWith("/api/milestones/10/submissions")) {
        return { status: 200, body: { submissions: [subV1] } };
      }
    });

    startAt("/student/milestones/10");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "SRS draft" })).toBeInTheDocument();
    expect(screen.getByText("8 Nov 2026, 23:59 (ICT)")).toBeInTheDocument();

    // Check version 1 displayed with On time badge
    expect(await screen.findByText("Version 1: SRS draft v1")).toBeInTheDocument();
    expect(screen.getByText("On time")).toBeInTheDocument();

    // Fill submit form
    fireEvent.change(screen.getByLabelText("Submission title"), { target: { value: "SRS draft v2" } });
    fireEvent.change(screen.getByLabelText("Link"), { target: { value: "https://github.com/my-team/repo/pull/2" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit work" }));

    // Should list version 2
    expect(await screen.findByText("Version 2: SRS draft v2")).toBeInTheDocument();

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeDefined();
    expect(JSON.parse(String(postCall![1]!.body))).toEqual({
      title: "SRS draft v2",
      description: "",
      link: "https://github.com/my-team/repo/pull/2",
    });
  });

  it("TEST-03-16: when 3 versions exist, student sees notice and form is hidden", async () => {
    mockApi(student, (url) => {
      if (url.endsWith("/api/milestones/10")) {
        return { status: 200, body: { milestone: srsMilestone } };
      }
      if (url.endsWith("/api/milestones/10/submissions")) {
        return { status: 200, body: { submissions: [subV1, subV2, subV3] } };
      }
    });

    startAt("/student/milestones/10");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "SRS draft" })).toBeInTheDocument();
    expect(await screen.findByText("Version 1: SRS draft v1")).toBeInTheDocument();
    expect(screen.getByText("Version 2: SRS draft v2")).toBeInTheDocument();
    expect(screen.getByText("Version 3: SRS draft v3")).toBeInTheDocument();

    // Max versions message
    expect(await screen.findByText("Maximum of 3 versions reached for this milestone.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit work" })).not.toBeInTheDocument();
  });

  it("TEST-03-17: supervisor views milestone submissions without submission form", async () => {
    mockApi(supervisor, (url) => {
      if (url.endsWith("/api/milestones/10")) {
        return { status: 200, body: { milestone: srsMilestone } };
      }
      if (url.endsWith("/api/milestones/10/submissions")) {
        return { status: 200, body: { submissions: [subV1] } };
      }
    });

    startAt("/supervisor/milestones/10");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "SRS draft" })).toBeInTheDocument();
    expect(await screen.findByText("Version 1: SRS draft v1")).toBeInTheDocument();
    expect(screen.getByText("Student One", { exact: false })).toBeInTheDocument();

    // Supervisor has NO submit form
    expect(screen.queryByRole("button", { name: "Submit work" })).not.toBeInTheDocument();
  });
});
