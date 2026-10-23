import { NextRequest, NextResponse } from "next/server";

function contentSecurityPolicy(nonce: string) {
  const scripts = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(process.env.NODE_ENV === "development" ? ["'unsafe-eval'"] : []),
    "https://www.google.com",
    "https://apis.google.com",
    "https://www.recaptcha.net",
    "https://www.gstatic.com",
  ].join(" ");

  return `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src ${scripts}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; frame-src 'self' https://www.google.com https://apis.google.com https://www.recaptcha.net https://memecoin-journal.firebaseapp.com; connect-src 'self' https://tndqtaouizztihzggwnh.supabase.co https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebaseinstallations.googleapis.com https://api.dexscreener.com https://www.google.com https://apis.google.com https://www.recaptcha.net https://recaptchaenterprise.googleapis.com https://content-firebaseappcheck.googleapis.com`;
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
