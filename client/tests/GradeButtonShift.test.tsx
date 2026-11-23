import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../src/App.js";

// Defect #103 (DEF-GRADE-BUTTON-SHIFT): F-08 contract v0.16 §3 button layout rule, AC-08-14.
// jsdom has no layout, so this test checks the structure the rule needs; the browser check is TEST-08-23.

type MockResponse = { status: number; body?: unknown };

const supervisor = { id: 7, name: "Supervisor One", email: "supervisor1@cpms.test", role: "SUPERVISOR" };
const milestone = {
  id: 10,
  teamId: 1,
  title: "SRS draft",
  description: null,
  deadline: "2027-12-08T16:59:00.000Z",
  createdAt: "2026-11-05T03:00:00.000Z",
  createdBy: { id: 7, name: "Supervisor One" },
};
const submission = {
  id: 101,
  milestoneId: 10,
  version: 1,
  title: "SRS draft v1",
  description: null,
  link: "https://github.com/my-team/repo/pull/1",
  submittedAt: "2026-11-01T10:00:00.000Z",
  daysLate: 0,
  submittedBy: { id: 1, name: "Student One" },
  feedback: [],
};
const graded = (score: number) => ({
  grade: { score, version: 1, submissionId: 101, gradedBy: { id: 7, name: "Supervisor One" }, gradedAt: "2026-11-21T03:00:00.000Z" },
  released: false,
  releasedAt: null,
});

function mockApi(grade: () => MockResponse, put: () => MockResponse) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    let res: MockResponse = { status: 200, body: { status: "ok" } };
    if (url.includes("/api/auth/me")) res = { status: 200, body: { user: supervisor } };
    else if (url.endsWith("/api/milestones/10") && !init?.method) res = { status: 200, body: { milestone } };
    else if (url.endsWith("/api/milestones/10/submissions")) res = { status: 200, body: { submissions: [submission] } };
    else if (url.endsWith("/api/milestones/10/grade") && init?.method === "PUT") res = put();
    else if (url.endsWith("/api/milestones/10/grade")) res = grade();
    return Promise.resolve({ ok: res.status >= 200 && res.status < 300, status: res.status, json: async () => res.body });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function startAt(path: string) {
  sessionStorage.setItem("cpms_token", "test-token");
  window.history.pushState({}, "Test", path);
}

const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe("Defect #103 Grade card button layout (F-08 v0.16)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("TEST-08-22: the card alert comes after the one-row actions container that holds Save grade and Release grade", async () => {
    let puts = 0;
    mockApi(
      () => ({ status: 200, body: graded(80) }),
      () => {
        puts += 1;
        return puts === 1
          ? { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } } }
          : { status: 200, body: graded(95) };
      }
    );
    startAt("/supervisor/milestones/10");
    render(<App />);

    const card = await screen.findByRole("region", { name: "Grade" });
    expect(await within(card).findByText("80 / 100 (graded on Version 1)")).toBeInTheDocument();

    const save = within(card).getByRole("button", { name: "Save grade" });
    const release = within(card).getByRole("button", { name: "Release grade" });
    const actions = save.parentElement!;
    expect(release.parentElement).toBe(actions);

    fireEvent.change(within(card).getByLabelText("Score"), { target: { value: "95" } });
    fireEvent.click(save);
    const alert = await within(card).findByRole("alert");
    expect(alert).toHaveTextContent("Unexpected server error");
    // The alert must not sit above the buttons: when it clears on the retry the buttons would move.
    expect(follows(actions, alert)).toBe(true);
    expect(actions).toHaveClass("form-actions");
    expect(actions).toHaveClass("grade-actions");

    // Control: the retry saves, the alert clears, and one click on Release grade still releases.
    fireEvent.click(within(card).getByRole("button", { name: "Save grade" }));
    expect(await within(card).findByText("95 / 100 (graded on Version 1)")).toBeInTheDocument();
    expect(within(card).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Release grade" })).toBeEnabled();
  });

  it("TEST-08-22: with no grade yet the same one-row container holds Save grade only", async () => {
    mockApi(
      () => ({ status: 200, body: { grade: null, released: false, releasedAt: null } }),
      () => ({ status: 200, body: graded(95) })
    );
    startAt("/supervisor/milestones/10");
    render(<App />);

    const card = await screen.findByRole("region", { name: "Grade" });
    expect(await within(card).findByText("Not graded yet")).toBeInTheDocument();
    const save = within(card).getByRole("button", { name: "Save grade" });
    expect(save.parentElement).toHaveClass("grade-actions");
    expect(within(card).queryByRole("button", { name: "Release grade" })).not.toBeInTheDocument();

    fireEvent.change(within(card).getByLabelText("Score"), { target: { value: "95" } });
    fireEvent.click(save);
    expect(await within(card).findByText("95 / 100 (graded on Version 1)")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Release grade" }).parentElement).toBe(save.parentElement);
  });
});
