"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

const ZOOM_STORAGE_KEY = "memecoin-journal:page-zoom";
const ZOOM_LEVELS = [120, 110, 100, 90, 80, 70] as const;

function readZoom() {
  if (typeof window === "undefined") return 100;
  const value = Number(window.localStorage.getItem(ZOOM_STORAGE_KEY));
  return ZOOM_LEVELS.includes(value as (typeof ZOOM_LEVELS)[number]) ? value : 100;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("page-zoom-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("page-zoom-change", onStoreChange);
  };
}

export default function PageZoomControl() {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const zoom = useSyncExternalStore(subscribe, readZoom, () => 100);

  useEffect(() => {
    document.documentElement.style.zoom = `${zoom}%`;
  }, [zoom]);

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (details?.open && !details.contains(event.target as Node)) details.removeAttribute("open");
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") detailsRef.current?.removeAttribute("open");
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismissOnEscape);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismissOnEscape);
    };
  }, []);

  return (
    <details ref={detailsRef} className="theme-preview-control page-zoom-control">
      <summary aria-label="Choose page zoom">
        <span className="theme-preview-label">Page zoom</span>
        <span className="ml-auto text-[10px] font-semibold">{zoom}%</span>
      </summary>
      <div className="theme-preview-options" role="group" aria-label="Page zoom options">
        {ZOOM_LEVELS.map((level) => (
          <button
            type="button"
            key={level}
            aria-pressed={zoom === level}
            className={zoom === level ? "is-active" : undefined}
            onClick={(event) => {
              window.localStorage.setItem(ZOOM_STORAGE_KEY, String(level));
              window.dispatchEvent(new Event("page-zoom-change"));
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
          >
            {level}%
          </button>
        ))}
      </div>
    </details>
  );
}
