"use client";

import { X, ExternalLink, Download } from "lucide-react";
import { useEffect } from "react";

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
}

export default function ImageLightboxModal({
  isOpen,
  onClose,
  imageUrl,
  title = "Chart Screenshot",
}: ImageLightboxModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-4xl max-h-[90vh] bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col text-white"
      >
        <div className="flex items-center justify-between p-3.5 px-5 border-b border-neutral-800 bg-neutral-950/80">
          <div className="flex items-center gap-2">
            <span className="text-base">📈</span>
            <span className="text-xs font-semibold text-neutral-200">{title}</span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={imageUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors text-xs flex items-center gap-1"
              title="Open full size"
            >
              <ExternalLink size={14} />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              title="Close"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2 flex items-center justify-center bg-black/90 max-h-[calc(90vh-60px)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={title}
            className="max-w-full max-h-[80vh] object-contain rounded-lg select-none"
          />
        </div>
      </div>
    </div>
  );
}
