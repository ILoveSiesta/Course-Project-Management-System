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
  members: [
    { id: 1, name: "Student One", email: "student1@cpms.test" },
    { id: 2, name: "Student Two", email: "student2@cpms.test" },
  ],
  supervisors: [{ id: 7, name: "Supervisor One", email: "supervisor1@cpms.test" }],
};

const delta = {
  id: 4,
  name: "Team Delta",
  members: [],
  supervisors: [{ id: 7, name: "Supervisor One", email: "supervisor1@cpms.test" }],
};

const freeStudent = { id: 9, name: "Free Student", email: "free@cpms.test" };

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

describe("F-13 Team management UI", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("TEST-13-12: supervisor creates a new team on /supervisor and sees validation/conflict errors", async () => {
    let callNum = 0;
    const fetchMock = mockApi(supervisor, (url, init) => {
      if (url.endsWith("/api/teams") && !init?.method) return { status: 200, body: { teams: [alpha] } };
      if (url.endsWith("/api/teams") && init?.method === "POST") {
        callNum++;
        if (callNum === 1) {
          return {
            status: 400,
            body: { error: { code: "VALIDATION_ERROR", message: "Invalid team", details: { name: "REQUIRED" } } },
          };
        }
        if (callNum === 2) {
          return {
            status: 409,
            body: { error: { code: "TEAM_NAME_EXISTS", message: "A team with this name already exists" } },
          };
        }
        return { status: 201, body: { team: delta } };
      }
    });
    startAt("/supervisor");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Team Alpha" })).toBeInTheDocument();

    // 400 REQUIRED
    fireEvent.click(screen.getByRole("button", { name: "Create team" }));
    expect(await screen.findByText("Required")).toBeInTheDocument();

    // 409 TEAM_NAME_EXISTS
    fireEvent.change(screen.getByLabelText("Team name"), { target: { value: "Team Alpha" } });
    fireEvent.click(screen.getByRole("button", { name: "Create team" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A team with this name already exists");

    // 201 created
    fireEvent.change(screen.getByLabelText("Team name"), { target: { value: "Team Delta" } });
    fireEvent.click(screen.getByRole("button", { name: "Create team" }));
    expect(await screen.findByRole("heading", { name: "Team Delta" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith("/api/teams") && i?.method === "POST")).toBe(true);
  });

  it("TEST-13-13: supervisor adds an unassigned student and removes a member on /supervisor/teams/:id", async () => {
    let currentTeam = { ...alpha, members: [...alpha.members] };
    let available = [freeStudent];
    let rejectNextAdd = true;

    mockApi(supervisor, (url, init) => {
      if (url.endsWith("/api/teams/1") && !init?.method) return { status: 200, body: { team: currentTeam } };
      if (url.endsWith("/api/teams/1/milestones")) return { status: 200, body: { milestones: [] } };
      if (url.endsWith("/api/teams")) return { status: 200, body: { teams: [currentTeam] } };
      if (url.endsWith("/api/teams/available-students")) return { status: 200, body: { students: available } };
      if (url.endsWith("/api/teams/1/members") && init?.method === "POST") {
        if (rejectNextAdd) {
          rejectNextAdd = false;
          return {
            status: 409,
            body: { error: { code: "STUDENT_ALREADY_IN_TEAM", message: "Student already belongs to a team" } },
          };
        }
        currentTeam = { ...currentTeam, members: [...currentTeam.members, freeStudent] };
        available = [];
        return { status: 201, body: { team: currentTeam } };
      }
      if (url.endsWith("/api/teams/1/members/2") && init?.method === "DELETE") {
        const removed = currentTeam.members.find((m) => m.id === 2)!;
        currentTeam = { ...currentTeam, members: currentTeam.members.filter((m) => m.id !== 2) };
        available = [...available, removed];
        return { status: 200, body: { team: currentTeam } };
      }
    });
    startAt("/supervisor/teams/1");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Team Alpha" })).toBeInTheDocument();
    const select = (await screen.findByLabelText("Student")) as HTMLSelectElement;
    await within(select).findByRole("option", { name: "Free Student (free@cpms.test)" });

    // 409 shows alert without changing members
    fireEvent.change(select, { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Student already belongs to a team");

    // 201 adds member and updates list
    fireEvent.change(select, { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));
    expect(await screen.findByText(/Free Student \(free@cpms.test\)/)).toBeInTheDocument();

    // 200 removes Student Two
    fireEvent.click(screen.getByRole("button", { name: "Remove Student Two" }));
    expect(await screen.findByText(/Removed Student Two/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Student Two" })).toBeNull();
  });

  it("TEST-13-14: student home stays read-only with empty-team and zero-member states", async () => {
    mockApi(student, (url) => {
      if (url.endsWith("/api/teams")) return { status: 200, body: { teams: [delta] } };
      if (url.endsWith("/api/teams/4/milestones")) return { status: 200, body: { milestones: [] } };
    });
    startAt("/student");
    const { unmount } = render(<App />);

    expect(await screen.findByText("No members yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create team" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add member" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    unmount();

    mockApi(student, (url) => {
      if (url.endsWith("/api/teams")) return { status: 200, body: { teams: [] } };
    });
    startAt("/student");
    render(<App />);
    expect(await screen.findByText("You are not assigned to a team yet.")).toBeInTheDocument();
  });
});
