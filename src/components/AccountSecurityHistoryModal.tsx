"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { History, ShieldCheck, X } from "lucide-react";
import { ACCOUNT_SECURITY_EVENT_LABELS, type AccountSecurityEventType } from "@/lib/securityHistory";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

type SecurityEvent = { eventType: AccountSecurityEventType; createdAt: string };

export default function AccountSecurityHistoryModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [events, setEvents] = useState<SecurityEvent[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void user.getIdToken().then((token) => fetchWithTimeout("/api/account/security-history", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    })).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Security history could not be loaded.");
      if (active) setEvents(Array.isArray(body.events) ? body.events : []);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "Security history could not be loaded.");
    });
    return () => { active = false; controller.abort(); };
  }, [user]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="security-history-title" className="w-full max-w-lg rounded-2xl border border-[#e3e2de] bg-white p-5 text-[#37352f] shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck size={20}/></span><div><h2 id="security-history-title" className="text-lg font-bold">Account security history</h2><p className="mt-1 text-xs leading-5 text-[#787774]">Recent sensitive account actions. Tokens, IP addresses, and passwords are never shown or stored here.</p></div></div>
          <button type="button" onClick={onClose} aria-label="Close security history" className="rounded-lg p-1.5 text-[#787774] hover:bg-[#f1f1ef]"><X size={18}/></button>
        </div>
        <div className="mt-5 space-y-2">
          {!events && !error && <p className="rounded-xl bg-[#f7f6f3] p-4 text-sm text-[#787774]">Loading security history…</p>}
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
          {events?.length === 0 && <p className="rounded-xl bg-[#f7f6f3] p-4 text-sm text-[#787774]">No recorded account actions yet.</p>}
          {events?.map((event, index) => (
            <article key={`${event.createdAt}-${event.eventType}-${index}`} className="flex items-center gap-3 rounded-xl border border-[#e9e9e7] p-3">
              <History size={16} className="shrink-0 text-[#2383e2]"/>
              <div><p className="text-xs font-semibold">{ACCOUNT_SECURITY_EVENT_LABELS[event.eventType] ?? "Account action"}</p><p className="mt-0.5 text-[10px] text-[#787774]">{new Date(event.createdAt).toLocaleString()}</p></div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
