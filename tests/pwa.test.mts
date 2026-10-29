import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("offline worker excludes authenticated and API traffic from its cache", async () => {
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(worker, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /pathname\.startsWith\("\/__\/"\)/);
  assert.match(worker, /request\.mode === "navigate"/);
  assert.match(worker, /fetch\(request\)\.catch\(\(\) => caches\.match\(OFFLINE_URL\)\)/);
});

test("web app manifest provides a scoped standalone identity and scalable icon", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.json", import.meta.url), "utf8")) as Record<string, unknown>;
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.id, "/");
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.some((icon) => (icon as { sizes?: string }).sizes === "any"));
});
