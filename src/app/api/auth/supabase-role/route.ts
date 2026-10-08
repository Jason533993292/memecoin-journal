import { NextResponse } from "next/server";
import {
  FirebaseAdminConfigurationError,
  getFirebaseAdmin,
  verifyFirebaseUser,
} from "@/lib/firebase-admin";

/**
 * Firebase third-party auth bridge for Supabase. A caller can only attach the
 * required Postgres role to their own verified Firebase account.
 */
export async function POST(request: Request) {
  try {
    const decoded = await verifyFirebaseUser(request);
    if (!decoded) return NextResponse.json({ error: "Sign in again and retry." }, { status: 401 });

    const { auth } = getFirebaseAdmin();
    const user = await auth.getUser(decoded.uid);
    if (user.customClaims?.role !== "authenticated") {
      await auth.setCustomUserClaims(decoded.uid, {
        ...user.customClaims,
        role: "authenticated",
      });
    }
    return NextResponse.json({ updated: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof FirebaseAdminConfigurationError ? 503 : 401;
    return NextResponse.json(
      { error: status === 503 ? "Authentication bridge is not configured." : "Your sign-in has expired. Sign in again and retry." },
      { status },
    );
  }
}
