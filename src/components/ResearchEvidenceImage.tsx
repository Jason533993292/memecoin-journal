"use client";

// Keep research screenshots browser-loaded: they may be private data URLs or
// user-selected hosts, and should not be proxied through the Next image service.
/* eslint-disable @next/next/no-img-element */
export default function ResearchEvidenceImage({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} loading="lazy" decoding="async" className="max-h-64 w-full rounded-lg border border-[#e9e9e7] object-contain" />;
}
