"use client";

import { useEffect } from "react";
import { normalizePreviewTheme } from "@/lib/themePreview";

const STORAGE_KEY = "memecoin-journal:theme-preview";
const ZOOM_STORAGE_KEY = "memecoin-journal:page-zoom";
const ZOOM_LEVELS = new Set([120, 110, 100, 90, 80, 70]);

export default function ThemeBootstrap() {
  useEffect(() => {
    const applyZoom = () => {
      try {
        const zoom = Number(window.localStorage.getItem(ZOOM_STORAGE_KEY));
        document.documentElement.style.zoom = `${ZOOM_LEVELS.has(zoom) ? zoom : 100}%`;
      } catch {
        document.documentElement.style.zoom = "100%";
      }
    };
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
    applyZoom();
    window.addEventListener("storage", apply);
    window.addEventListener("theme-preview-change", apply);
    window.addEventListener("page-zoom-change", applyZoom);
    return () => { window.removeEventListener("storage", apply); window.removeEventListener("theme-preview-change", apply); window.removeEventListener("page-zoom-change", applyZoom); };
  }, []);
  return null;
}
