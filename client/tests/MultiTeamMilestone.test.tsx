import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../src/App.js";

// F-06 Milestone for several teams (contract docs/sprints/sprint-2/F-06-multi-team-milestone.md).

type MockResponse = { status: number; body?: unknown };
type Handler = (url: string, init?: RequestInit) => MockResponse | undefined;

const supervisor = { id: 7, name: "Supervisor One", email: "supervisor1@cpms.test", role: "SUPERVISOR" };
const supervisorPerson = { id: 7, name: "Supervisor One", email: "supervisor1@cpms.test" };

const alpha = {
  id: 1,
  name: "Team Alpha",
  members: [{ id: 1, name: "Student One", email: "student1@cpms.test" }],
  supervisors: [supervisorPerson],
};
const beta = {
  id: 2,
  name: "Team Beta",
  members: [{ id: 3, name: "Student Three", email: "student3@cpms.test" }],
  supervisors: [supervisorPerson],
};

function milestoneFor(teamId: number, id: number, sent: { title: string; deadline: string }) {
  return {
    id,
    teamId,
    title: sent.title,
    description: null,
    deadline: sent.deadline,
    createdAt: "2026-11-21T03:00:00.000Z",
    createdBy: { id: 7, name: "Supervisor One" },
  };
}

function mockApi(handler: Handler) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const res =
      handler(url, init) ??
      (url.includes("/api/auth/me")
        ? { status: 200, body: { user: supervisor } }
        : url.endsWith("/api/teams") && !init?.method
          ? { status: 200, body: { teams: [alpha, beta] } }
          : url.endsWith("/api/teams/1") && !init?.method
            ? { status: 200, body: { team: alpha } }
            : url.endsWith("/api/teams/1/milestones") && !init?.method
              ? { status: 200, body: { milestones: [] } }
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

function startAtAlpha() {
  sessionStorage.setItem("cpms_token", "test-token");
  window.history.pushState({}, "Test", "/supervisor/teams/1");
}

async function fillForm() {
  fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Design review" } });
  fireEvent.change(screen.getByLabelText("Deadline"), { target: { value: "2026-12-01T10:00" } });
}

describe("F-06 Milestone for several teams UI", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("TEST-06-08: supervisor ticks another team and creates the milestone for both teams", async () => {
    const fetchMock = mockApi((url, init) => {
      if (url.endsWith("/api/milestones") && init?.method === "POST") {
        const sent = JSON.parse(String(init.body));
        return { status: 201, body: { milestones: [milestoneFor(1, 21, sent), milestoneFor(2, 22, sent)] } };
      }
    });
    startAtAlpha();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Team Alpha" })).toBeInTheDocument();
    const teams = await screen.findByRole("group", { name: "Teams" });
    const thisTeam = within(teams).getByLabelText("Team Alpha (this team)");
    expect(thisTeam).toBeChecked();
    expect(thisTeam).toBeDisabled();

    await fillForm();
    fireEvent.click(within(teams).getByLabelText("Team Beta"));
    fireEvent.click(screen.getByRole("button", { name: "Create milestone" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Milestone created for 2 teams: Team Alpha, Team Beta");
    const list = await screen.findByRole("list", { name: "Milestones" });
    expect(within(list).getByText("Design review")).toBeInTheDocument();

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post![0]).toMatch(/\/api\/milestones$/);
    expect(JSON.parse(String(post![1]!.body))).toEqual({
      teamIds: [1, 2],
      title: "Design review",
      description: "",
      deadline: new Date("2026-12-01T10:00").toISOString(),
    });
  });

  it("TEST-06-09: 404 and team-list errors from the multi-team request are shown and nothing is added", async () => {
    let attempt = 0;
    mockApi((url, init) => {
      if (url.endsWith("/api/milestones") && init?.method === "POST") {
        attempt += 1;
        return attempt === 1
          ? { status: 404, body: { error: { code: "NOT_FOUND", message: "Resource not found" } } }
          : {
              status: 400,
              body: { error: { code: "VALIDATION_ERROR", message: "Invalid team selection", details: { teamIds: "TOO_MANY" } } },
            };
      }
    });
    startAtAlpha();
    render(<App />);

    const teams = await screen.findByRole("group", { name: "Teams" });
    await fillForm();
    fireEvent.click(within(teams).getByLabelText("Team Beta"));

    fireEvent.click(screen.getByRole("button", { name: "Create milestone" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Resource not found");

    fireEvent.click(screen.getByRole("button", { name: "Create milestone" }));
    expect(await within(teams).findByText("Select at most 20 teams")).toBeInTheDocument();

    expect(screen.getByText("No milestones yet.")).toBeInTheDocument();
  });
});
