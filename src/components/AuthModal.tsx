"use client";

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Lock, Mail, Key, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import SolanaLogo from "./SolanaLogo";

export default function AuthModal() {
  const { loginWithGoogle, loginWithApple, loginWithEmail, signUpWithEmail } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please enter both email and password.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      if (mode === "signup") {
        await signUpWithEmail(email.trim(), password);
      } else {
        await loginWithEmail(email.trim(), password);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") {
        setErrorMsg("Email already in use. Try signing in.");
      } else if (code === "auth/wrong-password" || code === "auth/user-not-found" || code === "auth/invalid-credential") {
        setErrorMsg("Invalid email or password.");
      } else if (code === "auth/weak-password") {
        setErrorMsg("Password should be at least 6 characters.");
      } else if (code === "auth/configuration-not-found") {
        setErrorMsg("Authentication method not enabled in Firebase Console. (Go to Firebase Console -> Authentication -> Sign-in method and enable Email/Google).");
      } else {
        setErrorMsg(err?.message || "Failed to authenticate.");
      }
    }
    setLoading(false);
  };

  const handleSocialLogin = async (provider: "google" | "apple") => {
    setLoading(true);
    setErrorMsg("");
    try {
      if (provider === "google") await loginWithGoogle();
      else await loginWithApple();
    } catch (err: any) {
      console.error("Social login error:", err);
      if (err?.code === "auth/configuration-not-found") {
        setErrorMsg(`Firebase Error: ${provider.toUpperCase()} Sign-In is not enabled in Firebase Console yet. Please enable it under Authentication -> Sign-in method.`);
      } else if (err?.code !== "auth/popup-closed-by-user") {
        setErrorMsg(err?.message || `Failed to sign in with ${provider}.`);
      }
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0d0d0d] border border-neutral-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 text-white">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-black border border-neutral-700 mb-2 shadow-inner">
            <SolanaLogo size={22} />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Memecoin Trade Journal</h2>
          <p className="text-xs text-neutral-400">
            {mode === "signup"
              ? "Create your account to start tracking trades securely."
              : "Welcome back. Sign in to access your journal."}
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl">
            <AlertCircle size={14} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Social Buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSocialLogin("google")}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white text-neutral-900 hover:bg-neutral-100 rounded-xl text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSocialLogin("apple")}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-neutral-900 border border-neutral-700 text-white hover:bg-neutral-800 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 170 170">
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.33.13-9.13-1.9-14.4-6.08-3.32-2.65-7.2-7.3-11.66-13.96-5.83-8.62-10.4-18.3-13.72-29.04-3.32-10.73-4.98-21.07-4.98-31.02 0-14.75 3.65-27.18 10.95-37.28 7.3-10.1 16.71-15.22 28.23-15.36 4.71 0 9.77 1.18 15.19 3.55 5.42 2.37 9.17 3.55 11.25 3.55 1.95 0 5.83-1.24 11.65-3.73 5.82-2.48 10.98-3.65 15.48-3.5 10.86.6 19.86 4.67 27 12.22-9.74 5.9-14.5 14.28-14.28 25.15.22 8.43 3.32 15.54 9.3 21.32 5.98 5.79 13.32 9.08 22.02 9.87-2.3 6.9-5.46 13.88-9.48 20.93zM119.22 31.05c0-6.49 2.39-12.83 7.17-19.02 4.78-6.19 10.87-10.22 18.26-12.03.17 1.06.26 2.05.26 2.97 0 6.64-2.51 13.06-7.53 19.26-5.02 6.2-11.1 10.22-18.24 12.05-.17-.98-.26-1.92-.26-2.83z" />
            </svg>
            <span>Continue with Apple</span>
          </button>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-neutral-800 w-full" />
          <span className="bg-[#0d0d0d] px-3 text-[10px] text-neutral-500 uppercase tracking-widest absolute">
            Or with email
          </span>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmitEmail} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] text-neutral-400 font-medium">Email address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trader@solana.com"
                className="w-full bg-neutral-900 border border-neutral-800 focus:border-[#2383e2] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-neutral-400 font-medium">Password</label>
            <div className="relative">
              <Key className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-neutral-900 border border-neutral-800 focus:border-[#2383e2] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2383e2] hover:bg-[#1a73ca] text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-md"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{mode === "signup" ? "Create Free Account" : "Sign In to Journal"}</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Toggle Mode Footer */}
        <div className="text-center pt-2 border-t border-neutral-800">
          {mode === "signup" ? (
            <p className="text-xs text-neutral-400">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setErrorMsg("");
                }}
                className="text-[#2383e2] font-semibold hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </p>
          ) : (
            <p className="text-xs text-neutral-400">
              Don't have an account yet?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setErrorMsg("");
                }}
                className="text-[#2383e2] font-semibold hover:underline cursor-pointer"
              >
                Create Account
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
