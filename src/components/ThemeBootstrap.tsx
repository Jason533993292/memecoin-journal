"use client";

import { useEffect } from "react";
import { normalizePreviewTheme } from "@/lib/themePreview";

const STORAGE_KEY = "memecoin-journal:theme-preview";

export default function ThemeBootstrap() {
  useEffect(() => {
    const apply = () => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const theme = stored === null ? "modern-platform" : normalizePreviewTheme(stored);
        if (stored !== "default" && theme) document.documentElement.dataset.themePreview = theme;
        else delete document.documentElement.dataset.themePreview;
      } catch {
        delete document.documentElement.dataset.themePreview;
      }
    };
    apply();
    window.addEventListener("storage", apply);
    window.addEventListener("theme-preview-change", apply);
    return () => { window.removeEventListener("storage", apply); window.removeEventListener("theme-preview-change", apply); };
  }, []);
  return null;
}
