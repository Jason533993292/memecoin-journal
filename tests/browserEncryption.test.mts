import assert from "node:assert/strict";
import test from "node:test";
import { decryptBrowserSecret, encryptBrowserSecret, isEncryptedBrowserSecret } from "../src/lib/browserEncryption.ts";

test("browser secrets round-trip through authenticated encryption", async () => {
  const encrypted = await encryptBrowserSecret("sk-example-secret", "correct horse battery staple");
  assert.equal(isEncryptedBrowserSecret(encrypted), true);
  assert.equal(encrypted.includes("sk-example-secret"), false);
  assert.equal(await decryptBrowserSecret(encrypted, "correct horse battery staple"), "sk-example-secret");
});

test("browser secrets reject the wrong passphrase and weak persistence passphrases", async () => {
  await assert.rejects(() => encryptBrowserSecret("sk-example-secret", "short"), /at least 8/);
  const encrypted = await encryptBrowserSecret("sk-example-secret", "long enough passphrase");
  await assert.rejects(() => decryptBrowserSecret(encrypted, "different passphrase"), /could not unlock/);
  assert.equal(isEncryptedBrowserSecret("sk-plaintext"), false);
});

