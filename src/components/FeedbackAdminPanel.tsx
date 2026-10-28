"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { FeedbackStatus } from "@/lib/feedbackAdmin";

type Report = {
  id: number;
  category: string;
  message: string;
  contact_email: string | null;
  page: string;
  status: FeedbackStatus;
  assigned_to: string | null;
  resolution_note: string | null;
  created_at: string;
  email_delivery_status: string;
};

export default function FeedbackAdminPanel() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [available, setAvailable] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const response = await fetch("/api/admin/feedback", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404) return;
    if (!response.ok) throw new Error("Feedback reports could not be loaded.");
    const body = await response.json() as { reports?: Report[] };
    setAvailable(true);
    setReports(Array.isArray(body.reports) ? body.reports : []);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load().catch(() => undefined), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (!available || !reports) return null;

  const update = async (report: Report, status: FeedbackStatus) => {
    if (!user) return;
    setBusyId(report.id);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: report.id, status, assignedTo: user.email, note: report.resolution_note }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error("Feedback report could not be updated.");
      setReports((current) => current?.map((item) => item.id === report.id ? { ...item, status, assigned_to: user.email } : item) ?? []);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-labelledby="feedback-admin-title" className="rounded-2xl border border-[#e3e2de] bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#176bbd]">Maintainer only</p>
          <h2 id="feedback-admin-title" className="mt-1 text-lg font-bold text-[#37352f]">Feedback administration</h2>
          <p className="mt-1 text-xs text-[#787774]">Assign and resolve reports. Every status change is written to a private audit log.</p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-[#d8d6d1] p-2 text-[#4a4946] hover:bg-[#f7f6f3]" aria-label="Refresh feedback reports"><RefreshCw size={16}/></button>
      </div>
      <div className="mt-4 space-y-3">
        {reports.length === 0 && <p className="rounded-xl bg-[#f7f6f3] p-4 text-sm text-[#5a5957]">No feedback reports yet.</p>}
        {reports.map((report) => (
          <article key={report.id} className="rounded-xl border border-[#e3e2de] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#787774]">#{report.id} · {report.category} · {new Date(report.created_at).toLocaleDateString()}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#37352f]">{report.message}</p>
                <p className="mt-2 text-[11px] text-[#787774]">{report.page} · Email {report.email_delivery_status}</p>
              </div>
              <select aria-label={`Status for feedback ${report.id}`} value={report.status} disabled={busyId === report.id} onChange={(event) => void update(report, event.target.value as FeedbackStatus)} className="rounded-lg border border-[#d8d6d1] bg-white px-3 py-2 text-xs text-[#37352f]">
                <option value="new">New</option>
                <option value="reviewing">Reviewing</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            {report.assigned_to && <p className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-700"><CheckCircle2 size={13}/> Assigned to {report.assigned_to}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
