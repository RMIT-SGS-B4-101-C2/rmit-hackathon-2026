"use client";

import { useState } from "react";
import { useAppAuth } from "@/lib/auth/use-app-auth";

const personas = [
  { id: "participant", label: "Participant", note: "Create records and manage consent." },
  { id: "researcher", label: "Researcher", note: "Request records and open approved shares." },
  { id: "admin", label: "Realm admin", note: "Approve the simulated policy gate." },
] as const;

export function DemoSignInPanel() {
  const { demoEnabled, isDemo, demoPersona, demoRoles, signInDemo, signOutDemo } = useAppAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!demoEnabled) return null;

  async function choose(persona: typeof personas[number]["id"]) {
    setBusy(true); setError("");
    try { await signInDemo(persona); }
    catch (err) { setError(err instanceof Error ? err.message : "Simulated sign-in failed."); }
    finally { setBusy(false); }
  }

  return <section className="panel demo-auth-panel" aria-label="Simulated TideCloak sign-in">
    <span className="eyebrow">LOCAL DEVELOPMENT SIMULATOR</span>
    {isDemo ? <>
      <h2>Simulated identity: {demoPersona}</h2>
      <p>Server-verified role claims: {demoRoles.join(", ") || "none"}</p>
      <button className="button secondary small" disabled={busy} onClick={() => { setBusy(true); void signOutDemo().catch((err) => setError(err instanceof Error ? err.message : "Sign-out failed.")).finally(() => setBusy(false)); }}>Sign out of simulation</button>
    </> : <>
      <h2>Try the app without live Tide services</h2>
      <p>Choose a development persona. The server signs a temporary mock session and checks that persona’s roles on every protected API request.</p>
      <div className="inline-actions">{personas.map((persona) => <button key={persona.id} className="button secondary small" disabled={busy} onClick={() => void choose(persona.id)}><strong>{persona.label}</strong><span>{persona.note}</span></button>)}</div>
    </>}
    <p className="demo-disclaimer">Sign-in, role, consent, and record gates are simulated. Fixture data is only base64 encoded; no Tide encryption or policy signatures are created.</p>
    {error && <p className="notice error" role="alert">{error}</p>}
  </section>;
}

export function DemoModeBanner() {
  const { isDemo, demoPersona, demoRoles, demoClientRoles } = useAppAuth();
  if (!isDemo) return null;
  const roles = [...demoRoles, ...demoClientRoles.map((role) => `realm-management:${role}`)];
  return <div className="notice demo-banner" role="status"><strong>SIMULATED TIDECLOAK · {demoPersona}</strong><span>Roles: {roles.join(", ") || "none"}. App-side checks are active; cryptography and signed policies are not simulated.</span></div>;
}
