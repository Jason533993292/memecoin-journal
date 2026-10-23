const baseUrl = (process.argv[2] || process.env.RELEASE_BASE_URL || "").replace(/\/$/, "");
if (!baseUrl) throw new Error("Provide the deployed URL: npm run smoke:release -- https://example.com");

const checks = [
  { path: "/", status: 200, traceable: false },
  { path: "/privacy", status: 200, traceable: false },
  { path: "/terms", status: 200, traceable: false },
  { path: "/api/health", status: 200, traceable: true },
];

for (const check of checks) {
  const response = await fetch(`${baseUrl}${check.path}`, {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
    headers: { "x-request-id": `release-${check.path.replace(/\W/g, "-")}` },
  });
  if (response.status !== check.status) throw new Error(`${check.path} returned HTTP ${response.status}.`);
  const requestId = response.headers.get("x-request-id");
  if (check.traceable && !requestId) throw new Error(`${check.path} did not return X-Request-Id.`);
  if (!response.headers.get("x-content-type-options")?.includes("nosniff")) {
    throw new Error(`${check.path} is missing X-Content-Type-Options.`);
  }
  console.log(`PASS ${check.path} HTTP ${response.status}${requestId ? ` request ${requestId}` : ""}`);
}

const health = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(15_000) }).then((response) => response.json());
if (health.status !== "ok") throw new Error("Public health response disclosed an unexpected status.");
console.log("Public release smoke checks passed.");
