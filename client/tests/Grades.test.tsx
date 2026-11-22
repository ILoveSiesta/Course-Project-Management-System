import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../src/App.js";

// F-08 Grades and grade release (contract docs/sprints/sprint-2/F-08-grades.md).

type MockResponse = { status: number; body?: unknown };
type Handler = (url: string, init?: RequestInit) => MockResponse | undefined;

const student = { id: 1, name: "Student One", email: "student1@cpms.test", role: "STUDENT" };
const supervisor = { id: 7, name: "Supervisor One", email: "supervisor1@cpms.test", role: "SUPERVISOR" };

const milestone = {
  id: 10,
  teamId: 1,
  title: "SRS draft",
  description: null,
  deadline: "2026-12-08T16:59:00.000Z",
  createdAt: "2026-11-05T03:00:00.000Z",
  createdBy: { id: 7, name: "Supervisor One" },
};

function version(v: number) {
  return {
    id: 100 + v,
    milestoneId: 10,
    version: v,
    title: `SRS draft v${v}`,
    description: null,
    link: `https://github.com/my-team/repo/pull/${v}`,
    submittedAt: `2026-11-0${v}T10:00:00.000Z`,
    daysLate: 0,
    submittedBy: { id: 1, name: "Student One" },
    feedback: [],
  };
}

const notGraded = { grade: null, released: false, releasedAt: null };
function graded(score: number, v: number, released = false) {
  return {
    grade: { score, version: v, submissionId: 100 + v, gradedBy: { id: 7, name: "Supervisor One" }, gradedAt: "2026-11-21T03:00:00.000Z" },
    released,
    releasedAt: released ? "2026-11-21T05:00:00.000Z" : null,
  };
}

