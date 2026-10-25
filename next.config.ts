import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  poweredByHeader: false,
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
        // Legal documents are displayed inside the authenticated app's own modal.
        // SAMEORIGIN keeps third-party sites from framing the app while allowing
        // that same-origin panel to render /privacy and /terms.
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=31536000" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
      ],
    }];
  },
};

export default nextConfig;
