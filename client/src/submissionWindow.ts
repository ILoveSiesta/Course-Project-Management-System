// BR-05 rev. (CHG-03, CR #59): late submissions are accepted for at most 7 x 24 h after the deadline.
// The UI uses this only to show the closed-window notice; the server decides whether a submission is accepted.
const LATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function isLateWindowClosed(deadlineIso: string, now: Date = new Date()): boolean {
  return now.getTime() > new Date(deadlineIso).getTime() + LATE_WINDOW_MS;
}
