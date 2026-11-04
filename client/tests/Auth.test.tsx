import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../src/App.js";

describe("F-01 Authentication UI", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("TEST-01-13: renders login form and allows user to login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/auth/login")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              token: "mock-jwt-token",
              user: { id: 1, name: "Student 1", email: "student1@cpms.test", role: "STUDENT" },
            }),
          });
        }
        if (url.includes("/api/auth/me")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              user: { id: 1, name: "Student 1", email: "student1@cpms.test", role: "STUDENT" },
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

    // Check that login form exists
    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitButton = screen.getByRole("button", { name: /Log in/i });

    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();

    fireEvent.change(emailInput, { target: { value: "student1@cpms.test" } });
    fireEvent.change(passwordInput, { target: { value: "demo-password" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(sessionStorage.getItem("cpms_token")).toBe("mock-jwt-token");
    });
  });
});
