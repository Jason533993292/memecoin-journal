export const PREVIEW_THEMES = ["terminal", "premium-journal", "modern-platform"] as const;

export type PreviewTheme = (typeof PREVIEW_THEMES)[number];

export const PREVIEW_THEME_OPTIONS: Array<{ id: PreviewTheme; label: string }> = [
  { id: "terminal", label: "Terminal" },
  { id: "premium-journal", label: "Journal" },
  { id: "modern-platform", label: "Platform" },
];

export function normalizePreviewTheme(value: string | null): PreviewTheme | null {
  return PREVIEW_THEMES.includes(value as PreviewTheme)
    ? (value as PreviewTheme)
    : null;
}
