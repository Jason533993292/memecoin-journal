import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import ErrorBoundary from "../components/ErrorBoundary";

export const metadata: Metadata = {
  title: "Memecoin Journal",
  description: "Track your degenerate crypto plays.",
  metadataBase: new URL("https://memecoin-journal.vercel.app"),
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
