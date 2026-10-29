"use client";

import { useEffect, useState } from "react";
import { MonitorDown } from "lucide-react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallPromptEvent); };
    const clear = () => setPromptEvent(null);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", clear);
    return () => { window.removeEventListener("beforeinstallprompt", capture); window.removeEventListener("appinstalled", clear); };
  }, []);
  if (!promptEvent) return null;
  return <button type="button" onClick={async () => { await promptEvent.prompt(); await promptEvent.userChoice; setPromptEvent(null); }} className="hidden items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-semibold text-neutral-300 hover:bg-white/10 lg:flex" title="Install Memecoin Journal on this computer"><MonitorDown size={12}/> Install</button>;
}
