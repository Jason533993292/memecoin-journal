import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import ErrorBoundary from "../components/ErrorBoundary";
import { connection } from "next/server";

const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
const metadataBase = new URL(
  publicDomain
    ? `https://${publicDomain}`
    : "https://memecoin-journal-staging.up.railway.app"
);

export const metadata: Metadata = {
  title: "Memecoin Journal",
  description: "A private trading journal for reviewing crypto trades, risk, discipline, and performance.",
  metadataBase,
  openGraph: {
    title: "Memecoin Journal",
    description: "A private trading journal for Solana memecoin traders.",
    type: "website",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Journal",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Next applies the per-request CSP nonce to its bootstrap scripts only when
  // the response is rendered dynamically.
  await connection();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://identitytoolkit.googleapis.com" />
        <link rel="preconnect" href="https://firestore.googleapis.com" />
      </head>
      <body className="min-h-screen bg-white text-[#37352f] antialiased selection:bg-[#2383e2]/20 selection:text-[#2383e2]">
        <ErrorBoundary>
          <AuthProvider>{children}</AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
