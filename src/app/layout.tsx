import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MemeCoins Dashboard & Trade Journal",
  description: "Track, analyze, and dominate the Solana memecoin trenches.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-[#37352f] antialiased selection:bg-[#2383e2]/20 selection:text-[#2383e2]">
        {children}
      </body>
    </html>
  );
}
