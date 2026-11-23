import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../src/App.js";

// Defect #102 (DEF-MILESTONE-STATE): contracts docs/sprints/sprint-2/F-08-grades.md (0.12)
// and docs/sprints/sprint-1/F-03-submission.md (0.7); SDS §3.2 (0.24).

type MockResponse = { status: number; body?: unknown };

const supervisor = { id: 7, name: "Supervisor One", email: "supervisor1@cpms.test", role: "SUPERVISOR" };
const student = { id: 1, name: "Student One", email: "student1@cpms.test", role: "STUDENT" };

const teamAlpha = {
  id: 1,
  name: "Team Alpha",
  members: [{ id: 1, name: "Student One", email: "student1@cpms.test" }],
  supervisors: [{ id: 7, name: "Supervisor One", email: "supervisor1@cpms.test" }],
};

function makeMilestone(id: number, title: string, deadline = "2027-12-08T16:59:00.000Z") {
  return {
    id,
    teamId: 1,
    title,
    description: `${title} description`,
    deadline,
    createdAt: "2026-11-05T03:00:00.000Z",
    createdBy: { id: 7, name: "Supervisor One" },
    status: "Not submitted",
  };
}

function makeSub(milestoneId: number, v: number) {
  return {
    id: milestoneId * 10 + v,
    milestoneId,
    version: v,
    title: `Work v${v}`,
    description: null,
    link: `https://example.com/${milestoneId}/${v}`,
    submittedAt: "2026-11-06T10:00:00.000Z",
    daysLate: 0,
    submittedBy: { id: 1, name: "Student One" },
    feedback: [],
  };
}

function graded(milestoneId: number, score: number, v: number, released = false) {
  return {
    grade: {
      score,
      version: v,
      submissionId: milestoneId * 10 + v,
      gradedBy: { id: 7, name: "Supervisor One" },
      gradedAt: "2026-11-21T03:00:00.000Z",
    },
    released,
    releasedAt: released ? "2026-11-21T05:00:00.000Z" : null,
  };
}

