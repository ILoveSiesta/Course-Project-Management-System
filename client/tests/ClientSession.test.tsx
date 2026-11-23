import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../src/App.js";

// Defect #94 group B (DEF-CLIENT-SESSION): client session lifecycle and connection errors
// (F-01 v0.12 TEST-01-19..TEST-01-24, F-13 v0.12 TEST-13-21, SDS §3.2).

const ENDED = "Your session has ended. Please log in again.";
const CHECK = "Could not check your session. Check your connection and try again.";
const LOGOUT_FAILED = "Could not log out. Check your connection and try again.";
const NETWORK = "Cannot reach the server. Check your connection and try again.";
const DOWN_503 = "The server is not available right now (HTTP 503). Please try again later.";

const student = { id: 1, name: "Student One", email: "student1@cpms.test", role: "STUDENT" };
const supervisor = { id: 7, name: "Supervisor One", email: "supervisor1@cpms.test", role: "SUPERVISOR" };
const alpha = {
  id: 1,
  name: "Team Alpha",
  members: [{ id: 1, name: "Student One", email: "student1@cpms.test" }],
  supervisors: [{ id: 7, name: "Supervisor One", email: "supervisor1@cpms.test" }],
};

// A reply is a JSON response, an HTML (non-JSON) response, or a network failure.
type Reply =
  | { status: number; body?: unknown; delayMs?: number }
  | { status: number; html: string }
  | { network: true };
type Route = (url: string, init?: RequestInit) => Reply | undefined;

function mockFetch(route: Route) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const reply = route(url, init) ?? { status: 200, body: {} };
    if ("network" in reply) throw new TypeError("Failed to fetch");
    if ("html" in reply) {
      return {
        ok: reply.status >= 200 && reply.status < 300,
        status: reply.status,
        json: async () => {
          throw new SyntaxError(`Unexpected token '<', "${reply.html.slice(0, 15)}"... is not valid JSON`);
        },
      };
    }
    if (reply.delayMs) await new Promise((r) => setTimeout(r, reply.delayMs));
    return { ok: reply.status >= 200 && reply.status < 300, status: reply.status, json: async () => reply.body };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// Returns the replies in order, then repeats the last one.
function sequence(...replies: Reply[]) {
  let i = 0;
  return () => replies[Math.min(i++, replies.length - 1)];
}

const calls = (fetchMock: ReturnType<typeof mockFetch>, part: string, method?: string) =>
  fetchMock.mock.calls.filter(([url, init]) => String(url).includes(part) && (!method || init?.method === method));

function startAt(path: string, token: string | null = "test-token") {
  if (token) sessionStorage.setItem("cpms_token", token);
  window.history.pushState({}, "Test", path);
}

async function logInAsStudent() {
  fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "student1@cpms.test" } });
  fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "demo-password" } });
  fireEvent.click(screen.getByRole("button", { name: /Log in/i }));
}

