"use client";

import { useSyncExternalStore } from "react";

const changed = "journal-filter-change";
function subscribe(listener: () => void) {
  window.addEventListener(changed, listener);
  window.addEventListener("popstate", listener);
  window.addEventListener("hashchange", listener);
  return () => {
    window.removeEventListener(changed, listener);
    window.removeEventListener("popstate", listener);
    window.removeEventListener("hashchange", listener);
  };
}

let pending: URL | null = null;

export function useTradeFilter(name: string, fallback: string) {
  const fragment = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  const read = (hash: string) => new URLSearchParams(hash.startsWith("#trades?") ? hash.slice(8) : "");
  const value = read(fragment).get(name) || fallback;
  function update(next: string) {
    const url = pending ?? new URL(window.location.href);
    const filters = read(url.hash);
    if (next === fallback) filters.delete(name);
    else filters.set(name, next);
    url.hash = filters.size ? "trades?" + filters.toString() : "trades";
    if (!pending) queueMicrotask(() => {
      if (pending && pending.href !== window.location.href) {
        window.history.pushState(window.history.state, "", pending);
        window.dispatchEvent(new Event(changed));
      }
      pending = null;
    });
    pending = url;
  }
  return [value, update] as const;
}
