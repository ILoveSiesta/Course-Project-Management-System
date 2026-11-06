import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../src/App.js";

type MockResponse = { status: number; body?: unknown };
type Handler = (url: string, init?: RequestInit) => MockResponse | undefined;

const student = { id: 1, name: "Student One", email: "student1@cpms.test", role: "STUDENT" };
const supervisor = { id: 7, name: "Supervisor One", email: "supervisor1@cpms.test", role: "SUPERVISOR" };

const milestone = {
  id: 10,
  teamId: 1,
  title: "SRS draft",
  description: null,
  deadline: "2026-11-08T16:59:00.000Z",
  createdAt: "2026-11-05T03:00:00.000Z",
  createdBy: { id: 7, name: "Supervisor One" },
};

const version1 = {
  id: 101,
  milestoneId: 10,
  version: 1,
  title: "SRS v1",
  description: null,
  link: "https://github.com/alpha/repo/pull/1",
  submittedAt: "2026-11-07T03:00:00.000Z",
  daysLate: 0,
  submittedBy: { id: 1, name: "Student One" },
  feedback: [] as unknown[],
};

const reviewNote = {
  id: 501,
  submissionId: 101,
  comment: "Add measurable NFR targets.",
  createdAt: "2026-11-07T05:30:00.000Z",
  author: { id: 7, name: "Supervisor One" },
};

function mockApi(me: object, handler: Handler) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const res =
      handler(url, init) ??
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

function milestoneRoutes(submissions: unknown[]): Handler {
  return (url, init) => {
    if (url.endsWith("/api/milestones/10") && !init?.method) return { status: 200, body: { milestone } };
    if (url.endsWith("/api/milestones/10/submissions") && !init?.method) return { status: 200, body: { submissions } };
  };
}

describe("F-04 Feedback UI", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("TEST-04-11: supervisor adds feedback to a version and sees it listed", async () => {
    const routes = milestoneRoutes([version1]);
    const fetchMock = mockApi(supervisor, (url, init) => {
      if (url.endsWith("/api/submissions/101/feedback") && init?.method === "POST") {
        const sent = JSON.parse(String(init.body));
        return { status: 201, body: { feedback: { ...reviewNote, comment: sent.comment } } };
      }
      return routes(url, init);
    });
    startAt("/supervisor/milestones/10");

    render(<App />);

    const item = (await screen.findByText(/Version 1: SRS v1/)).closest("li")!;
    expect(within(item).getByText("No feedback yet.")).toBeInTheDocument();

    fireEvent.change(within(item).getByLabelText("Feedback for version 1"), {
      target: { value: "Please add a sequence diagram." },
    });
    fireEvent.click(within(item).getByRole("button", { name: "Add feedback" }));

    expect(await within(item).findByText("Please add a sequence diagram.")).toBeInTheDocument();
    expect(within(item).queryByText("No feedback yet.")).not.toBeInTheDocument();

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post).toBeDefined();
    expect(JSON.parse(String(post![1]!.body))).toEqual({ comment: "Please add a sequence diagram." });
    expect((post![1]!.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
  });

  it("TEST-04-12: supervisor sees the API validation error under the feedback field", async () => {
    const routes = milestoneRoutes([version1]);
    mockApi(supervisor, (url, init) => {
      if (url.endsWith("/api/submissions/101/feedback") && init?.method === "POST") {
        return {
          status: 400,
          body: { error: { code: "VALIDATION_ERROR", message: "Invalid feedback", details: { comment: "REQUIRED" } } },
        };
      }
      return routes(url, init);
    });
    startAt("/supervisor/milestones/10");

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Add feedback" }));

    expect(await screen.findByText("Required")).toBeInTheDocument();
  });

  it("TEST-04-13: student sees feedback with author and ICT time, without a feedback form", async () => {
    mockApi(student, milestoneRoutes([{ ...version1, feedback: [reviewNote] }]));
    startAt("/student/milestones/10");

    render(<App />);

    expect(await screen.findByText("Add measurable NFR targets.")).toBeInTheDocument();
    expect(screen.getByText("by Supervisor One on 7 Nov 2026, 12:30 (ICT)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add feedback" })).not.toBeInTheDocument();
  });
});
