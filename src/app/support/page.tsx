import type { Metadata } from "next";
import Link from "next/link";
import SupportView from "@/components/SupportView";

export const metadata: Metadata = {
  title: "Support the Project | Memecoin Journal",
  description: "Optionally support Memecoin Journal hosting and development with a SOL donation.",
};

export default function SupportPage() {
  return (
    <main className="support-page min-h-screen bg-[#fbfbfa] px-5 py-10 text-[#37352f] sm:px-8 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <nav aria-label="Support navigation" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Link href="/" className="font-medium text-[#0b63b6] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b63b6]">Memecoin Journal</Link>
          <span aria-hidden="true" className="text-[#9b9a97]">/</span>
          <span className="text-[#696864]">Support the project</span>
        </nav>

        <SupportView standalone />

        <footer className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#e9e9e7] pt-6 text-xs text-[#696864]">
          <Link href="/" className="font-medium text-[#0b63b6] hover:underline">Return to the journal</Link>
          <Link href="/privacy" className="hover:text-[#0b63b6] hover:underline">Privacy</Link>
          <Link href="/terms" className="hover:text-[#0b63b6] hover:underline">Terms</Link>
        </footer>
      </div>
    </main>
  );
}
