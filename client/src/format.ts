const deadlineFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Bangkok",
});

// Deadlines are stored in UTC and shown in Thailand time (SRS A-04), e.g. "8 Nov 2026, 23:59 (ICT)".
export function formatDeadline(iso: string): string {
  return `${deadlineFormat.format(new Date(iso))} (ICT)`;
}
