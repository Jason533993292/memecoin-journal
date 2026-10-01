"use client";

import { useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from "firebase/auth";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { googleProvider } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./Toast";

interface AccountDeletionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function clearLocalAccountData(uid: string) {
  try {
    const prefixes = ["memecoin_journal_" + uid + "_", "ai_" + uid + "_"];

    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Cloud account deletion should not be reported as failed because storage is unavailable.
  }
}

export default function AccountDeletionModal({
  isOpen,
  onClose,
}: AccountDeletionModalProps) {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("");

  if (!isOpen || !user) return null;

  const providers = new Set(user.providerData.map((provider) => provider.providerId));
  const canUsePassword = providers.has("password");
  const canUseGoogle = providers.has("google.com");
  const ready = confirmation === "DELETE" && !loading;

  const deleteAccount = async (provider: "password" | "google") => {
    if (!ready) return;
    setLoading(true);
    setError("");
    setPhase("Verifying your identity…");

    try {
      if (provider === "password") {
        if (!user.email || !password) {
          setError("Enter your account password to continue.");
          setLoading(false);
          return;
        }
        await reauthenticateWithCredential(
          user,
          EmailAuthProvider.credential(user.email, password)
        );
      } else {
        await reauthenticateWithPopup(user, googleProvider);
      }

      const token = await user.getIdToken(true);
      setPhase("Deleting your journal data and sign-in account…");
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Account deletion failed. Please try again.");
        return;
      }

      clearLocalAccountData(user.uid);
      await logout();
      showToast("Account deleted", "success", "Your journal data and sign-in account were removed.");
      onClose();
    } catch (cause) {
      const code =
        typeof cause === "object" && cause && "code" in cause
          ? String(cause.code)
          : "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("That password could not be verified. Check it and try again.");
      } else if (code === "auth/popup-closed-by-user") {
        setError("Google verification was closed before it finished.");
      } else if (code === "auth/requires-recent-login") {
        setError("Please sign in again, then retry account deletion.");
      } else {
        setError("We could not verify your identity or delete the account. Please try again.");
      }
    } finally {
      setLoading(false);
      setPhase("");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        className="w-full max-w-md space-y-5 rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="rounded-xl bg-rose-50 p-2 text-rose-600">
              <AlertTriangle size={20} />
            </span>
            <div>
              <h2 id="delete-account-title" className="text-lg font-bold text-[#37352f]">
                Delete your account?
              </h2>
              <p className="mt-1 text-sm text-[#787774]">
                This permanently deletes your Firebase sign-in, trades, wallets, wallet history, and saved journal settings.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close account deletion"
            className="rounded-lg p-1.5 text-[#787774] hover:bg-[#f7f6f3] disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          Your locally saved AI provider key and any legacy browser data will also be removed from this browser. Export your trades first if you may need a copy.
        </p>

        {error && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {error}
          </p>
        )}

        {loading && phase && (
          <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
            {phase} Keep this window open until deletion finishes.
          </p>
        )}

        <label className="block space-y-1.5 text-xs font-medium text-[#37352f]">
          Type <span className="font-bold">DELETE</span> to confirm
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            className="w-full rounded-lg border border-[#deddd8] px-3 py-2.5 text-sm outline-none focus:border-rose-400"
          />
        </label>

        {canUsePassword && (
          <div className="space-y-2">
            <label className="block space-y-1.5 text-xs font-medium text-[#37352f]">
              Account password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="w-full rounded-lg border border-[#deddd8] px-3 py-2.5 text-sm outline-none focus:border-rose-400"
              />
            </label>
            <button
              type="button"
              disabled={!ready || !password}
              onClick={() => void deleteAccount("password")}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Delete account permanently
            </button>
          </div>
        )}

        {canUseGoogle && (
          <button
            type="button"
            disabled={!ready}
            onClick={() => void deleteAccount("google")}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Verify with Google and delete
          </button>
        )}

        {!canUsePassword && !canUseGoogle && (
          <p className="text-xs text-[#787774]">
            This account needs a recent sign-in before it can be deleted. Sign out, sign back in, and retry.
          </p>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={onClose}
          className="w-full rounded-lg px-4 py-2 text-xs font-medium text-[#787774] hover:bg-[#f7f6f3] disabled:opacity-50"
        >
          Keep my account
        </button>
      </section>
    </div>
  );
}
