"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // A production worker can remain attached to localhost after switching
      // back to `next dev`. Its cache-first scripts then hydrate new server
      // HTML with an older client bundle. Remove only this app's workers and
      // caches so local development always uses the current source.
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations
          .filter((registration) => new URL(registration.scope).origin === window.location.origin)
          .map((registration) => registration.unregister())),
      );
      if ("caches" in window) {
        void caches.keys().then((names) => Promise.all(
          names.filter((name) => name.startsWith("memecoin-journal-")).map((name) => caches.delete(name)),
        ));
      }
      return;
    }

    const register = () => { void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => console.warn("Offline support could not start", error)); };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
