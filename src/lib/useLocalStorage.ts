"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const LOCAL_SETTINGS_EVENT = "memecoin-journal:local-settings";

function subscribe(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", listener);
  window.addEventListener(LOCAL_SETTINGS_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(LOCAL_SETTINGS_EVENT, listener);
  };
}

function readValue(key: string) {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useLocalStorageValue(key: string) {
  const getSnapshot = useCallback(() => readValue(key), [key]);
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export function writeLocalStorageValue(key: string, value: string | null) {
  try {
    if (typeof window === "undefined") return false;
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    window.dispatchEvent(new Event(LOCAL_SETTINGS_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function readSessionStorageValue(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSessionStorageValue(key: string, value: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeSessionStorageValue(key: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    window.sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function parseLocalStorageValue<T>(value: string | null, fallback: T): T {
  if (value === null) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function useCurrentTime(refreshMs = 60_000) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => setNow(Date.now()), refreshMs);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [refreshMs]);

  return now;
}
