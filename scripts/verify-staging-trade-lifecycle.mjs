import { randomBytes } from "node:crypto";
import { chromium } from "@playwright/test";

const baseUrl = (process.env.STAGING_BASE_URL || "").trim().replace(/\/$/, "");
const firebaseApiKey = process.env.STAGING_FIREBASE_API_KEY?.trim();

if (!baseUrl || !firebaseApiKey) {
  throw new Error("Set STAGING_BASE_URL and STAGING_FIREBASE_API_KEY.");
}
if (!/staging/i.test(baseUrl) && process.env.ALLOW_NON_STAGING_TARGET !== "true") {
  throw new Error("Refusing to run the destructive trade journey outside a staging URL.");
}

const runId = `${Date.now()}-${randomBytes(4).toString("hex")}`;
const email = `memecoin-journal-journey-${runId}@example.com`;
const password = `Staging-${randomBytes(18).toString("base64url")}!7`;
const initialNote = `staging-create-${runId}`;
const editedNote = `staging-edit-${runId}`;
let user;
let browser;

async function firebaseRequest(path, body) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${encodeURIComponent(firebaseApiKey)}`, {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Firebase ${path} failed: ${data?.error?.message || response.status}`);
  return data;
}

async function createDisposableUser() {
  const created = await firebaseRequest("accounts:signUp", { email, password, returnSecureToken: true });
  const roleResponse = await fetch(`${baseUrl}/api/auth/supabase-role`, {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: { authorization: `Bearer ${created.idToken}` },
  });
  if (!roleResponse.ok) throw new Error(`Supabase role bridge returned HTTP ${roleResponse.status}.`);
  return { uid: created.localId, token: created.idToken, refreshToken: created.refreshToken };
}

async function refreshIdToken(refreshToken) {
  const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(firebaseApiKey)}`, {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Firebase token refresh failed: ${data?.error?.message || response.status}`);
  return data.id_token;
}

async function deleteAccount() {
  if (!user) return;
  const token = await refreshIdToken(user.refreshToken);
  const response = await fetch(`${baseUrl}/api/account/delete`, {
    method: "POST",
    signal: AbortSignal.timeout(60_000),
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Disposable account cleanup returned HTTP ${response.status}.`);
}

async function dismissTour(page) {
  const skip = page.getByRole("button", { name: "Skip tutorial" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

try {
  user = await createDisposableUser();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const signInMode = page.getByRole("button", { name: "Sign In", exact: true });
  await signInMode.click({ timeout: 30_000 });
  await page.getByRole("button", { name: "Sign In to Journal", exact: true }).waitFor({ timeout: 30_000 });
  await page.getByPlaceholder("trader@solana.com").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  try {
    await page.getByRole("button", { name: /New Trade/ }).waitFor({ timeout: 45_000 });
  } catch (error) {
    const visibleText = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim().slice(0, 1200);
    throw new Error(`Email sign-in did not reach the journal. Visible page: ${visibleText}`, { cause: error });
  }
  await dismissTour(page);

  await page.getByRole("button", { name: /New Trade/ }).click();
  const createDialog = page.getByRole("dialog", { name: "Log New Trade" });
  await createDialog.getByLabel("Solana Contract Address").fill("11111111111111111111111111111111");
  await createDialog.getByRole("button", { name: "Win", exact: true }).click();
  await createDialog.getByLabel("Bought (SOL)").fill("1");
  await createDialog.getByLabel("Sold (SOL)").fill("1.25");
  await createDialog.getByLabel("Net P&L (SOL)").fill("0.25");
  await createDialog.getByLabel("Trade Notes & Rationale").fill(initialNote);
  await createDialog.getByRole("button", { name: "Save Trade to Cloud" }).click();
  const saveFailure = page.getByText("Could not save trade", { exact: true });
  await Promise.race([
    createDialog.waitFor({ state: "detached", timeout: 30_000 }),
    saveFailure.waitFor({ state: "visible", timeout: 30_000 }).then(async () => {
      const toast = saveFailure.locator("xpath=..");
      throw new Error(`Trade save failed: ${(await toast.innerText()).replace(/\s+/g, " ").trim()}`);
    }),
  ]);
  console.log("PASS created a trade through the staging interface.");

  await page.getByRole("button", { name: "Trades", exact: true }).click();
  await page.getByText(initialNote).waitFor({ timeout: 30_000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText(initialNote).waitFor({ timeout: 30_000 });
  console.log("PASS the created trade survived a full page refresh.");

  await page.getByRole("button", { name: "Edit trade" }).click();
  const editDialog = page.getByRole("dialog", { name: /Edit Trade:/ });
  await editDialog.getByLabel("Trade Notes & Rationale").fill(editedNote);
  await editDialog.getByRole("button", { name: "Update Trade" }).click();
  await editDialog.waitFor({ state: "detached", timeout: 30_000 });
  await page.getByText(editedNote).waitFor({ timeout: 30_000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText(editedNote).waitFor({ timeout: 30_000 });
  console.log("PASS edited the trade and verified the change after refresh.");

  await page.getByRole("button", { name: "Delete trade" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "Delete this trade?" });
  await deleteDialog.getByRole("button", { name: "Delete Trade" }).click();
  await deleteDialog.waitFor({ state: "detached", timeout: 30_000 });
  await page.getByText(editedNote).waitFor({ state: "detached", timeout: 30_000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText(editedNote).waitFor({ state: "detached", timeout: 30_000 });
  console.log("PASS deleted the trade with confirmation and verified removal after refresh.");
} finally {
  await browser?.close();
  await deleteAccount();
  if (user) console.log("PASS deleted the disposable staging account and all associated data.");
}
