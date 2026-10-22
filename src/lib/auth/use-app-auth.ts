"use client";

import { useCallback } from "react";
import { useTideCloak } from "@tidecloak/nextjs";
import { useDemoAuth } from "@/app/demo-auth-provider";
import type { DemoPersona } from "./demo-session";

export function useAppAuth() {
  const tide = useTideCloak();
  const demo = useDemoAuth();
  const isDemo = Boolean(demo.session);

  const secureFetch = useCallback((input: RequestInfo | URL, init?: RequestInit) => {
    if (demo.session) return fetch(input, { ...init, credentials: "same-origin" });
    return tide.secureFetch(input, init);
  }, [demo.session, tide.secureFetch]);

  const getValueFromToken = useCallback((claim: string) => {
    if (!demo.session) return tide.getValueFromToken(claim);
    const claims: Record<string, unknown> = {
      sub: demo.session.subject,
      tideuserkey: demo.session.tideuserkey,
      preferred_username: demo.session.username,
      auth_source: "simulated_tidecloak",
      realm_access: { roles: demo.session.realmRoles },
      resource_access: { "realm-management": { roles: demo.session.clientRoles } },
    };
    return claims[claim] ?? null;
  }, [demo.session, tide.getValueFromToken]);

  const login = useCallback(() => tide.login(), [tide.login]);
  const logout = useCallback(async () => {
    if (demo.session) return demo.signOut();
    return tide.logout();
  }, [demo.session, demo.signOut, tide.logout]);

  return {
    authenticated: isDemo || tide.authenticated,
    isInitializing: demo.session || demo.enabled ? false : demo.loading || tide.isInitializing,
    login,
    logout,
    secureFetch,
    doEncrypt: tide.doEncrypt,
    doDecrypt: tide.doDecrypt,
    getValueFromToken,
    isDemo,
    demoEnabled: demo.enabled,
    demoPersona: demo.session?.persona ?? null,
    demoRoles: demo.session?.realmRoles ?? [],
    demoClientRoles: demo.session?.clientRoles ?? [],
    signInDemo: (persona: DemoPersona) => demo.signIn(persona),
    signOutDemo: demo.signOut,
  };
}
