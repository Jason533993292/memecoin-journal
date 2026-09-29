import { createHash } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

type RateWindow = {
  key: string;
  limit: number;
  durationMs: number;
};

export class FirebaseAdminConfigurationError extends Error {}

let adminApp: ReturnType<typeof initializeApp> | undefined;

function getAdminApp() {
  if (adminApp) return adminApp;

  const rawCredentials = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (!rawCredentials) {
    throw new FirebaseAdminConfigurationError("Firebase Admin credentials are not configured.");
  }

  let credentials: {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  try {
    credentials = JSON.parse(rawCredentials);
  } catch {
    throw new FirebaseAdminConfigurationError("Firebase Admin credentials are not valid JSON.");
  }

  if (
    credentials.project_id !== "memecoin-journal" ||
    !credentials.client_email ||
    !credentials.private_key
  ) {
    throw new FirebaseAdminConfigurationError(
      "Firebase Admin credentials do not match this Firebase project."
    );
  }

  const existingApp = getApps().find((app) => app.name === "memecoin-journal-server");
  adminApp =
    existingApp ||
    initializeApp(
      {
        credential: cert({
          projectId: credentials.project_id,
          clientEmail: credentials.client_email,
          privateKey: credentials.private_key,
        }),
      },
      "memecoin-journal-server"
    );

  return adminApp;
}

export function getFirebaseAdmin() {
  const app = getAdminApp();
  return {
    auth: getAuth(app),
    db: getFirestore(app),
  };
}

export function rateLimitDocumentId(uid: string, action: string) {
  const userHash = createHash("sha256").update(uid).digest("hex");
  return action + "_" + userHash;
}

export async function verifyFirebaseUser(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const { auth } = getFirebaseAdmin();
  return auth.verifyIdToken(match[1], true);
}

export async function consumeUserRateLimits(
  uid: string,
  action: string,
  windows: RateWindow[]
) {
  const { db } = getFirebaseAdmin();
  const ref = db.collection("_server_rate_limits").doc(rateLimitDocumentId(uid, action));
  const now = Date.now();

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const previous = snapshot.data() || {};
    const next: Record<string, { startedAt: number; count: number }> = {};

    for (const window of windows) {
      const stored = previous[window.key] as
        | { startedAt?: number; count?: number }
        | undefined;
      const active =
        stored &&
        typeof stored.startedAt === "number" &&
        now - stored.startedAt < window.durationMs;
      const count = active ? Number(stored.count || 0) : 0;

      if (count >= window.limit) return false;

      next[window.key] = {
        startedAt: active ? stored.startedAt! : now,
        count: count + 1,
      };
    }

    transaction.set(
      ref,
      {
        ...previous,
        ...next,
        updatedAt: Timestamp.fromMillis(now),
      },
      { merge: true }
    );
    return true;
  });
}

export async function readBoundedJson(
  request: Request,
  maxBytes: number
): Promise<{ data: unknown } | { error: "too_large" | "invalid_json" }> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxBytes) return { error: "too_large" };
  if (!request.body) return { error: "invalid_json" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { error: "too_large" };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { data: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { error: "invalid_json" };
  }
}
