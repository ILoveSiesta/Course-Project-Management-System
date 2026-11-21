// Field error texts for the milestone forms (F-02 create, F-05 edit). Codes come from the API (SDS §4).
const FIELD_MESSAGES: Record<string, string> = {
  REQUIRED: "Required",
  INVALID_DATE: "Invalid date",
  MUST_BE_FUTURE: "Deadline must be in the future",
  INVALID_TYPE: "Invalid value",
  NO_CHANGES: "Change at least one field",
};
const MAX_LENGTH: Record<string, number> = { title: 120, description: 2000 };

// F-06: team selection of a multi-team milestone.
const TEAM_MESSAGES: Record<string, string> = {
  REQUIRED: "Select at least one team",
  INVALID_TYPE: "Invalid team selection",
  DUPLICATE: "A team is selected twice",
  TOO_MANY: "Select at most 20 teams",
};

export function milestoneFieldMessage(field: string, code: string): string {
  if (field === "teamIds") return TEAM_MESSAGES[code] ?? code;
  if (code === "TOO_LONG") return `Too long (max ${MAX_LENGTH[field]} characters)`;
  return FIELD_MESSAGES[code] ?? code;
}

// ISO timestamp → value for <input type="datetime-local"> in the browser's time zone (minutes only).
export function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
