"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { DemoPersona } from "@/lib/auth/demo-session";

export type DemoSession = {
  persona: DemoPersona;
  username: string;
  subject: string;
  tideuserkey: string;
  realmRoles: string[];
  clientRoles: string[];
};

type DemoAuthState = {
  enabled: boolean;
  loading: boolean;
  session: DemoSession | null;
  signIn: (persona: DemoPersona) => Promise<void>;
  signOut: () => Promise<void>;
};

const DemoAuthContext = createContext<DemoAuthState | null>(null);

export function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<DemoSession | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/demo-auth", { cache: "no-store", credentials: "same-origin" });
    const body = await response.json();
    setEnabled(response.ok && body.enabled === true);
    setSession(response.ok ? body.session as DemoSession | null : null);
  }, []);

  useEffect(() => {
    void refresh().catch(() => { setEnabled(false); setSession(null); }).finally(() => setLoading(false));
  }, [refresh]);

  const signIn = useCallback(async (persona: DemoPersona) => {
    const response = await fetch("/api/demo-auth", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ persona }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Simulated sign-in failed.");
    setEnabled(true);
    setSession(body.session as DemoSession);
  }, []);

  const signOut = useCallback(async () => {
    const response = await fetch("/api/demo-auth", { method: "DELETE", credentials: "same-origin" });
    if (!response.ok) throw new Error("Simulated sign-out failed.");
    setSession(null);
  }, []);

  const value = useMemo(() => ({ enabled, loading, session, signIn, signOut }), [enabled, loading, session, signIn, signOut]);
  return <DemoAuthContext.Provider value={value}>{children}</DemoAuthContext.Provider>;
}

export function useDemoAuth() {
  const state = useContext(DemoAuthContext);
  if (!state) throw new Error("useDemoAuth must be used inside DemoAuthProvider.");
  return state;
}
