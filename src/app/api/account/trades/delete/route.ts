import { NextResponse } from "next/server";
import {
  consumeUserRateLimits,
  FirebaseAdminConfigurationError,
  getFirebaseAdmin,
  verifyFirebaseUser,
} from "@/lib/firebase-admin";
import { deleteSupabaseTrades, recordAccountSecurityEvent } from "@/lib/supabase-admin";
import { requestHeaders, requestIdFor } from "@/lib/requestId";

export const maxDuration = 60;

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  const reply = (body: object, status = 200) => NextResponse.json(body, {
    status,
    headers: requestHeaders(requestId),
  });

  let decodedToken;
  try {
    decodedToken = await verifyFirebaseUser(request);
  } catch (error) {
    const configError = error instanceof FirebaseAdminConfigurationError;
    return reply({
      error: configError
        ? "Trading-data deletion is temporarily unavailable."
        : "Your sign-in has expired. Sign in again and retry.",
    }, configError ? 503 : 401);
  }

  if (!decodedToken) return reply({ error: "Sign in again to delete your trading data." }, 401);

  try {
    const allowed = await consumeUserRateLimits(decodedToken.uid, "trading-data-delete", [
      { key: "day", limit: 3, durationMs: 86_400_000 },
    ]);
    if (!allowed) return reply({ error: "Too many deletion attempts. Please try again later." }, 429);

    if (process.env.NEXT_PUBLIC_DATA_BACKEND === "supabase") {
      await deleteSupabaseTrades(decodedToken.uid);
    }

    const { db } = getFirebaseAdmin();
    await db.recursiveDelete(db.collection("users").doc(decodedToken.uid).collection("trades"));

    if (process.env.NEXT_PUBLIC_DATA_BACKEND === "supabase") {
      await recordAccountSecurityEvent(decodedToken.uid, "trading_data_deleted", requestId).catch((auditError) => {
        console.error("Trading-data security history failed", { requestId, reason: auditError instanceof Error ? auditError.name : "unknown" });
      });
    }

    return reply({ deleted: true });
  } catch (error) {
    console.error("Trading-data deletion failed", {
      requestId,
      uid: decodedToken.uid,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return reply({
      error: `We could not finish deleting your trading data. Retry or contact support with reference ${requestId}.`,
      requestId,
    }, 500);
  }
}
