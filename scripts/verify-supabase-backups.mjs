const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
const maxAgeHours = Number(process.env.SUPABASE_BACKUP_MAX_AGE_HOURS || "48");
const githubToken = process.env.GITHUB_TOKEN?.trim();
const githubRepository = process.env.GITHUB_REPOSITORY?.trim();

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

async function getLatestLogicalBackupTimestamp() {
  if (!githubToken || !githubRepository) return null;
  const workflowResponse = await fetch(
    `https://api.github.com/repos/${githubRepository}/actions/workflows/database-backup.yml/runs?status=success&per_page=1`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${githubToken}`,
        "x-github-api-version": "2022-11-28",
      },
    },
  );
  if (!workflowResponse.ok) {
    throw new Error(`GitHub logical-backup inventory returned HTTP ${workflowResponse.status}.`);
  }
  const workflowPayload = await workflowResponse.json();
  const completedAt = workflowPayload?.workflow_runs?.[0]?.updated_at;
  const timestamp = Date.parse(completedAt);
  return Number.isFinite(timestamp) ? timestamp : null;
}

if (!timestamps.length) {
  const logicalBackupTimestamp = await getLatestLogicalBackupTimestamp();
  if (!logicalBackupTimestamp) {
    throw new Error("Supabase returned no hosted backup and no successful off-site logical backup was found.");
  }
  timestamps.push(logicalBackupTimestamp);
}

const ageHours = (Date.now() - timestamps[0]) / 3_600_000;
if (ageHours > maxAgeHours) {
  throw new Error(`Newest Supabase backup is ${ageHours.toFixed(1)} hours old; limit is ${maxAgeHours} hours.`);
}

console.log(`PASS newest database backup is ${ageHours.toFixed(1)} hours old (${backups.length ? "Supabase hosted backup" : "off-site logical backup"}).`);

