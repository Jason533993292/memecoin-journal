"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, ExternalLink } from "lucide-react";

const DONATION_ADDRESS = "C1WWM8yvppK1Uxeqc5ybo6VPUeKiBLxHwtUgxgeVajFP";
const SOLANA_PAY_URL = `solana:${DONATION_ADDRESS}?label=Memecoin%20Journal`;

type CopyState = "idle" | "copied" | "failed";

async function copyWithFallback(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(input);
    return copied;
  }
}

export default function DonateCard() {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrError, setQrError] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    void QRCode.toDataURL(SOLANA_PAY_URL, {
      width: 640,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrError(true);
      });

    return () => {
      active = false;
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    };
  }, []);

  const handleCopy = async () => {
    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    const copied = await copyWithFallback(DONATION_ADDRESS);
    setCopyState(copied ? "copied" : "failed");
    copyResetTimer.current = setTimeout(() => setCopyState("idle"), 2200);
  };

  return (
    <section className="support-card rounded-2xl border border-[#e3e2de] bg-white p-5 shadow-sm sm:p-8" aria-labelledby="donate-card-title">
      <div className="grid items-center gap-7 md:grid-cols-[minmax(0,1fr)_17rem] md:gap-10">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0b63b6]">Solana donation</p>
          <h2 id="donate-card-title" className="mt-2 text-2xl font-bold tracking-tight text-[#37352f]">Support Memecoin Journal</h2>
          <p className="mt-3 text-sm leading-6 text-[#5a5957]">
            Donations are optional and go toward hosting and development. They do not unlock features.
          </p>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#696864]">Donation address</p>
            <code className="support-address mt-2 block break-all rounded-xl border border-[#e3e2de] bg-[#fbfbfa] px-4 py-3 font-mono text-sm leading-6 text-[#37352f]">
              {DONATION_ADDRESS}
            </code>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="support-primary-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0b63b6] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#084f91] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b63b6]"
            >
              {copyState === "copied" ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
              {copyState === "copied" ? "Copied" : "Copy address"}
            </button>
            <a
              href={SOLANA_PAY_URL}
              className="support-secondary-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d3d1cb] px-4 py-2.5 text-sm font-semibold text-[#37352f] transition-colors hover:bg-[#f7f6f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b63b6]"
            >
              Open in wallet <ExternalLink size={16} aria-hidden="true" />
            </a>
          </div>
          <p className="sr-only" aria-live="polite">
            {copyState === "copied" ? "Donation address copied." : copyState === "failed" ? "Could not copy the address. Select and copy it manually." : ""}
          </p>
          {copyState === "failed" && (
            <p role="alert" className="mt-3 text-sm font-medium text-rose-700">
              Could not copy automatically. Select the address above and copy it manually.
            </p>
          )}

          <p className="support-warning mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            Only send SOL on the Solana network. Check the first and last characters of the address before you confirm.
          </p>
        </div>

        <div className="flex justify-center md:justify-end">
          <div className="support-qr-shell flex aspect-square w-full max-w-68 items-center justify-center overflow-hidden rounded-2xl border border-[#e3e2de] bg-white p-3 shadow-sm">
            {qrDataUrl ? (
              // A data URL is generated locally and does not benefit from Next image optimization.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="QR code for the Memecoin Journal SOL donation address"
                className="h-auto w-full max-w-full rounded-lg"
              />
            ) : qrError ? (
              <p role="alert" className="px-4 text-center text-sm text-rose-700">The QR code could not be generated. Use the address shown beside it.</p>
            ) : (
              <p className="text-sm !text-[#4b4a47]" aria-live="polite">Generating QR code…</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
