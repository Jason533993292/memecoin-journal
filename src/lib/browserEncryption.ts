const PREFIX = "enc:v1:";
const ITERATIONS = 250_000;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function deriveKey(passphrase: string, salt: Uint8Array, usage: KeyUsage[]) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, usage);
}

export function isEncryptedBrowserSecret(value: string | null): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export async function encryptBrowserSecret(secret: string, passphrase: string) {
  if (!secret || secret.length > 5_000) throw new Error("Secret is empty or too long.");
  if (passphrase.length < 8 || passphrase.length > 256) throw new Error("Use an encryption passphrase of at least 8 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(secret)));
  return `${PREFIX}${bytesToBase64(salt)}:${bytesToBase64(iv)}:${bytesToBase64(ciphertext)}`;
}

export async function decryptBrowserSecret(payload: string, passphrase: string) {
  if (!isEncryptedBrowserSecret(payload) || payload.length > 20_000) throw new Error("Encrypted key data is invalid.");
  if (passphrase.length < 8 || passphrase.length > 256) throw new Error("Enter the passphrase used to encrypt this key.");
  const parts = payload.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Encrypted key data is invalid.");
  try {
    const salt = base64ToBytes(parts[0]);
    const iv = base64ToBytes(parts[1]);
    const ciphertext = base64ToBytes(parts[2]);
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 17) throw new Error("invalid");
    const key = await deriveKey(passphrase, salt, ["decrypt"]);
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext));
  } catch {
    throw new Error("That passphrase could not unlock the saved key.");
  }
}