function deferred<T>() {
  let resolve!: (val: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function toJsonResponse(res: MockResponse) {
  return {
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    json: async () => res.body,
  };
}

function startAt(path: string) {
  sessionStorage.setItem("cpms_token", "test-token");
  window.history.pushState({}, "Test", path);
}

describe("Defect #102 route-param reset across Back/Forward (F-08, F-03, F-05)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("TEST-08-19: history.go(-2) from B to A resets to Loading while A loads (no wrong Save/Release) and link navigation control still works", async () => {
    const mA = makeMilestone(10, "Milestone A");
    const mB = makeMilestone(20, "Milestone B");
    let delayA = false;
    let deferredA: ReturnType<typeof deferred<MockResponse>> | null = null;
    let deferredSubsA: ReturnType<typeof deferred<MockResponse>> | null = null;
    let deferredGradeA: ReturnType<typeof deferred<MockResponse>> | null = null;

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/api/auth/me")) return Promise.resolve(toJsonResponse({ status: 200, body: { user: supervisor } }));
      if (url.endsWith("/api/teams/1")) return Promise.resolve(toJsonResponse({ status: 200, body: { team: teamAlpha } }));
      if (url.endsWith("/api/teams/1/milestones")) {
        return Promise.resolve(toJsonResponse({ status: 200, body: { milestones: [mA, mB] } }));
      }
      if (url.endsWith("/api/teams")) return Promise.resolve(toJsonResponse({ status: 200, body: { teams: [teamAlpha] } }));
      if (url.endsWith("/api/students/available")) return Promise.resolve(toJsonResponse({ status: 200, body: { students: [] } }));
      if (url.endsWith("/api/milestones/10") && delayA) {
        deferredA = deferred<MockResponse>();
        return deferredA.promise.then(toJsonResponse);
      }
      if (url.endsWith("/api/milestones/10/submissions") && delayA) {
        deferredSubsA = deferred<MockResponse>();
        return deferredSubsA.promise.then(toJsonResponse);
      }
      if (url.endsWith("/api/milestones/10/grade") && !init?.method && delayA) {
        deferredGradeA = deferred<MockResponse>();
        return deferredGradeA.promise.then(toJsonResponse);
      }
      if (url.endsWith("/api/milestones/10")) return Promise.resolve(toJsonResponse({ status: 200, body: { milestone: mA } }));
      if (url.endsWith("/api/milestones/10/submissions")) {
        return Promise.resolve(toJsonResponse({ status: 200, body: { submissions: [makeSub(10, 1)] } }));
      }
      if (url.endsWith("/api/milestones/10/grade") && !init?.method) {
        return Promise.resolve(toJsonResponse({ status: 200, body: graded(10, 80, 1) }));
      }
      if (url.endsWith("/api/milestones/20")) return Promise.resolve(toJsonResponse({ status: 200, body: { milestone: mB } }));
      if (url.endsWith("/api/milestones/20/submissions")) {
        return Promise.resolve(toJsonResponse({ status: 200, body: { submissions: [makeSub(20, 1)] } }));
      }
      if (url.endsWith("/api/milestones/20/grade") && !init?.method) {
        return Promise.resolve(toJsonResponse({ status: 200, body: graded(20, 70, 1) }));
      }
      return Promise.resolve(toJsonResponse({ status: 200, body: { status: "ok" } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    // Control: normal link navigation Team -> A -> Back to team -> B shows each milestone and grade accurately.
    startAt("/supervisor/teams/1");
    render(<App />);

    fireEvent.click(await screen.findByRole("link", { name: "Milestone A" }));
    expect(await screen.findByRole("heading", { name: "Milestone A" })).toBeInTheDocument();
    expect(await screen.findByText("80 / 100 (graded on Version 1)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "← Back to team" }));
    fireEvent.click(await screen.findByRole("link", { name: "Milestone B" }));
    expect(await screen.findByRole("heading", { name: "Milestone B" })).toBeInTheDocument();
    expect(await screen.findByText("70 / 100 (graded on Version 1)")).toBeInTheDocument();

    // Navigate back to A via history.go(-2) while A loads slowly.
    delayA = true;
    window.history.go(-2);
    await waitFor(() => expect(window.location.pathname).toBe("/supervisor/milestones/10"));

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Milestone B" })).not.toBeInTheDocument();
    expect(screen.queryByText("70 / 100 (graded on Version 1)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save grade" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Release grade" })).not.toBeInTheDocument();

    deferredA!.resolve({ status: 200, body: { milestone: mA } });
    deferredSubsA!.resolve({ status: 200, body: { submissions: [makeSub(10, 1)] } });
    deferredGradeA!.resolve({ status: 200, body: graded(10, 80, 1) });

    expect(await screen.findByRole("heading", { name: "Milestone A" })).toBeInTheDocument();
    expect(await screen.findByText("80 / 100 (graded on Version 1)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Release grade" })).toBeEnabled();
  });

  it("TEST-08-20: typed Score on B resets to A's stored grade after history.go(-2), even when both milestones share the same stored score and version", async () => {
    const mA = makeMilestone(10, "Milestone A");
    const mB = makeMilestone(20, "Milestone B");

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/api/auth/me")) return Promise.resolve(toJsonResponse({ status: 200, body: { user: supervisor } }));
      if (url.endsWith("/api/teams/1")) return Promise.resolve(toJsonResponse({ status: 200, body: { team: teamAlpha } }));
      if (url.endsWith("/api/teams/1/milestones")) {
        return Promise.resolve(toJsonResponse({ status: 200, body: { milestones: [mA, mB] } }));
      }
      if (url.endsWith("/api/teams")) return Promise.resolve(toJsonResponse({ status: 200, body: { teams: [teamAlpha] } }));
      if (url.endsWith("/api/students/available")) return Promise.resolve(toJsonResponse({ status: 200, body: { students: [] } }));
      if (url.endsWith("/api/milestones/10")) return Promise.resolve(toJsonResponse({ status: 200, body: { milestone: mA } }));
      if (url.endsWith("/api/milestones/10/submissions")) {
        return Promise.resolve(toJsonResponse({ status: 200, body: { submissions: [makeSub(10, 1), makeSub(10, 2)] } }));
      }
      if (url.endsWith("/api/milestones/10/grade/release") && init?.method === "POST") {
        return Promise.resolve(toJsonResponse({ status: 200, body: graded(10, 80, 2, true) }));
      }
      if (url.endsWith("/api/milestones/10/grade")) {
        return Promise.resolve(toJsonResponse({ status: 200, body: graded(10, 80, 2) }));
      }
      if (url.endsWith("/api/milestones/20")) return Promise.resolve(toJsonResponse({ status: 200, body: { milestone: mB } }));
      if (url.endsWith("/api/milestones/20/submissions")) {
        return Promise.resolve(toJsonResponse({ status: 200, body: { submissions: [makeSub(20, 1), makeSub(20, 2)] } }));
      }
      if (url.endsWith("/api/milestones/20/grade")) {
        return Promise.resolve(toJsonResponse({ status: 200, body: graded(20, 80, 2) }));
      }
      return Promise.resolve(toJsonResponse({ status: 200, body: { status: "ok" } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    startAt("/supervisor/teams/1");
    render(<App />);

    fireEvent.click(await screen.findByRole("link", { name: "Milestone A" }));
    expect(await screen.findByText("80 / 100 (graded on Version 2)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "← Back to team" }));
    fireEvent.click(await screen.findByRole("link", { name: "Milestone B" }));
    const cardB = await screen.findByRole("region", { name: "Grade" });
    expect(await within(cardB).findByText("80 / 100 (graded on Version 2)")).toBeInTheDocument();

    fireEvent.change(within(cardB).getByLabelText("Score"), { target: { value: "95" } });
    expect(within(cardB).getByText("Save the grade before releasing")).toBeInTheDocument();
    expect(within(cardB).getByRole("button", { name: "Release grade" })).toBeDisabled();

    window.history.go(-2);
    await waitFor(() => expect(window.location.pathname).toBe("/supervisor/milestones/10"));

    expect(await screen.findByRole("heading", { name: "Milestone A" })).toBeInTheDocument();
    const cardA = await screen.findByRole("region", { name: "Grade" });
    expect(await within(cardA).findByText("80 / 100 (graded on Version 2)")).toBeInTheDocument();
    expect(within(cardA).getByLabelText("Score")).toHaveValue(80);
    expect(within(cardA).getByLabelText("Graded version")).toHaveValue("2");
    expect(within(cardA).queryByText("Save the grade before releasing")).not.toBeInTheDocument();

    const releaseBtn = within(cardA).getByRole("button", { name: "Release grade" });
    expect(releaseBtn).toBeEnabled();
    fireEvent.click(releaseBtn);
    expect(await within(cardA).findByText(/^Released:/)).toBeInTheDocument();

    const releaseCalls = fetchMock.mock.calls.filter(
      ([url, init]) => String(url).endsWith("/api/milestones/10/grade/release") && init?.method === "POST"
    );
    expect(releaseCalls).toHaveLength(1);
    expect(JSON.parse(String(releaseCalls[0][1]?.body))).toEqual({ score: 80, version: 2 });
  });

  it("TEST-08-21: Edit milestone and Feedback drafts opened on B close and reset on history.go(-2) to A", async () => {
    const mA = makeMilestone(10, "Milestone A");
    const mB = makeMilestone(20, "Milestone B");

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/api/auth/me")) return Promise.resolve(toJsonResponse({ status: 200, body: { user: supervisor } }));
      if (url.endsWith("/api/teams/1")) return Promise.resolve(toJsonResponse({ status: 200, body: { team: teamAlpha } }));
      if (url.endsWith("/api/teams/1/milestones")) {
        return Promise.resolve(toJsonResponse({ status: 200, body: { milestones: [mA, mB] } }));
      }
      if (url.endsWith("/api/teams")) return Promise.resolve(toJsonResponse({ status: 200, body: { teams: [teamAlpha] } }));
      if (url.endsWith("/api/students/available")) return Promise.resolve(toJsonResponse({ status: 200, body: { students: [] } }));
      if (url.endsWith("/api/milestones/10")) return Promise.resolve(toJsonResponse({ status: 200, body: { milestone: mA } }));
      if (url.endsWith("/api/milestones/10/submissions")) {
        return Promise.resolve(toJsonResponse({ status: 200, body: { submissions: [makeSub(10, 1)] } }));
      }
      if (url.endsWith("/api/milestones/10/grade") && !init?.method) {
        return Promise.resolve(toJsonResponse({ status: 200, body: graded(10, 80, 1) }));
      }
      if (url.endsWith("/api/milestones/20")) return Promise.resolve(toJsonResponse({ status: 200, body: { milestone: mB } }));
      if (url.endsWith("/api/milestones/20/submissions")) {
        return Promise.resolve(toJsonResponse({ status: 200, body: { submissions: [makeSub(20, 1)] } }));
      }
      if (url.endsWith("/api/milestones/20/grade") && !init?.method) {
        return Promise.resolve(toJsonResponse({ status: 200, body: graded(20, 70, 1) }));
      }
      return Promise.resolve(toJsonResponse({ status: 200, body: { status: "ok" } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    startAt("/supervisor/teams/1");
    render(<App />);

    fireEvent.click(await screen.findByRole("link", { name: "Milestone A" }));
    expect(await screen.findByRole("heading", { name: "Milestone A" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "← Back to team" }));
    fireEvent.click(await screen.findByRole("link", { name: "Milestone B" }));
    expect(await screen.findByRole("heading", { name: "Milestone B" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit milestone" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Edited B title" } });
    fireEvent.change(screen.getByLabelText("Feedback for version 1"), { target: { value: "Draft feedback B" } });

    window.history.go(-2);
    await waitFor(() => expect(window.location.pathname).toBe("/supervisor/milestones/10"));

    expect(await screen.findByRole("heading", { name: "Milestone A" })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Edit milestone" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Feedback for version 1")).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Edit milestone" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Milestone A");
  });

  it("TEST-03-29: StudentMilestone resets to Loading and clears draft submission fields on history.go(-2) between milestones", async () => {
    const mA = makeMilestone(10, "Student Milestone A");
    const mB = makeMilestone(20, "Student Milestone B");
    let delayA = false;
    let deferredA: ReturnType<typeof deferred<MockResponse>> | null = null;
    let deferredSubsA: ReturnType<typeof deferred<MockResponse>> | null = null;

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/api/auth/me")) return Promise.resolve(toJsonResponse({ status: 200, body: { user: student } }));
      if (url.endsWith("/api/teams")) return Promise.resolve(toJsonResponse({ status: 200, body: { teams: [teamAlpha] } }));
      if (url.endsWith("/api/teams/1")) return Promise.resolve(toJsonResponse({ status: 200, body: { team: teamAlpha } }));
      if (url.endsWith("/api/teams/1/milestones")) {
        return Promise.resolve(toJsonResponse({ status: 200, body: { milestones: [mA, mB] } }));
      }
      if (url.endsWith("/api/milestones/10") && delayA) {
        deferredA = deferred<MockResponse>();
        return deferredA.promise.then(toJsonResponse);
      }
      if (url.endsWith("/api/milestones/10/submissions") && !init?.method && delayA) {
        deferredSubsA = deferred<MockResponse>();
        return deferredSubsA.promise.then(toJsonResponse);
      }
      if (url.endsWith("/api/milestones/10")) return Promise.resolve(toJsonResponse({ status: 200, body: { milestone: mA } }));
      if (url.endsWith("/api/milestones/10/submissions")) {
        return Promise.resolve(toJsonResponse({ status: 200, body: { submissions: [] } }));
      }
      if (url.endsWith("/api/milestones/20")) return Promise.resolve(toJsonResponse({ status: 200, body: { milestone: mB } }));
      if (url.endsWith("/api/milestones/20/submissions")) {
        return Promise.resolve(toJsonResponse({ status: 200, body: { submissions: [] } }));
      }
      if (url.endsWith("/grade")) {
        return Promise.resolve(toJsonResponse({ status: 200, body: { grade: null, released: false, releasedAt: null } }));
      }
      return Promise.resolve(toJsonResponse({ status: 200, body: { status: "ok" } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    startAt("/student");
    render(<App />);

    fireEvent.click(await screen.findByRole("link", { name: "Student Milestone A" }));
    expect(await screen.findByRole("heading", { name: "Student Milestone A" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "← My team" }));
    fireEvent.click(await screen.findByRole("link", { name: "Student Milestone B" }));
    expect(await screen.findByRole("heading", { name: "Student Milestone B" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Submission title"), { target: { value: "Draft for B" } });
    fireEvent.change(screen.getByLabelText("Link"), { target: { value: "https://example.com/b" } });

    delayA = true;
    window.history.go(-2);
    await waitFor(() => expect(window.location.pathname).toBe("/student/milestones/10"));

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Student Milestone B" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit work" })).not.toBeInTheDocument();

    deferredA!.resolve({ status: 200, body: { milestone: mA } });
    deferredSubsA!.resolve({ status: 200, body: { submissions: [] } });

    expect(await screen.findByRole("heading", { name: "Student Milestone A" })).toBeInTheDocument();
    expect(screen.getByLabelText("Submission title")).toHaveValue("");
    expect(screen.getByLabelText("Link")).toHaveValue("");
  });
});
