import { randomUUID } from "node:crypto";

const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$/;

export function requestIdFor(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : randomUUID();
}

export function requestHeaders(requestId: string, additional?: HeadersInit): Headers {
  const headers = new Headers(additional);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("X-Request-Id", requestId);
  return headers;
}

export function feedbackReference(id: number): string {
  if (!Number.isSafeInteger(id) || id < 1) throw new TypeError("Feedback ID must be a positive integer.");
  return `MJ-${id.toString(36).toUpperCase().padStart(6, "0")}`;
}
