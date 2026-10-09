import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // These proxy paths are available for a future custom Firebase auth domain.
    // Do not set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN to the deployment host until
    // its exact /__/auth/handler URL is registered in the Google OAuth client.
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://memecoin-journal.firebaseapp.com/__/auth/:path*",
      },
      {
        source: "/__/firebase/:path*",
        destination: "https://memecoin-journal.firebaseapp.com/__/firebase/:path*",
      },
    ];
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        {
          key: "Content-Security-Policy-Report-Only",
          value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://www.google.com https://apis.google.com https://www.recaptcha.net https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://lh3.googleusercontent.com; frame-src 'self' https://www.google.com https://apis.google.com https://www.recaptcha.net https://memecoin-journal.firebaseapp.com; connect-src 'self' https://tndqtaouizztihzggwnh.supabase.co https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebaseinstallations.googleapis.com https://api.dexscreener.com https://www.google.com https://apis.google.com https://www.recaptcha.net https://recaptchaenterprise.googleapis.com https://content-firebaseappcheck.googleapis.com",
        },
      ],
    }];
  },
};

export default nextConfig;
