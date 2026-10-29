"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bug, Lightbulb, MessageSquare, Send, X } from "lucide-react";
import type { User } from "firebase/auth";
import type { FeedbackCategory } from "@/lib/feedback";
import { useToast } from "./Toast";

type FeedbackModalProps = {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  currentSection: string;
};

const categories: Array<{ id: FeedbackCategory; label: string; description: string; icon: typeof Bug }> = [
  { id: "bug", label: "Bug", description: "Something did not work", icon: Bug },
  { id: "suggestion", label: "Suggestion", description: "An idea to improve the app", icon: Lightbulb },
  { id: "other", label: "Other", description: "General feedback", icon: MessageSquare },
];

function browserName() {
  const ua = navigator.userAgent;
  const match = ua.match(/(Edg|Chrome|Firefox|Version)\/([\d.]+)/);
  if (!match) return "Unknown browser";
  const name = match[1] === "Version" ? "Safari" : match[1] === "Edg" ? "Edge" : match[1];
  return `${name} ${match[2].split(".")[0]}`;
}

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/.test(ua)) return "Mac";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown device";
}

export default function FeedbackModal({ isOpen, onClose, user, currentSection }: FeedbackModalProps) {
  const { showToast } = useToast();
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [allowReply, setAllowReply] = useState(true);
  const [company, setCompany] = useState("");
  const [sending, setSending] = useState(false);
  const submissionIdRef = useRef<string | null>(null);
  const diagnostics = useMemo(() => {
    if (!isOpen || typeof window === "undefined") return null;
    return {
      page: `${window.location.pathname}${window.location.search}#${currentSection}`.slice(0, 500),
      device: deviceName(),
      browser: browserName(),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      theme: document.documentElement.dataset.themePreview || "default",
    };
  }, [currentSection, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, sending]);

  if (!isOpen) return null;

  const close = () => {
    if (sending) return;
    setMessage("");
    setCategory("bug");
    setCompany("");
    submissionIdRef.current = null;
    onClose();
  };

  const submit = async () => {
    const clean = message.trim();
    if (clean.length < 15) {
      showToast("Add a little more detail", "info", "Describe the issue or suggestion in at least 15 characters.");
      return;
    }
    setSending(true);
    try {
      submissionIdRef.current ??= crypto.randomUUID();
      const token = await user.getIdToken();
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ submissionId: submissionIdRef.current, category, message: clean, allowReply, company, ...diagnostics }),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Feedback could not be sent.");
      setMessage("");
      setCategory("bug");
      setCompany("");
      submissionIdRef.current = null;
      onClose();
      const reference = typeof result.reference === "string" ? result.reference : null;
      showToast(
        "Feedback sent",
        "success",
        reference ? `Reference ${reference}. Keep this number if you contact support.` : "Thank you. Your report is ready for review.",
      );
    } catch (error) {
      showToast("Feedback could not be sent", "error", error instanceof Error ? error.message : "Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="feedback-modal-backdrop fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section role="dialog" aria-modal="true" aria-labelledby="feedback-title" className="feedback-modal w-full max-w-lg rounded-2xl border border-[#e3e2de] bg-white p-5 text-[#37352f] shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="feedback-title" className="text-lg font-bold">Share feedback</h2>
            <p className="mt-1 text-xs leading-5 text-[#787774]">Report a problem or suggest an improvement. Do not include wallet keys, API keys, or passwords.</p>
          </div>
          <button type="button" data-tour="feedback-close" onClick={close} aria-label="Close feedback form" className="rounded-lg p-1.5 text-[#787774] transition-colors hover:bg-[#f1f1ef] hover:text-[#37352f]"><X size={18} /></button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Feedback category">
          {categories.map(({ id, label, description, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setCategory(id)} aria-pressed={category === id} className={`feedback-category rounded-xl border p-3 text-left transition-colors ${category === id ? "border-[#2383e2] bg-blue-50 text-blue-900" : "border-[#e3e2de] bg-white hover:bg-[#f7f6f3]"}`}>
              <Icon size={16} className={category === id ? "text-[#2383e2]" : "text-[#787774]"} />
              <span className="mt-2 block text-xs font-semibold">{label}</span>
              <span className="mt-0.5 hidden text-[10px] leading-4 text-[#787774] sm:block">{description}</span>
            </button>
          ))}
        </div>

        <label htmlFor="feedback-message" className="mt-5 block text-xs font-semibold">What should we know?</label>
        <textarea id="feedback-message" value={message} onChange={(event) => setMessage(event.target.value.slice(0, 2000))} rows={6} maxLength={2000} autoFocus placeholder={category === "bug" ? "What happened, what did you expect, and what were you doing when it occurred?" : "Describe your idea and how it would improve your trading workflow."} className="feedback-input mt-2 w-full resize-y rounded-xl border border-[#d7d6d2] bg-white px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-[#2383e2] focus:ring-2 focus:ring-blue-100" />
        <div className="mt-1 flex justify-between text-[10px] text-[#9b9a97]"><span>Current section and basic device details are attached automatically.</span><span>{message.length}/2000</span></div>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-xs text-[#5f5e5b]">
          <input type="checkbox" checked={allowReply} onChange={(event) => setAllowReply(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-[#c7c6c2] accent-[#2383e2]" />
          <span>Allow a reply to <strong className="break-all font-semibold text-[#37352f]">{user.email || "my account email"}</strong></span>
        </label>
        <input aria-hidden="true" tabIndex={-1} autoComplete="off" value={company} onChange={(event) => setCompany(event.target.value)} className="absolute -left-[10000px] h-px w-px opacity-0" />

        <div className="mt-6 flex justify-end gap-2 border-t border-[#f1f1ef] pt-4">
          <button type="button" onClick={close} disabled={sending} className="rounded-lg px-3.5 py-2 text-xs font-semibold text-[#787774] hover:bg-[#f1f1ef] disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={sending || message.trim().length < 15} className="flex items-center gap-2 rounded-lg bg-[#1a73ca] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#155fa8] disabled:cursor-not-allowed disabled:opacity-50"><Send size={14} />{sending ? "Sending…" : "Send feedback"}</button>
        </div>
      </section>
    </div>
  );
}