describe("#94 DEF-CLIENT-SESSION", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("TEST-01-19: a 401 from an API call ends the session with a message; the message is gone after login", async () => {
    let teamsStatus = 401;
    const fetchMock = mockFetch((url, init) => {
      if (url.includes("/api/auth/login")) return { status: 200, body: { token: "new-token", user: student } };
      if (url.includes("/api/auth/me")) return { status: 200, body: { user: student } };
      if (url.endsWith("/api/teams")) return teamsStatus === 401
        ? { status: 401, body: { error: { code: "UNAUTHENTICATED", message: "Authentication required" } } }
        : { status: 200, body: { teams: [alpha] } };
      if (url.endsWith("/api/teams/1/milestones")) return { status: 200, body: { milestones: [] } };
      return undefined;
    });
    startAt("/student");
    render(<App />);

    expect(await screen.findByText(ENDED)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Log in/i })).toBeInTheDocument();
    expect(sessionStorage.getItem("cpms_token")).toBeNull();
    expect(calls(fetchMock, "/api/auth/logout")).toHaveLength(0);

    teamsStatus = 200;
    await logInAsStudent();
    expect(await screen.findByRole("heading", { name: /Student Dashboard/i })).toBeInTheDocument();
    expect(screen.queryByText(ENDED)).not.toBeInTheDocument();
  });

  it("TEST-01-19: a 401 from /api/auth/me on page load ends the session with the same message", async () => {
    mockFetch((url) =>
      url.includes("/api/auth/me")
        ? { status: 401, body: { error: { code: "UNAUTHENTICATED", message: "Token expired" } } }
        : undefined
    );
    startAt("/student");
    render(<App />);

    expect(await screen.findByText(ENDED)).toBeInTheDocument();
    expect(sessionStorage.getItem("cpms_token")).toBeNull();
  });

  it("TEST-01-20: a failed session check keeps the token and offers Try again", async () => {
    const me = sequence({ network: true }, { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Internal server error" } } }, { status: 200, body: { user: student } });
    const fetchMock = mockFetch((url) => {
      if (url.includes("/api/auth/me")) return me();
      if (url.endsWith("/api/teams")) return { status: 200, body: { teams: [alpha] } };
      if (url.endsWith("/api/teams/1/milestones")) return { status: 200, body: { milestones: [] } };
      return undefined;
    });
    startAt("/student");
    render(<App />);

    expect(await screen.findByText(CHECK)).toBeInTheDocument();
    expect(sessionStorage.getItem("cpms_token")).toBe("test-token");
    expect(screen.queryByRole("button", { name: /Log in/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(calls(fetchMock, "/api/auth/me").length).toBe(2));
    expect(await screen.findByText(CHECK)).toBeInTheDocument();
    expect(sessionStorage.getItem("cpms_token")).toBe("test-token");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: /Student Dashboard/i })).toBeInTheDocument();
    expect(screen.queryByText(CHECK)).not.toBeInTheDocument();
  });

  it("TEST-01-21: a failed logout keeps the user signed in with a message; a later 204 signs out", async () => {
    const logout = sequence({ network: true }, { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Internal server error" } } }, { status: 204 });
    mockFetch((url) => {
      if (url.includes("/api/auth/logout")) return logout();
      if (url.includes("/api/auth/me")) return { status: 200, body: { user: student } };
      if (url.endsWith("/api/teams")) return { status: 200, body: { teams: [alpha] } };
      if (url.endsWith("/api/teams/1/milestones")) return { status: 200, body: { milestones: [] } };
      return undefined;
    });
    startAt("/student");
    render(<App />);
    expect(await screen.findByRole("heading", { name: /Student Dashboard/i })).toBeInTheDocument();

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      fireEvent.click(screen.getByRole("button", { name: /Log out/i }));
      expect(await screen.findByText(LOGOUT_FAILED)).toBeInTheDocument();
      expect(sessionStorage.getItem("cpms_token"), `attempt ${attempt}`).toBe("test-token");
      expect(screen.getByRole("heading", { name: /Student Dashboard/i })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: /Log out/i }));
    expect(await screen.findByRole("button", { name: /Log in/i })).toBeInTheDocument();
    expect(sessionStorage.getItem("cpms_token")).toBeNull();
    expect(screen.queryByText(LOGOUT_FAILED)).not.toBeInTheDocument();
  });

  it("TEST-01-21: a 401 on logout signs out without an error", async () => {
    mockFetch((url) => {
      if (url.includes("/api/auth/logout")) return { status: 401, body: { error: { code: "UNAUTHENTICATED", message: "Token revoked" } } };
      if (url.includes("/api/auth/me")) return { status: 200, body: { user: student } };
      if (url.endsWith("/api/teams")) return { status: 200, body: { teams: [] } };
      return undefined;
    });
    startAt("/student");
    render(<App />);
    expect(await screen.findByRole("heading", { name: /Student Dashboard/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Log out/i }));
    expect(await screen.findByRole("button", { name: /Log in/i })).toBeInTheDocument();
    expect(sessionStorage.getItem("cpms_token")).toBeNull();
    expect(screen.queryByText(LOGOUT_FAILED)).not.toBeInTheDocument();
    expect(screen.queryByText(ENDED)).not.toBeInTheDocument();
  });

  it("TEST-01-22: a slow session response after logout does not sign the user back in", async () => {
    mockFetch((url) => {
      if (url.includes("/api/auth/login")) return { status: 200, body: { token: "fresh-token", user: student } };
      if (url.includes("/api/auth/me")) return { status: 200, body: { user: student }, delayMs: 300 };
      if (url.includes("/api/auth/logout")) return { status: 204 };
      if (url.endsWith("/api/teams")) return { status: 200, body: { teams: [] } };
      return undefined;
    });
    startAt("/login", null);
    render(<App />);

    await logInAsStudent();
    fireEvent.click(await screen.findByRole("button", { name: /Log out/i }));
    expect(await screen.findByRole("button", { name: /Log in/i })).toBeInTheDocument();

    await new Promise((r) => setTimeout(r, 600));
    expect(screen.getByRole("button", { name: /Log in/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Log out/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Student One")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("cpms_token")).toBeNull();
  });

  it("TEST-01-23: login shows a connection message and the HTTP 503 message, not raw errors", async () => {
    const login = sequence({ network: true }, { status: 503, html: "<!DOCTYPE html><html><body>Service Unavailable</body></html>" });
    mockFetch((url) => (url.includes("/api/auth/login") ? login() : undefined));
    startAt("/login", null);
    render(<App />);

    await logInAsStudent();
    expect(await screen.findByText(NETWORK)).toBeInTheDocument();
    await logInAsStudent();
    expect(await screen.findByText(DOWN_503)).toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch|Unexpected token|not valid JSON/)).not.toBeInTheDocument();
  });

  it("TEST-01-24: other forms show the same connection and HTTP 503 messages", async () => {
    const create = sequence({ network: true }, { status: 503, html: "<html>Service Unavailable</html>" });
    mockFetch((url, init) => {
      if (url.includes("/api/auth/me")) return { status: 200, body: { user: supervisor } };
      if (url.endsWith("/api/teams/1/milestones") && init?.method === "POST") return create();
      if (url.endsWith("/api/teams/1")) return { status: 200, body: { team: alpha } };
      if (url.endsWith("/api/teams/1/milestones")) return { status: 200, body: { milestones: [] } };
      return undefined;
    });
    startAt("/supervisor/teams/1");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "New milestone" })).toBeInTheDocument();

    const fill = () => {
      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Design review" } });
      fireEvent.change(screen.getByLabelText("Deadline"), { target: { value: "2030-01-01T10:00" } });
      fireEvent.click(screen.getByRole("button", { name: "Create milestone" }));
    };
    fill();
    expect(await screen.findByText(NETWORK)).toBeInTheDocument();
    fill();
    expect(await screen.findByText(DOWN_503)).toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch|Request failed/)).not.toBeInTheDocument();
  });

  it("TEST-13-21: the student picker shows a load error when the list cannot be loaded", async () => {
    mockFetch((url) => {
      if (url.includes("/api/auth/me")) return { status: 200, body: { user: supervisor } };
      if (url.endsWith("/api/teams/available-students"))
        return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Internal server error" } } };
      if (url.endsWith("/api/teams/1")) return { status: 200, body: { team: alpha } };
      if (url.endsWith("/api/teams/1/milestones")) return { status: 200, body: { milestones: [] } };
      return undefined;
    });
    startAt("/supervisor/teams/1");
    render(<App />);

    expect(await screen.findByRole("option", { name: "Could not load students" })).toBeInTheDocument();
    expect(screen.getByText("Could not load the list of unassigned students. Reload the page to try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add member" })).toBeDisabled();
    expect(screen.queryByText("No unassigned students available")).not.toBeInTheDocument();
  });

  it("TEST-13-21: an empty list still shows \"No unassigned students available\" without an alert", async () => {
    mockFetch((url) => {
      if (url.includes("/api/auth/me")) return { status: 200, body: { user: supervisor } };
      if (url.endsWith("/api/teams/available-students")) return { status: 200, body: { students: [] } };
      if (url.endsWith("/api/teams/1")) return { status: 200, body: { team: alpha } };
      if (url.endsWith("/api/teams/1/milestones")) return { status: 200, body: { milestones: [] } };
      return undefined;
    });
    startAt("/supervisor/teams/1");
    render(<App />);

    expect(await screen.findByRole("option", { name: "No unassigned students available" })).toBeInTheDocument();
    expect(screen.queryByText(/Could not load/)).not.toBeInTheDocument();
  });
});
