import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../src/App.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App shell", () => {
  it("shows the product name and the API status from /api/health", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ok", service: "CPMS API" }) })
    );
    render(<App />);
    expect(screen.getByRole("heading", { name: "Course Project Management System" })).toBeInTheDocument();
    expect(await screen.findByText("API: ok")).toBeInTheDocument();
  });

  it("shows unreachable when the API cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    render(<App />);
    expect(await screen.findByText("API: unreachable")).toBeInTheDocument();
  });
});
