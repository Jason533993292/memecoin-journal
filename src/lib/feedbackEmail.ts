import type { FeedbackCategory } from "./feedback";

export const DEFAULT_FEEDBACK_EMAIL_TO = "journal.memecoin@gmail.com";

type FeedbackEmailInput = {
  reference?: string;
  category: FeedbackCategory;
  message: string;
  contactEmail: string | null;
  page: string;
  device: string;
  browser: string;
  viewport: string;
  theme: string;
};

type FeedbackEmailOptions = {
  apiKey?: string;
  from?: string;
  to?: string;
  fetchImpl?: typeof fetch;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);

const cleanHeaderText = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

export async function sendFeedbackNotification(
  input: FeedbackEmailInput,
  options: FeedbackEmailOptions = {},
): Promise<"sent" | "not_configured"> {
  const apiKey = options.apiKey ?? process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return "not_configured";

  const to = cleanHeaderText(options.to ?? process.env.FEEDBACK_EMAIL_TO?.trim() ?? DEFAULT_FEEDBACK_EMAIL_TO);
  const from = cleanHeaderText(
    options.from ?? process.env.FEEDBACK_EMAIL_FROM?.trim() ?? "Memecoin Journal <onboarding@resend.dev>",
  );
  const fetchImpl = options.fetchImpl ?? fetch;
  const categoryLabel = input.category === "bug" ? "Bug report" : input.category === "suggestion" ? "Suggestion" : "Feedback";
  const diagnostics = [
    ["Page", input.page],
    ["Theme", input.theme],
    ["Device", input.device],
    ["Browser", input.browser],
    ["Viewport", input.viewport],
    ["Reply email", input.contactEmail ?? "Not provided"],
  ].filter(([, value]) => Boolean(value));
  const text = [
    `${categoryLabel} from Memecoin Journal${input.reference ? ` (${input.reference})` : ""}`,
    "",
    input.message,
    "",
    ...diagnostics.map(([label, value]) => `${label}: ${value}`),
  ].join("\n");
  const htmlDiagnostics = diagnostics
    .map(([label, value]) => `<tr><th align="left" style="padding:4px 12px 4px 0">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join("");

  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `[Memecoin Journal${input.reference ? ` ${input.reference}` : ""}] ${categoryLabel}`,
      text,
      html: `<h2>${escapeHtml(categoryLabel)}</h2><p style="white-space:pre-wrap">${escapeHtml(input.message)}</p><table>${htmlDiagnostics}</table>`,
      ...(input.contactEmail ? { reply_to: cleanHeaderText(input.contactEmail) } : {}),
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`Feedback email provider returned HTTP ${response.status}.`);
  }
  return "sent";
}

export async function sendFeedbackNotificationWithRetry(
  input: FeedbackEmailInput,
  options: FeedbackEmailOptions & { attempts?: number; retryDelayMs?: number } = {},
): Promise<{ status: "sent" | "not_configured"; attempts: number }> {
  const attempts = Math.min(Math.max(options.attempts ?? 3, 1), 3);
  const retryDelayMs = Math.min(Math.max(options.retryDelayMs ?? 150, 0), 1_000);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const status = await sendFeedbackNotification(input, options);
      return { status, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < attempts && retryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
      }
    }
  }

  throw lastError;
}
