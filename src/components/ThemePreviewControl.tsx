"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_PREVIEW_THEME,
  PREVIEW_THEME_OPTIONS,
  getPreviewThemeFromSearch,
  isThemePreviewEnabled,
  type PreviewTheme,
} from "../lib/themePreview";

const PREVIEW_STORAGE_KEY = "memecoin-journal:theme-preview";

function isPreviewTheme(value: string | null): value is PreviewTheme {
  return PREVIEW_THEME_OPTIONS.some((theme) => theme.id === value);
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

  const activeThemeLabel = PREVIEW_THEME_OPTIONS.find((option) => option.id === theme)?.label;

  return (
    <details className="theme-preview-control">
      <summary aria-label="Choose private preview theme">
        <span className="theme-preview-label">Theme</span>
        <span className="theme-preview-value">{activeThemeLabel}</span>
      </summary>
      <div className="theme-preview-options" role="group" aria-label="Private design preview">
        {PREVIEW_THEME_OPTIONS.map((option) => (
          <button
            type="button"
            key={option.id}
            onClick={(event) => {
              window.localStorage.setItem(PREVIEW_STORAGE_KEY, option.id);
              window.dispatchEvent(new Event("theme-preview-change"));
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
            aria-pressed={theme === option.id}
            className={theme === option.id ? "is-active" : undefined}
          >
            {option.label}
          </button>
        ))}
      </div>
    </details>
  );
}
