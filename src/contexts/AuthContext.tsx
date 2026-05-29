"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabaseClient } from "@/lib/supabase";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  teamId?: string | null;
  /** null when super admin (all teams); array for scoped employees */
  teamIds?: string[] | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string) => Promise<void>;
  completePasswordlessLogin: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
      }
    } catch (error) {
      console.error("Auth check error:", error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error("Email is required");
    }

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Login failed");
    }

    await response.json().catch(() => ({}));
  };

  const completePasswordlessLogin = async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabaseClient.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error("Sign-in session not found. Request a new magic link.");
    }

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: session.access_token }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Login failed");
    }

    const data = await response.json();
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await supabaseClient.auth.signOut();
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, completePasswordlessLogin, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
