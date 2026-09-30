"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_PREVIEW_THEME,
  getPreviewThemeFromSearch,
  isThemePreviewEnabled,
  type PreviewTheme,
} from "../lib/themePreview";

const PREVIEW_STORAGE_KEY = "memecoin-journal:theme-preview";

const themes: Array<{ id: PreviewTheme; label: string }> = [
  { id: "terminal", label: "Terminal" },
  { id: "premium-journal", label: "Journal" },
  { id: "modern-platform", label: "Platform" },
];

function isPreviewTheme(value: string | null): value is PreviewTheme {
  return themes.some((theme) => theme.id === value);
}

const subscribeToPreviewChanges = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("theme-preview-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("theme-preview-change", onStoreChange);
  };
};

const subscribeToNothing = () => () => {};

function getStoredPreviewTheme(): PreviewTheme {
  if (typeof window === "undefined") return DEFAULT_PREVIEW_THEME;

  const storedTheme = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
  return isPreviewTheme(storedTheme)
    ? storedTheme
    : getPreviewThemeFromSearch(window.location.search);
}

export default function ThemePreviewControl() {
  const enabled = useSyncExternalStore(
    subscribeToNothing,
    () => isThemePreviewEnabled(window.location.search),
    () => false,
  );
  const theme = useSyncExternalStore(
    subscribeToPreviewChanges,
    getStoredPreviewTheme,
    () => DEFAULT_PREVIEW_THEME,
  );

  useEffect(() => {
    if (!enabled) return;

    document.documentElement.dataset.themePreview = theme;
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, theme);

    return () => {
      delete document.documentElement.dataset.themePreview;
    };
  }, [enabled, theme]);

  if (!enabled) return null;

  return (
    <div className="theme-preview-control" role="group" aria-label="Private design preview">
      <span className="theme-preview-label">Preview</span>
      {themes.map((option) => (
        <button
          type="button"
          key={option.id}
          onClick={() => {
            window.localStorage.setItem(PREVIEW_STORAGE_KEY, option.id);
            window.dispatchEvent(new Event("theme-preview-change"));
          }}
          aria-pressed={theme === option.id}
          className={theme === option.id ? "is-active" : undefined}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
