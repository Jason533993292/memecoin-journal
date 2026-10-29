export const ACCOUNT_SECURITY_EVENT_TYPES = [
  "password_reset_requested",
  "verification_email_requested",
  "trading_data_deleted",
  "signed_out",
] as const;

export type AccountSecurityEventType = (typeof ACCOUNT_SECURITY_EVENT_TYPES)[number];

export const ACCOUNT_SECURITY_EVENT_LABELS: Record<AccountSecurityEventType, string> = {
  password_reset_requested: "Password reset email requested",
  verification_email_requested: "Verification email requested",
  trading_data_deleted: "All trades and statistics deleted",
  signed_out: "Signed out",
};

export function parseAccountSecurityEvent(value: unknown): AccountSecurityEventType | null {
  if (!value || typeof value !== "object") return null;
  const eventType = (value as Record<string, unknown>).eventType;
  return typeof eventType === "string" && ACCOUNT_SECURITY_EVENT_TYPES.includes(eventType as AccountSecurityEventType)
    ? eventType as AccountSecurityEventType
    : null;
}
