import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../src/App.js";

// Defect #94 group A (DEF-DEADLINE): a Deadline value the browser cannot convert (five-digit year typo)
// shows "Invalid date" and sends no request (F-02 v0.5 TEST-02-18, F-05 v0.5 TEST-05-12).

type MockResponse = { status: number; body?: unknown };
type Handler = (url: string, init?: RequestInit) => MockResponse | undefined;

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
  deadline: "2026-11-08T16:59:30.000Z",
  createdAt: "2026-11-05T03:00:00.000Z",
  createdBy: { id: 7, name: "Supervisor One" },
};

function mockApi(handler: Handler) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const res = handler(url, init) ??
      (url.includes("/api/auth/me") ? { status: 200, body: { user: supervisor } } : { status: 200, body: {} });
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

const writes = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "POST" || init?.method === "PATCH");

describe("#94 DEF-DEADLINE: client date check", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("TEST-02-18: Create milestone with a five-digit year shows \"Invalid date\" and sends no request", async () => {
    const fetchMock = mockApi((url, init) => {
      if (init?.method) return { status: 201, body: { milestone } };
      if (url.endsWith("/api/teams/1")) return { status: 200, body: { team: alpha } };
      if (url.endsWith("/api/teams/1/milestones")) return { status: 200, body: { milestones: [] } };
      return undefined;
    });
    startAt("/supervisor/teams/1");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "New milestone" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Typo deadline" } });
    const deadline = screen.getByLabelText("Deadline");
    fireEvent.change(deadline, { target: { value: "20266-05-05T10:00" } });
    expect(deadline).toHaveValue("20266-05-05T10:00");
    fireEvent.click(screen.getByRole("button", { name: "Create milestone" }));

    expect(await screen.findByText("Invalid date")).toBeInTheDocument();
    expect(screen.queryByText(/Invalid time value/)).not.toBeInTheDocument();
    expect(writes(fetchMock)).toHaveLength(0);
  });

  it("TEST-05-12: Edit milestone with a five-digit year shows \"Invalid date\", sends no request and keeps the card", async () => {
    const fetchMock = mockApi((url, init) => {
      if (init?.method) return { status: 200, body: { milestone } };
      if (url.endsWith("/api/milestones/10")) return { status: 200, body: { milestone } };
      if (url.endsWith("/api/milestones/10/submissions")) return { status: 200, body: { submissions: [] } };
      return undefined;
    });
    startAt("/supervisor/milestones/10");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "SRS draft" })).toBeInTheDocument();
    const shownDeadline = screen.getByText(/8 Nov 2026/).textContent;

    fireEvent.click(screen.getByRole("button", { name: "Edit milestone" }));
    const form = screen.getByRole("form", { name: "Edit milestone" });
    const deadline = within(form).getByLabelText("Deadline");
    fireEvent.change(deadline, { target: { value: "20266-05-05T10:00" } });
    expect(deadline).toHaveValue("20266-05-05T10:00");
    fireEvent.click(within(form).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(within(form).getByText("Invalid date")).toBeInTheDocument());
    expect(screen.getByRole("form", { name: "Edit milestone" })).toBeInTheDocument();
    expect(writes(fetchMock)).toHaveLength(0);
    expect(screen.getByText(/8 Nov 2026/).textContent).toBe(shownDeadline);
  });
});
