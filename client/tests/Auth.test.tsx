import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../src/App.js";

describe("F-01 Authentication and Routing UI", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    window.history.pushState({}, "Test", "/login");
  });

  it("TEST-01-13: logs in as student, redirects to /student and renders Student Dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/auth/login")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              token: "mock-student-jwt-token",
              user: { id: 1, name: "Student One", email: "student1@cpms.test", role: "STUDENT" },
            }),
          });
        }
        if (url.includes("/api/auth/me")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              user: { id: 1, name: "Student One", email: "student1@cpms.test", role: "STUDENT" },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: "ok", service: "CPMS API" }),
        });
      })
    );

    render(<App />);

    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitButton = screen.getByRole("button", { name: /Log in/i });

    fireEvent.change(emailInput, { target: { value: "student1@cpms.test" } });
    fireEvent.change(passwordInput, { target: { value: "demo-password" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(sessionStorage.getItem("cpms_token")).toBe("mock-student-jwt-token");
      expect(screen.getByRole("heading", { name: /Student Dashboard/i })).toBeInTheDocument();
      expect(screen.getAllByText(/Student One/i).length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: /Log out/i })).toBeInTheDocument();
    });
  });

  it("TEST-01-13b: logs in as supervisor, redirects to /supervisor and renders Supervisor Dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/auth/login")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              token: "mock-supervisor-jwt-token",
              user: { id: 2, name: "Supervisor One", email: "supervisor1@cpms.test", role: "SUPERVISOR" },
            }),
          });
        }
        if (url.includes("/api/auth/me")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              user: { id: 2, name: "Supervisor One", email: "supervisor1@cpms.test", role: "SUPERVISOR" },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: "ok", service: "CPMS API" }),
        });
      })
    );

    render(<App />);

    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitButton = screen.getByRole("button", { name: /Log in/i });

    fireEvent.change(emailInput, { target: { value: "supervisor1@cpms.test" } });
    fireEvent.change(passwordInput, { target: { value: "demo-password" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(sessionStorage.getItem("cpms_token")).toBe("mock-supervisor-jwt-token");
      expect(screen.getByRole("heading", { name: /Supervisor Dashboard/i })).toBeInTheDocument();
      expect(screen.getAllByText(/Supervisor One/i).length).toBeGreaterThan(0);
    });
  });

  it("TEST-01-13c: clicking Log out clears session and redirects to /login", async () => {
    sessionStorage.setItem("cpms_token", "existing-token");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/auth/me")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              user: { id: 1, name: "Student One", email: "student1@cpms.test", role: "STUDENT" },
            }),
          });
        }
        if (url.includes("/api/auth/logout")) {
          return Promise.resolve({
            ok: true,
            status: 204,
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: "ok", service: "CPMS API" }),
        });
      })
    );

    render(<App />);

    // Wait until logged-in dashboard is rendered
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Student Dashboard/i })).toBeInTheDocument();
    });

    const logoutButton = screen.getByRole("button", { name: /Log out/i });
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(sessionStorage.getItem("cpms_token")).toBeNull();
      expect(screen.getByRole("heading", { name: /Sign In/i })).toBeInTheDocument();
    });
  });
});
