export const API_URL: string = import.meta.env.VITE_API_URL ?? "/api";

export async function getHealth(): Promise<{ status: string; service: string }> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}
