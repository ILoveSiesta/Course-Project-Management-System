import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../src/App.js";

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

const milestone = {
  id: 10,
  teamId: 1,
  title: "SRS draft",
  description: "First version",
  deadline: new Date(Date.now() + 30 * 86_400_000).toISOString(),
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

function mockApi(me: object | null, handler: Handler) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const res =
      handler(url, init) ??
      (url.includes("/api/auth/me") && me
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

function startAt(path: string, authenticated = true) {
  if (authenticated) sessionStorage.setItem("cpms_token", "test-token");
  else sessionStorage.removeItem("cpms_token");
  window.history.pushState({}, "Test", path);
}

describe("Defect #90 UI rejection messages (NFR-12)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("TEST-90-UI01: Login shows the API unsupported-character reason instead of 'required'", async () => {
    mockApi(null, (url, init) => {
      if (url.endsWith("/api/auth/login") && init?.method === "POST") {
        return {
          status: 400,
          body: {
            error: {
              code: "VALIDATION_ERROR",
              message: "Email or password contains an unsupported character",
              details: { password: "INVALID_CHARACTER" },
            },
          },
        };
      }
    });
    startAt("/login", false);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "student1@cpms.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pass\u0000" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Email or password contains an unsupported character");
    expect(alert).not.toHaveTextContent(/required/i);
  });

  it("TEST-90-UI02: F-13 SupervisorHome renders 'Contains an unsupported character' instead of INVALID_CHARACTER", async () => {
    mockApi(supervisor, (url, init) => {
      if (url.endsWith("/api/teams") && !init?.method) return { status: 200, body: { teams: [alpha] } };
      if (url.endsWith("/api/teams") && init?.method === "POST") {
        return {
          status: 400,
          body: { error: { code: "VALIDATION_ERROR", message: "Invalid team", details: { name: "INVALID_CHARACTER" } } },
        };
      }
    });
    startAt("/supervisor");
    render(<App />);

    await screen.findByRole("heading", { name: "Team Alpha" });
    fireEvent.change(screen.getByLabelText("Team name"), { target: { value: "Team\u0000" } });
    fireEvent.click(screen.getByRole("button", { name: "Create team" }));

    expect(await screen.findByText("Contains an unsupported character")).toBeInTheDocument();
    expect(screen.queryByText(/INVALID_CHARACTER/)).not.toBeInTheDocument();
  });

  it("TEST-90-UI03: F-02 SupervisorTeam New milestone renders 'Contains an unsupported character' instead of INVALID_CHARACTER", async () => {
    mockApi(supervisor, (url, init) => {
      if (url.endsWith("/api/teams/1") && !init?.method) return { status: 200, body: { team: alpha } };
      if (url.endsWith("/api/teams") && !init?.method) return { status: 200, body: { teams: [alpha] } };
      if (url.endsWith("/api/teams/available-students") && !init?.method) return { status: 200, body: { students: [] } };
      if (url.endsWith("/api/teams/1/milestones") && !init?.method) return { status: 200, body: { milestones: [] } };
      if (url.endsWith("/api/teams/1/milestones") && init?.method === "POST") {
        return {
          status: 400,
          body: {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid milestone",
              details: { title: "INVALID_CHARACTER", description: "INVALID_CHARACTER" },
            },
          },
        };
      }
    });
    startAt("/supervisor/teams/1");
    render(<App />);

    await screen.findByRole("heading", { name: "New milestone" });
    fireEvent.click(screen.getByRole("button", { name: "Create milestone" }));

    const matches = await screen.findAllByText("Contains an unsupported character");
    expect(matches).toHaveLength(2);
    expect(screen.queryByText(/INVALID_CHARACTER/)).not.toBeInTheDocument();
  });

  it("TEST-90-UI04: F-05 MilestoneEditForm renders 'Contains an unsupported character' instead of INVALID_CHARACTER", async () => {
    mockApi(supervisor, (url, init) => {
      if (url.endsWith("/api/milestones/10") && !init?.method) return { status: 200, body: { milestone } };
      if (url.endsWith("/api/milestones/10/submissions") && !init?.method) return { status: 200, body: { submissions: [] } };
      if (url.endsWith("/api/milestones/10") && init?.method === "PATCH") {
        return {
          status: 400,
          body: {
            error: { code: "VALIDATION_ERROR", message: "Invalid milestone", details: { title: "INVALID_CHARACTER" } },
          },
        };
      }
    });
    startAt("/supervisor/milestones/10");
    render(<App />);

    await screen.findByRole("heading", { name: "SRS draft" });
    fireEvent.click(screen.getByRole("button", { name: "Edit milestone" }));
    const form = screen.getByRole("form", { name: "Edit milestone" });
    fireEvent.change(within(form).getByLabelText("Title"), { target: { value: "SRS\u0000" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Contains an unsupported character")).toBeInTheDocument();
    expect(screen.queryByText(/INVALID_CHARACTER/)).not.toBeInTheDocument();
  });

  it("TEST-90-UI05: F-03 StudentMilestone renders 'Contains an unsupported character' instead of INVALID_CHARACTER", async () => {
    mockApi(student, (url, init) => {
      if (url.endsWith("/api/milestones/10") && !init?.method) return { status: 200, body: { milestone } };
      if (url.endsWith("/api/milestones/10/submissions") && !init?.method) return { status: 200, body: { submissions: [] } };
      if (url.endsWith("/api/milestones/10/submissions") && init?.method === "POST") {
        return {
          status: 400,
          body: {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid submission",
              details: { title: "INVALID_CHARACTER", link: "INVALID_CHARACTER" },
            },
          },
        };
      }
    });
    startAt("/student/milestones/10");
    render(<App />);

    await screen.findByRole("heading", { name: "SRS draft" });
    fireEvent.click(screen.getByRole("button", { name: "Submit work" }));

    const matches = await screen.findAllByText("Contains an unsupported character");
    expect(matches).toHaveLength(2);
    expect(screen.queryByText(/INVALID_CHARACTER/)).not.toBeInTheDocument();
  });

  it("TEST-90-UI06: F-04 FeedbackSection renders 'Contains an unsupported character' instead of INVALID_CHARACTER", async () => {
    mockApi(supervisor, (url, init) => {
      if (url.endsWith("/api/milestones/10") && !init?.method) return { status: 200, body: { milestone } };
      if (url.endsWith("/api/milestones/10/submissions") && !init?.method) {
        return { status: 200, body: { submissions: [version1] } };
      }
      if (url.endsWith("/api/submissions/101/feedback") && init?.method === "POST") {
        return {
          status: 400,
          body: {
            error: { code: "VALIDATION_ERROR", message: "Invalid feedback", details: { comment: "INVALID_CHARACTER" } },
          },
        };
      }
    });
    startAt("/supervisor/milestones/10");
    render(<App />);

    await screen.findByText(/Version 1: SRS v1/);
    fireEvent.change(screen.getByLabelText("Feedback for version 1"), { target: { value: "Bad\u0000" } });
    fireEvent.click(screen.getByRole("button", { name: "Add feedback" }));

    expect(await screen.findByText("Contains an unsupported character")).toBeInTheDocument();
    expect(screen.queryByText(/INVALID_CHARACTER/)).not.toBeInTheDocument();
  });
});
