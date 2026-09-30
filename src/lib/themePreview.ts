export const PREVIEW_THEMES = ["terminal", "premium-journal", "modern-platform"] as const;

export type PreviewTheme = (typeof PREVIEW_THEMES)[number];

export const DEFAULT_PREVIEW_THEME: PreviewTheme = "modern-platform";

export const PREVIEW_THEME_OPTIONS: Array<{ id: PreviewTheme; label: string }> = [
  { id: "terminal", label: "Terminal" },
  { id: "premium-journal", label: "Journal" },
  { id: "modern-platform", label: "Platform" },
];

export function isThemePreviewEnabled(search: string): boolean {
  return new URLSearchParams(search).get("theme-preview") === "1";
}

export function getPreviewThemeFromSearch(search: string): PreviewTheme {
  const theme = new URLSearchParams(search).get("theme");
  return PREVIEW_THEMES.includes(theme as PreviewTheme)
    ? (theme as PreviewTheme)
    : DEFAULT_PREVIEW_THEME;
}
