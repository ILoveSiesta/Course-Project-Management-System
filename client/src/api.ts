export const API_URL: string = import.meta.env.VITE_API_URL ?? "/api";

export async function getHealth(): Promise<{ status: string; service: string }> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: "STUDENT" | "SUPERVISOR";
}

export async function loginApi(email: string, password: string): Promise<{ token: string; user: UserProfile }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Login failed");
  }

  return data;
}

export async function getMeApi(token: string): Promise<{ user: UserProfile }> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to fetch user");
  }

  return data;
}

export async function logoutApi(token: string): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}
