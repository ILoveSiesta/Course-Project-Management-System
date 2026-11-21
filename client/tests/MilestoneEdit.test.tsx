import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../src/App.js";

// F-05 Milestone editing and deadline extension UI (contract docs/sprints/sprint-2/F-05-milestone-edit.md).

type MockResponse = { status: number; body?: unknown };
type Handler = (url: string, init?: RequestInit) => MockResponse | undefined;

const supervisor = { id: 7, name: "Supervisor One", email: "supervisor1@cpms.test", role: "SUPERVISOR" };

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
      (url.includes("/api/auth/me") ? { status: 200, body: { user: supervisor } } : { status: 200, body: { status: "ok" } });
    return Promise.resolve({
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      json: async () => res.body,
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function milestoneReads(url: string, init?: RequestInit): MockResponse | undefined {
  if (init?.method) return undefined;
  if (url.endsWith("/api/milestones/10")) return { status: 200, body: { milestone } };
  if (url.endsWith("/api/milestones/10/submissions")) return { status: 200, body: { submissions: [] } };
  return undefined;
}

function startAt(path: string) {
  sessionStorage.setItem("cpms_token", "test-token");
  window.history.pushState({}, "Test", path);
}

async function openEditForm() {
  render(<App />);
  expect(await screen.findByRole("heading", { name: "SRS draft" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit milestone" }));
  return screen.getByRole("form", { name: "Edit milestone" });
}

describe("F-05 Milestone editing UI", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("TEST-05-09: supervisor edits the title and extends the deadline; only changed fields are sent", async () => {
    const fetchMock = mockApi((url, init) => {
      if (url.endsWith("/api/milestones/10") && init?.method === "PATCH") {
        const sent = JSON.parse(String(init.body));
        return { status: 200, body: { milestone: { ...milestone, ...sent } } };
      }
      return milestoneReads(url, init);
    });
    startAt("/supervisor/milestones/10");

    const form = await openEditForm();
    expect(within(form).getByLabelText("Title")).toHaveValue("SRS draft");
    expect(within(form).getByLabelText("Description")).toHaveValue("First version");

    fireEvent.change(within(form).getByLabelText("Title"), { target: { value: "SRS final" } });
    fireEvent.change(within(form).getByLabelText("Deadline"), { target: { value: "2026-12-01T10:00" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("heading", { name: "SRS final" })).toBeInTheDocument();
    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(patchCall).toBeDefined();
    expect(JSON.parse(String(patchCall![1]!.body))).toEqual({
      title: "SRS final",
      deadline: new Date("2026-12-01T10:00").toISOString(),
    });
    await waitFor(() => expect(screen.queryByRole("form", { name: "Edit milestone" })).not.toBeInTheDocument());
    expect(screen.getByText(/1 Dec 2026/)).toBeInTheDocument();
  });

  it("TEST-05-10: a 409 rule rejection and 400 field errors are shown and the card keeps the old values", async () => {
    let attempt = 0;
    mockApi((url, init) => {
      if (url.endsWith("/api/milestones/10") && init?.method === "PATCH") {
        attempt += 1;
        if (attempt === 1) {
          return {
            status: 409,
            body: { error: { code: "DEADLINE_NOT_EXTENDED", message: "The deadline can only be extended, not moved earlier" } },
          };
        }
        return {
          status: 400,
          body: { error: { code: "VALIDATION_ERROR", message: "Invalid milestone", details: { title: "REQUIRED" } } },
        };
      }
      return milestoneReads(url, init);
    });
    startAt("/supervisor/milestones/10");

    const form = await openEditForm();
    fireEvent.change(within(form).getByLabelText("Deadline"), { target: { value: "2026-11-01T10:00" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save changes" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent(
      "The deadline can only be extended, not moved earlier"
    );
    expect(screen.getByRole("heading", { name: "SRS draft" })).toBeInTheDocument();

    fireEvent.change(within(form).getByLabelText("Title"), { target: { value: " " } });
    fireEvent.click(within(form).getByRole("button", { name: "Save changes" }));

    expect(await within(form).findByText("Required")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "SRS draft" })).toBeInTheDocument();
  });
});
