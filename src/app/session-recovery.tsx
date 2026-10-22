"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { consumeSessionRecovery, forgetSession, rememberSession } from "@/lib/session-recovery";
import { useAppAuth } from "@/lib/auth/use-app-auth";

export function SessionRecovery({ children }: { children: React.ReactNode }) {
  const { authenticated, isInitializing, login } = useAppAuth();
  const pathname = usePathname();
  const checked = useRef(false);
  const wasAuthenticated = useRef(false);
  const [recovery, setRecovery] = useState<"checking" | "idle" | "redirecting" | "failed">("checking");

  useEffect(() => {
    if (isInitializing) return;
    if (authenticated) {
      rememberSession();
      wasAuthenticated.current = true;
      checked.current = true;
      setRecovery("idle");
      return;
    }
    if (wasAuthenticated.current) {
      // An in-page logout/session expiry must not trigger automatic sign-in.
      forgetSession();
      wasAuthenticated.current = false;
    }
    if (checked.current) return;
    checked.current = true;
    if (pathname === "/vault" && consumeSessionRecovery()) {
      setRecovery("redirecting");
      void login().catch(() => setRecovery("failed"));
    } else {
      setRecovery("idle");
    }
  }, [authenticated, isInitializing, login, pathname]);

  useEffect(() => {
    if (recovery !== "redirecting") return;
    // The SDK's login promise may settle before browser navigation happens.
    const timer = window.setTimeout(() => setRecovery("failed"), 15_000);
    return () => window.clearTimeout(timer);
  }, [recovery]);

  if (pathname === "/vault" && !authenticated &&
      (isInitializing || recovery === "checking" || recovery === "redirecting")) {
    return <main className="shell sign-in"><p role="status">Restoring your Tide session…</p></main>;
  }

  return <>
    {recovery === "failed" && <p className="shell notice error" role="alert">Your Tide session could not be restored automatically. Please use Sign in to try again.</p>}
    {children}
  </>;
}
