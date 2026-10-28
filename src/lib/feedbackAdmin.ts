export const FEEDBACK_STATUSES = ["new", "reviewing", "resolved", "closed"] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export function feedbackAdminEmails(raw = process.env.FEEDBACK_ADMIN_EMAILS || "") {
  return new Set(raw.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export function isFeedbackAdmin(email: unknown, verified: unknown, raw?: string) {
  return verified === true && typeof email === "string" && feedbackAdminEmails(raw).has(email.trim().toLowerCase());
}

export function parseFeedbackAdminUpdate(value: unknown): {
  id: number;
  status: FeedbackStatus;
  assignedTo: string | null;
  note: string | null;
} | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const id = Number(data.id);
  const status = typeof data.status === "string" && FEEDBACK_STATUSES.includes(data.status as FeedbackStatus)
    ? data.status as FeedbackStatus
    : null;
  if (!Number.isSafeInteger(id) || id <= 0 || !status) return null;

  const assignedTo = typeof data.assignedTo === "string" ? data.assignedTo.trim().slice(0, 120) || null : null;
  const note = typeof data.note === "string" ? data.note.trim().slice(0, 2_000) || null : null;
  return { id, status, assignedTo, note };
}
