import { NextResponse } from "next/server";
import {
  consumeUserRateLimits,
  FirebaseAdminConfigurationError,
  getFirebaseAdmin,
  rateLimitDocumentId,
  verifyFirebaseUser,
} from "../../../../lib/firebase-admin";
import { deleteSupabaseJournalData } from "@/lib/supabase-admin";
import { requestHeaders, requestIdFor } from "@/lib/requestId";

export const maxDuration = 60;

const RECENT_AUTH_WINDOW_SECONDS = 5 * 60;

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  let deletionStage = "authenticate";
  const reply = (body: object, status = 200) => NextResponse.json(body, {
    status,
    headers: requestHeaders(requestId),
  });
  let decodedToken;
  try {
    decodedToken = await verifyFirebaseUser(request);
  } catch (error) {
    const configError = error instanceof FirebaseAdminConfigurationError;
    return reply(
      {
        error: configError
          ? "Account deletion is temporarily unavailable. The app's server configuration needs attention."
          : "Your sign-in has expired. Sign in again and retry.",
      },
      configError ? 503 : 401,
    );
  }

  if (!decodedToken) {
    return reply({ error: "Sign in again to delete your account." }, 401);
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    typeof decodedToken.auth_time !== "number" ||
    nowSeconds - decodedToken.auth_time > RECENT_AUTH_WINDOW_SECONDS ||
    decodedToken.auth_time > nowSeconds + 60
  ) {
    return reply(
      { error: "For your security, sign in again before deleting your account." },
      401,
    );
  }

  try {
    deletionStage = "rate-limit";
    const allowed = await consumeUserRateLimits(decodedToken.uid, "account-delete", [
      { key: "day", limit: 3, durationMs: 86_400_000 },
    ]);
    if (!allowed) {
      return reply(
        { error: "Too many deletion attempts. Please try again later." },
        429,
      );
    }

    const { auth, db } = getFirebaseAdmin();
    if (process.env.NEXT_PUBLIC_DATA_BACKEND === "supabase") {
      // Delete the staged Postgres copy first. If it fails, retain Firebase so
      // the user can retry rather than leaving a split account deletion.
      deletionStage = "supabase-data";
      await deleteSupabaseJournalData(decodedToken.uid);
    }
    // Firestore recursiveDelete includes all subcollections under this UID,
    // including future settings collections. This app does not use Firebase Storage.
    deletionStage = "firestore-data";
    await db.recursiveDelete(db.collection("users").doc(decodedToken.uid));
    deletionStage = "firebase-auth";
    await auth.deleteUser(decodedToken.uid);
    deletionStage = "rate-limit-cleanup";
    await Promise.allSettled(
      ["analyze", "token-lookup", "sol-balance", "account-delete"].map((action) =>
        db.collection("_server_rate_limits").doc(rateLimitDocumentId(decodedToken.uid, action)).delete()
      )
    );

    return reply({ deleted: true });
  } catch (error) {
    // Keep user data and credentials out of application logs.
    console.error("Account deletion operation failed", {
      requestId,
      uid: decodedToken.uid,
      stage: deletionStage,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return reply(
      {
        error: `We could not finish deleting the account. Sign in and retry, or contact support with reference ${requestId}.`,
        requestId,
      },
      500,
    );
  }
}
