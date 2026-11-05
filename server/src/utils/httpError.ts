// An expected API error. The app's error handler turns it into the SDS §4 error shape.
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, string>
  ) {
    super(message);
  }
}

export const notFound = () => new HttpError(404, "NOT_FOUND", "Resource not found");

// Route IDs must be positive integers; anything else is treated as a record that does not exist.
export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw notFound();
  return id;
}
