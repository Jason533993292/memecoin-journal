import { NextResponse } from "next/server";
import {
  consumeUserRateLimits,
  FirebaseAdminConfigurationError,
  getFirebaseAdmin,
  rateLimitDocumentId,
  verifyFirebaseUser,
} from "../../../../lib/firebase-admin";

export const maxDuration = 60;

const RECENT_AUTH_WINDOW_SECONDS = 5 * 60;

export async function POST(request: Request) {
  let decodedToken;
  try {
    decodedToken = await verifyFirebaseUser(request);
  } catch (error) {
    const configError = error instanceof FirebaseAdminConfigurationError;
    return NextResponse.json(
      {
        error: configError
          ? "Account deletion is temporarily unavailable. The app's server configuration needs attention."
          : "Your sign-in has expired. Sign in again and retry.",
      },
      { status: configError ? 503 : 401 }
    );
  }

  if (!decodedToken) {
    return NextResponse.json({ error: "Sign in again to delete your account." }, { status: 401 });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    typeof decodedToken.auth_time !== "number" ||
    nowSeconds - decodedToken.auth_time > RECENT_AUTH_WINDOW_SECONDS ||
    decodedToken.auth_time > nowSeconds + 60
  ) {
    return NextResponse.json(
      { error: "For your security, sign in again before deleting your account." },
      { status: 401 }
    );
  }

  try {
    const allowed = await consumeUserRateLimits(decodedToken.uid, "account-delete", [
      { key: "day", limit: 3, durationMs: 86_400_000 },
    ]);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many deletion attempts. Please try again later." },
        { status: 429 }
      );
    }

    const { auth, db } = getFirebaseAdmin();
    // Firestore recursiveDelete includes all subcollections under this UID,
    // including future settings collections. This app does not use Firebase Storage.
    await db.recursiveDelete(db.collection("users").doc(decodedToken.uid));
    await auth.deleteUser(decodedToken.uid);
    await Promise.allSettled(
      ["analyze", "token-lookup", "sol-balance", "account-delete"].map((action) =>
        db.collection("_server_rate_limits").doc(rateLimitDocumentId(decodedToken.uid, action)).delete()
      )
    );

    return NextResponse.json(
      { deleted: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    // Keep user data and credentials out of application logs.
    console.error("Account deletion operation failed", {
      uid: decodedToken.uid,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      {
        error:
          "We could not finish deleting the account. Your account may still exist; sign in and retry or contact support.",
      },
      { status: 500 }
    );
  }
}
