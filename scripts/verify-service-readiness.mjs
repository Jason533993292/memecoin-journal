const targets = [
  {
    name: "production",
    url: process.env.PRODUCTION_BASE_URL?.trim(),
    token: process.env.PRODUCTION_HEALTHCHECK_TOKEN?.trim(),
  },
  {
    name: "staging",
    url: process.env.STAGING_BASE_URL?.trim(),
    token: process.env.STAGING_HEALTHCHECK_TOKEN?.trim(),
  },
].filter((target) => target.url);

if (!targets.length) {
  throw new Error("Set PRODUCTION_BASE_URL and/or STAGING_BASE_URL.");
}

async function readJson(response, label) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`${label} returned ${contentType || "an unknown content type"}.`);
  }
  return response.json();
}

for (const target of targets) {
  const baseUrl = target.url.replace(/\/$/, "");
  const publicResponse = await fetch(`${baseUrl}/api/health`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: { "x-request-id": `monitor-${target.name}-${Date.now()}` },
  });
  const publicBody = await readJson(publicResponse, `${target.name} public health`);
  if (!publicResponse.ok || publicBody.status !== "ok") {
    throw new Error(`${target.name} public health failed with HTTP ${publicResponse.status}.`);
  }
  console.log(`PASS ${target.name}: public liveness`);

  if (!target.token) {
    console.log(`SKIP ${target.name}: no authenticated health token configured`);
    continue;
  }

  const readyResponse = await fetch(`${baseUrl}/api/health`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: {
      authorization: `Bearer ${target.token}`,
      "x-request-id": `monitor-ready-${target.name}-${Date.now()}`,
    },
  });
  const readyBody = await readJson(readyResponse, `${target.name} dependency health`);
  if (!readyResponse.ok || readyBody.status !== "ready") {
    const checks = readyBody?.checks ? JSON.stringify(readyBody.checks) : "not returned";
    throw new Error(`${target.name} dependency health failed with HTTP ${readyResponse.status}; checks: ${checks}.`);
  }
  console.log(`PASS ${target.name}: Firebase, Supabase, and feedback email readiness`);
}

