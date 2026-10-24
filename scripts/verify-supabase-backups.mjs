const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
const maxAgeHours = Number(process.env.SUPABASE_BACKUP_MAX_AGE_HOURS || "48");

if (!accessToken || !projectRef) {
  throw new Error("Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF before checking backups.");
}
if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0 || maxAgeHours > 168) {
  throw new Error("SUPABASE_BACKUP_MAX_AGE_HOURS must be between 1 and 168.");
}

const response = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/backups`, {
  cache: "no-store",
  signal: AbortSignal.timeout(20_000),
  headers: { authorization: `Bearer ${accessToken}` },
});
if (!response.ok) {
  throw new Error(`Supabase backup inventory returned HTTP ${response.status}.`);
}

const payload = await response.json();
const backups = Array.isArray(payload) ? payload : Array.isArray(payload?.backups) ? payload.backups : [];
const timestamps = backups
  .flatMap((backup) => [backup?.inserted_at, backup?.created_at, backup?.completed_at])
  .map((value) => Date.parse(value))
  .filter(Number.isFinite)
  .sort((a, b) => b - a);

if (!timestamps.length) {
  throw new Error("Supabase returned no completed backup timestamp. Configure daily backups or an off-site logical backup.");
}

const ageHours = (Date.now() - timestamps[0]) / 3_600_000;
if (ageHours > maxAgeHours) {
  throw new Error(`Newest Supabase backup is ${ageHours.toFixed(1)} hours old; limit is ${maxAgeHours} hours.`);
}

console.log(`PASS newest Supabase backup is ${ageHours.toFixed(1)} hours old (${backups.length} backup records returned).`);

