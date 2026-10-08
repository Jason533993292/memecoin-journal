"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User,
} from "../lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  loginWithGoogle: async () => {},
  loginWithEmail: async () => {},
  signUpWithEmail: async () => {},
  resetPassword: async () => {},
  resendVerification: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (!currentUser || process.env.NEXT_PUBLIC_DATA_BACKEND !== "supabase") return;

      void (async () => {
        try {
          const token = await currentUser.getIdToken();
          const response = await fetch("/api/auth/supabase-role", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) await currentUser.getIdToken(true);
        } catch {
          // Firebase remains a valid login if the optional migration bridge is
          // unavailable; Supabase requests will show their own clear error.
        }
      })();
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      const code = typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";

      // Some privacy and popup-blocking extensions close the OAuth window after
      // it opens. Firebase reports that as popup-closed-by-user even though the
      // user started the sign-in flow, so continue with the more reliable
      // full-page redirect in either popup failure case.
      if (code === "auth/popup-blocked" || code === "auth/popup-closed-by-user") {
        console.info("Using redirect-based Google sign-in.");
        await signInWithRedirect(auth, googleProvider);
      } else {
        throw error;
      }
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, pass);
    await sendEmailVerification(credential.user);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerification = async () => {
    if (!auth.currentUser) throw new Error("Sign in before requesting another verification email.");
    await sendEmailVerification(auth.currentUser);
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithGoogle,
        loginWithEmail,
        signUpWithEmail,
        resetPassword,
        resendVerification,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
