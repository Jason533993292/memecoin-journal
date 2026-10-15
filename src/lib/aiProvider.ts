export const AI_PROVIDERS = ["deepseek", "gemini", "openai"] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  deepseek: "DeepSeek",
  gemini: "Google Gemini",
  openai: "OpenAI",
};

export const AI_PROVIDER_KEY_HINTS: Record<AiProvider, string> = {
  deepseek: "DeepSeek keys normally begin with sk-.",
  gemini: "Google Gemini keys normally begin with AIza.",
  openai: "OpenAI keys normally begin with sk-.",
};

export function isAiProvider(value: unknown): value is AiProvider {
  return typeof value === "string" && AI_PROVIDERS.includes(value as AiProvider);
}

export function getAiProviderKeyError(provider: AiProvider, rawKey: string): string | null {
  const key = rawKey.trim();
  if (key.length < 8 || key.length > 300 || /[\s\u0000-\u001f\u007f]/.test(key)) {
    return `Enter a valid ${AI_PROVIDER_LABELS[provider]} API key.`;
  }

  if (provider === "gemini" && !/^AIza[0-9A-Za-z_-]{20,}$/.test(key)) {
    return "This key does not match Google Gemini. Gemini API keys normally begin with AIza.";
  }

  if (provider !== "gemini" && !/^sk-[0-9A-Za-z_-]{12,}$/.test(key)) {
    return `This key does not match ${AI_PROVIDER_LABELS[provider]}. ${AI_PROVIDER_KEY_HINTS[provider]}`;
  }

  return null;
}