function mockApi(me: object, handler: Handler) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const res =
      handler(url, init) ??
      (url.includes("/api/auth/me")
        ? { status: 200, body: { user: me } }
        : url.endsWith("/api/milestones/10") && !init?.method
          ? { status: 200, body: { milestone } }
          : url.endsWith("/api/milestones/10/submissions") && !init?.method
            ? { status: 200, body: { submissions: [version(1), version(2)] } }
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

describe("F-08 Grades UI", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("TEST-08-09: supervisor saves a grade on the latest version by default and releases it", async () => {
    let state: unknown = notGraded;
    const fetchMock = mockApi(supervisor, (url, init) => {
      if (url.endsWith("/api/milestones/10/grade") && init?.method === "PUT") {
        const sent = JSON.parse(String(init.body));
        state = graded(sent.score, sent.version);
        return { status: 200, body: state };
      }
      if (url.endsWith("/api/milestones/10/grade/release") && init?.method === "POST") {
        state = graded(85, 2, true);
        return { status: 200, body: state };
      }
      if (url.endsWith("/api/milestones/10/grade")) return { status: 200, body: state };
    });
    startAt("/supervisor/milestones/10");
    render(<App />);

    const card = await screen.findByRole("region", { name: "Grade" });
    expect(await within(card).findByText("Not graded yet")).toBeInTheDocument();
    expect(within(card).getByLabelText("Graded version")).toHaveValue("2");

    fireEvent.change(within(card).getByLabelText("Score"), { target: { value: "85" } });
    fireEvent.click(within(card).getByRole("button", { name: "Save grade" }));

    expect(await within(card).findByText("85 / 100 (graded on Version 2)")).toBeInTheDocument();
    expect(within(card).getByText("Not released")).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(put![1]!.body))).toEqual({ score: 85, version: 2 });

    fireEvent.click(within(card).getByRole("button", { name: "Release grade" }));
    expect(await within(card).findByText(/^Released:/)).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Save grade" })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Release grade" })).not.toBeInTheDocument();
  });

  it("TEST-08-10: a rule rejection from the API is shown in the Grade card", async () => {
    mockApi(supervisor, (url, init) => {
      if (url.endsWith("/api/milestones/10/grade") && init?.method === "PUT") {
        return {
          status: 409,
          body: {
            error: {
              code: "GRADE_RELEASED",
              message: "Grades for this milestone have been released and can no longer be changed",
            },
          },
        };
      }
      if (url.endsWith("/api/milestones/10/grade")) return { status: 200, body: graded(70, 1) };
    });
    startAt("/supervisor/milestones/10");
    render(<App />);

    const card = await screen.findByRole("region", { name: "Grade" });
    expect(await within(card).findByText("70 / 100 (graded on Version 1)")).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Save grade" }));

    expect(await within(card).findByRole("alert")).toHaveTextContent(
      "Grades for this milestone have been released and can no longer be changed"
    );
  });

  it("TEST-08-11: a student sees 'Grade not released' until release, then the grade and its version", async () => {
    mockApi(student, (url) => {
      if (url.endsWith("/api/milestones/10/grade")) return { status: 200, body: notGraded };
    });
    startAt("/student/milestones/10");
    render(<App />);

    const hiddenCard = await screen.findByRole("region", { name: "Grade" });
    expect(await within(hiddenCard).findByText("Grade not released")).toBeInTheDocument();
    expect(within(hiddenCard).queryByText(/\/ 100/)).not.toBeInTheDocument();

    cleanup();
    sessionStorage.clear();
    mockApi(student, (url) => {
      if (url.endsWith("/api/milestones/10/grade")) return { status: 200, body: graded(85, 1, true) };
    });
    startAt("/student/milestones/10");
    render(<App />);

    const shownCard = await screen.findByRole("region", { name: "Grade" });
    expect(await within(shownCard).findByText("85 / 100 (graded on Version 1)")).toBeInTheDocument();
  });

  it("TEST-08-12: disables Release grade with a notice after .form-actions while Score (incl. empty) or Graded version has unsaved changes", async () => {
    let current = { score: 80, version: 2, released: false };
    let releaseCalls = 0;
    const fetchMock = mockApi(supervisor, (url, init) => {
      if (url.endsWith("/api/milestones/10/grade") && init?.method === "PUT") {
        const sent = JSON.parse(String(init.body));
        current = { score: sent.score, version: sent.version, released: false };
        return { status: 200, body: graded(current.score, current.version, current.released) };
      }
      if (url.endsWith("/api/milestones/10/grade/release") && init?.method === "POST") {
        releaseCalls += 1;
        current = { ...current, released: true };
        return { status: 200, body: graded(current.score, current.version, current.released) };
      }
      if (url.endsWith("/api/milestones/10/grade")) {
        return { status: 200, body: graded(current.score, current.version, current.released) };
      }
    });
    startAt("/supervisor/milestones/10");
    render(<App />);

    const card = await screen.findByRole("region", { name: "Grade" });
    expect(await within(card).findByText("80 / 100 (graded on Version 2)")).toBeInTheDocument();

    const releaseButton = within(card).getByRole("button", { name: "Release grade" });
    expect(releaseButton).toBeEnabled();
    expect(within(card).queryByText("Save the grade before releasing")).not.toBeInTheDocument();

    // Changed score disables Release grade and renders notice after .form-actions in DOM order
    fireEvent.change(within(card).getByLabelText("Score"), { target: { value: "95" } });
    expect(within(card).getByRole("button", { name: "Release grade" })).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Save grade" })).toBeEnabled();
    const actions = releaseButton.closest(".form-actions");
    const notice = within(card).getByText("Save the grade before releasing");
    expect(actions).not.toBeNull();
    expect(actions!.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Release grade" }));
    expect(releaseCalls).toBe(0);

    // Clearing Score to empty keeps Release grade disabled with the notice
    fireEvent.change(within(card).getByLabelText("Score"), { target: { value: "" } });
    expect(within(card).getByRole("button", { name: "Release grade" })).toBeDisabled();
    expect(within(card).getByText("Save the grade before releasing")).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Release grade" }));
    expect(releaseCalls).toBe(0);

    // Reverting back to the stored score re-enables Release grade
    fireEvent.change(within(card).getByLabelText("Score"), { target: { value: "80" } });
    expect(within(card).getByRole("button", { name: "Release grade" })).toBeEnabled();
    expect(within(card).queryByText("Save the grade before releasing")).not.toBeInTheDocument();

    // Changed graded version also disables Release grade
    fireEvent.change(within(card).getByLabelText("Graded version"), { target: { value: "1" } });
    expect(within(card).getByRole("button", { name: "Release grade" })).toBeDisabled();
    expect(within(card).getByText("Save the grade before releasing")).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Release grade" }));
    expect(releaseCalls).toBe(0);

    // Changed score + version: saving sends typed values, re-enables Release grade, and releases the saved grade
    fireEvent.change(within(card).getByLabelText("Score"), { target: { value: "92" } });
    fireEvent.click(within(card).getByRole("button", { name: "Save grade" }));
    expect(await within(card).findByText("92 / 100 (graded on Version 1)")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Release grade" })).toBeEnabled();
    expect(within(card).queryByText("Save the grade before releasing")).not.toBeInTheDocument();

    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(putCall![1]!.body))).toEqual({ score: 92, version: 1 });

    fireEvent.click(within(card).getByRole("button", { name: "Release grade" }));
    expect(await within(card).findByText(/^Released:/)).toBeInTheDocument();
    expect(within(card).getByText("92 / 100 (graded on Version 1)")).toBeInTheDocument();
    expect(releaseCalls).toBe(1);
  });

  it("TEST-08-13: treats numerically equivalent score strings as unchanged before and after Save, while empty on stored 0 stays disabled", async () => {
    let current = { score: 80, version: 2, released: false };
    const fetchMock = mockApi(supervisor, (url, init) => {
      if (url.endsWith("/api/milestones/10/grade") && init?.method === "PUT") {
        const sent = JSON.parse(String(init.body));
        current = { score: sent.score, version: sent.version, released: false };
        return { status: 200, body: graded(current.score, current.version, current.released) };
      }
      if (url.endsWith("/api/milestones/10/grade")) {
        return { status: 200, body: graded(current.score, current.version, current.released) };
      }
    });
    startAt("/supervisor/milestones/10");
    render(<App />);

    const card = await screen.findByRole("region", { name: "Grade" });
    expect(await within(card).findByText("80 / 100 (graded on Version 2)")).toBeInTheDocument();

    for (const equiv of ["80.0", "8e1", "080"]) {
      fireEvent.change(within(card).getByLabelText("Score"), { target: { value: equiv } });
      expect(within(card).getByRole("button", { name: "Release grade" })).toBeEnabled();
      expect(within(card).queryByText("Save the grade before releasing")).not.toBeInTheDocument();
    }

    fireEvent.click(within(card).getByRole("button", { name: "Save grade" }));
    expect(await within(card).findByText("80 / 100 (graded on Version 2)")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Release grade" })).toBeEnabled();
    expect(within(card).queryByText("Save the grade before releasing")).not.toBeInTheDocument();
    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(putCall![1]!.body))).toEqual({ score: 80, version: 2 });

    cleanup();
    sessionStorage.clear();
    let zeroReleases = 0;
    mockApi(supervisor, (url, init) => {
      if (url.endsWith("/api/milestones/10/grade/release") && init?.method === "POST") {
        zeroReleases += 1;
        return { status: 200, body: graded(0, 2, true) };
      }
      if (url.endsWith("/api/milestones/10/grade")) {
        return { status: 200, body: graded(0, 2, false) };
      }
    });
    startAt("/supervisor/milestones/10");
    render(<App />);

    const zeroCard = await screen.findByRole("region", { name: "Grade" });
    expect(await within(zeroCard).findByText("0 / 100 (graded on Version 2)")).toBeInTheDocument();

    for (const equivZero of ["00", "-0"]) {
      fireEvent.change(within(zeroCard).getByLabelText("Score"), { target: { value: equivZero } });
      expect(within(zeroCard).getByRole("button", { name: "Release grade" })).toBeEnabled();
      expect(within(zeroCard).queryByText("Save the grade before releasing")).not.toBeInTheDocument();
    }

    fireEvent.change(within(zeroCard).getByLabelText("Score"), { target: { value: "" } });
    expect(within(zeroCard).getByRole("button", { name: "Release grade" })).toBeDisabled();
    expect(within(zeroCard).getByText("Save the grade before releasing")).toBeInTheDocument();
    fireEvent.click(within(zeroCard).getByRole("button", { name: "Release grade" }));
    expect(zeroReleases).toBe(0);
  });

  it("TEST-08-14: disables Score and Graded version inputs and keeps failed saves disabled during/after requests", async () => {
    let resolveSave!: (res: MockResponse) => void;
    let resolveRelease!: (res: MockResponse) => void;
    let saveAttempt = 0;

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/milestones/10/grade") && init?.method === "PUT") {
        saveAttempt += 1;
        return new Promise((resolve) => {
          resolveSave = (res) =>
            resolve({
              ok: res.status >= 200 && res.status < 300,
              status: res.status,
              json: async () => res.body,
            });
        });
      }
      if (url.endsWith("/api/milestones/10/grade/release") && init?.method === "POST") {
        return new Promise((resolve) => {
          resolveRelease = (res) =>
            resolve({
              ok: res.status >= 200 && res.status < 300,
              status: res.status,
              json: async () => res.body,
            });
        });
      }
      const res: MockResponse = url.includes("/api/auth/me")
        ? { status: 200, body: { user: supervisor } }
        : url.endsWith("/api/milestones/10") && !init?.method
          ? { status: 200, body: { milestone } }
          : url.endsWith("/api/milestones/10/submissions") && !init?.method
            ? { status: 200, body: { submissions: [version(1), version(2)] } }
            : url.endsWith("/api/milestones/10/grade")
              ? { status: 200, body: graded(80, 2) }
              : { status: 200, body: { status: "ok" } };
      return Promise.resolve({
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        json: async () => res.body,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    startAt("/supervisor/milestones/10");
    render(<App />);

    const card = await screen.findByRole("region", { name: "Grade" });
    expect(await within(card).findByText("80 / 100 (graded on Version 2)")).toBeInTheDocument();

    // Edit Score to 95 and click Save grade -> both inputs and buttons must stay disabled while PUT is in flight
    fireEvent.change(within(card).getByLabelText("Score"), { target: { value: "95" } });
    fireEvent.click(within(card).getByRole("button", { name: "Save grade" }));

    expect(within(card).getByLabelText("Score")).toBeDisabled();
    expect(within(card).getByLabelText("Graded version")).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Save grade" })).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Release grade" })).toBeDisabled();

    // Failed save leaves form edited and Release grade disabled
    resolveSave({
      status: 500,
      body: { error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } },
    });
    expect(await within(card).findByRole("alert")).toHaveTextContent("Unexpected server error");
    expect(within(card).getByLabelText("Score")).toBeEnabled();
    expect(within(card).getByLabelText("Graded version")).toBeEnabled();
    expect(within(card).getByRole("button", { name: "Save grade" })).toBeEnabled();
    expect(within(card).getByRole("button", { name: "Release grade" })).toBeDisabled();

    // Successful save re-enables Release grade, then Release grade disables both inputs while POST is in flight
    fireEvent.click(within(card).getByRole("button", { name: "Save grade" }));
    expect(saveAttempt).toBe(2);
    expect(within(card).getByLabelText("Score")).toBeDisabled();
    expect(within(card).getByLabelText("Graded version")).toBeDisabled();

    resolveSave({ status: 200, body: graded(95, 2) });
    expect(await within(card).findByText("95 / 100 (graded on Version 2)")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Release grade" })).toBeEnabled();

    fireEvent.click(within(card).getByRole("button", { name: "Release grade" }));
    expect(within(card).getByLabelText("Score")).toBeDisabled();
    expect(within(card).getByLabelText("Graded version")).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Save grade" })).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Release grade" })).toBeDisabled();

    resolveRelease({ status: 200, body: graded(95, 2, true) });
    expect(await within(card).findByText(/^Released:/)).toBeInTheDocument();
  });
});
