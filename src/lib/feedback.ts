export const FEEDBACK_CATEGORIES = ["bug", "suggestion", "other"] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export type FeedbackPayload = {
  category: FeedbackCategory;
  message: string;
  allowReply: boolean;
  page: string;
  device: string;
  browser: string;
  viewport: string;
  theme: string;
  company?: string;
};

const bounded = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export function parseFeedbackPayload(value: unknown): FeedbackPayload | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const category = bounded(candidate.category, 20);
  const message = bounded(candidate.message, 2000);
  if (!FEEDBACK_CATEGORIES.includes(category as FeedbackCategory)) return null;
  if (message.length < 15) return null;

  return {
    category: category as FeedbackCategory,
    message,
    allowReply: candidate.allowReply === true,
    page: bounded(candidate.page, 500),
    device: bounded(candidate.device, 120),
    browser: bounded(candidate.browser, 120),
    viewport: bounded(candidate.viewport, 40),
    theme: bounded(candidate.theme, 40),
    company: bounded(candidate.company, 200),
  };
}
