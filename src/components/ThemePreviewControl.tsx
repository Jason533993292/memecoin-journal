"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  PREVIEW_THEME_OPTIONS,
  normalizePreviewTheme,
  type PreviewTheme,
} from "../lib/themePreview";

const PREVIEW_STORAGE_KEY = "memecoin-journal:theme-preview";

function isPreviewTheme(value: string | null): value is PreviewTheme {
  return normalizePreviewTheme(value) !== null;
}

const subscribeToPreviewChanges = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("theme-preview-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("theme-preview-change", onStoreChange);
  };
};

function getStoredPreviewTheme(): PreviewTheme | null {
  if (typeof window === "undefined") return null;

  let storedTheme: string | null = null;
  try {
    storedTheme = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
  } catch {
    return null;
  }
  return isPreviewTheme(storedTheme) ? storedTheme : null;
}

export default function ThemePreviewControl() {
  const theme = useSyncExternalStore(
    subscribeToPreviewChanges,
    getStoredPreviewTheme,
    () => null,
  );

  useEffect(() => {
    if (!theme) {
      delete document.documentElement.dataset.themePreview;
      return;
    }

    document.documentElement.dataset.themePreview = theme;

    return () => {
      delete document.documentElement.dataset.themePreview;
    };
  }, [theme]);

  const activeThemeLabel = PREVIEW_THEME_OPTIONS.find((option) => option.id === theme)?.label || "Default";

  return (
    <details className="theme-preview-control">
      <summary aria-label="Choose site theme">
        <span className="theme-preview-label">Theme</span>
        <span className="theme-preview-value">{activeThemeLabel}</span>
      </summary>
      <div className="theme-preview-options" role="group" aria-label="Site theme options">
        {PREVIEW_THEME_OPTIONS.map((option) => (
          <button
            type="button"
            key={option.id}
            onClick={(event) => {
              try {
                window.localStorage.setItem(PREVIEW_STORAGE_KEY, option.id);
              } catch {
                return;
              }
              window.dispatchEvent(new Event("theme-preview-change"));
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
            aria-pressed={theme === option.id}
            className={theme === option.id ? "is-active" : undefined}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          onClick={(event) => {
            try {
              window.localStorage.removeItem(PREVIEW_STORAGE_KEY);
            } catch {
              return;
            }
            window.dispatchEvent(new Event("theme-preview-change"));
            event.currentTarget.closest("details")?.removeAttribute("open");
          }}
          aria-pressed={!theme}
          className={!theme ? "is-active" : undefined}
        >
          Default
        </button>
      </div>
    </details>
  );
}
