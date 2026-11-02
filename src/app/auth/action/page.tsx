"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { auth, confirmPasswordReset, verifyPasswordResetCode } from "@/lib/firebase";
import SolanaLogo from "@/components/SolanaLogo";

export default function AuthActionPage() {
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<"checking" | "ready" | "saving" | "done" | "invalid">("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      const params = new URLSearchParams(window.location.search);
      const mode = params.get("mode");
      const actionCode = params.get("oobCode") ?? "";
      if (mode !== "resetPassword" || !actionCode) { setState("invalid"); return; }
      setCode(actionCode);
      try {
        const address = await verifyPasswordResetCode(auth, actionCode);
        setEmail(address); setState("ready");
      } catch {
        setMessage("This reset link is invalid or has expired. Request a fresh email from the sign-in screen."); setState("invalid");
      }
    })();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) { setMessage("Use at least 8 characters for your new password."); return; }
    setState("saving"); setMessage("");
    try { await confirmPasswordReset(auth, code, password); setState("done"); }
    catch { setMessage("The password could not be changed. The link may have expired; request a new reset email."); setState("ready"); }
  };

  return <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#153250_0%,#09111d_42%,#05070b_100%)] p-5 text-white">
    <section className="w-full max-w-md rounded-[28px] border border-sky-400/20 bg-[#0b111b]/95 p-7 shadow-[0_30px_100px_rgba(0,0,0,.6)] sm:p-9">
      <div className="mb-7 flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-black/30"><SolanaLogo size={23}/></span><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-sky-300">Memecoin Journal</p><h1 className="text-xl font-bold">Secure password reset</h1></div></div>
      {state === "checking" && <div className="flex items-center gap-3 rounded-xl bg-white/5 p-4 text-sm text-slate-300"><Loader2 className="animate-spin" size={18}/>Checking your secure link…</div>}
      {state === "invalid" && <div><div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm leading-6 text-rose-100">{message || "This password link is not valid."}</div><Link href="/" className="mt-5 flex min-h-11 items-center justify-center rounded-xl bg-sky-500 font-semibold hover:bg-sky-400">Return to sign in</Link></div>}
      {(state === "ready" || state === "saving") && <form onSubmit={submit}>
        <div className="mb-5 rounded-xl border border-white/8 bg-white/[.04] p-4"><p className="text-xs text-slate-400">Resetting the password for</p><p className="mt-1 truncate text-sm font-semibold">{email}</p></div>
        <label className="text-xs font-semibold text-slate-300">New password</label>
        <div className="relative mt-2"><KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17}/><input autoFocus type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-[#101824] py-3 pl-10 pr-11 text-sm outline-none transition focus:border-sky-400" placeholder="At least 8 characters"/><button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
        {message && <p className="mt-3 text-xs leading-5 text-rose-300">{message}</p>}
        <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-slate-400"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-400"/>Your password is sent directly to Firebase Authentication over HTTPS and is never stored by the journal.</p>
        <button disabled={state === "saving"} className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 font-semibold transition hover:bg-sky-400 disabled:opacity-60">{state === "saving" ? <><Loader2 size={17} className="animate-spin"/>Updating password…</> : "Update password"}</button>
      </form>}
      {state === "done" && <div className="text-center"><CheckCircle2 className="mx-auto text-emerald-400" size={44}/><h2 className="mt-4 text-xl font-bold">Password updated</h2><p className="mt-2 text-sm leading-6 text-slate-400">Your new password is ready. You can now return to the journal and sign in.</p><Link href="/" className="mt-6 flex min-h-11 items-center justify-center rounded-xl bg-sky-500 font-semibold hover:bg-sky-400">Return to sign in</Link></div>}
    </section>
  </main>;
}
