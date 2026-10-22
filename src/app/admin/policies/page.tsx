"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { signRelationshipPolicy } from "@/lib/relationship";
import { useAppAuth } from "@/lib/auth/use-app-auth";
import { DemoModeBanner, DemoSignInPanel } from "@/app/demo-sign-in-panel";

type PolicyRequest = { id: string; contributionId: string; researcherTideKey: string; purpose: string; expiresAt: string; contribution: { participantTideKey: string } };
const absolute = (path: string) => new URL(path, window.location.origin).href;
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

export default function PolicyDeskPage() {
  const { authenticated, isInitializing, login, secureFetch, isDemo } = useAppAuth();
  const [requests, setRequests] = useState<PolicyRequest[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [adminPolicy, setAdminPolicy] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (isDemo) {
      const response = await secureFetch(absolute("/api/consent/policies"), { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "You cannot use the simulated policy desk.");
      setRequests(body.requests);
      setAdminPolicy(""); setVendorId("");
      return;
    }
    const [queueResponse, policyResponse, configResponse] = await Promise.all([
      secureFetch(absolute("/api/consent/policies"), { cache: "no-store" }),
      secureFetch(absolute("/api/consent/admin-policy"), { cache: "no-store" }),
      fetch(absolute("/api/config"), { cache: "no-store" }),
    ]);
    const queueBody = await queueResponse.json();
    const policyBody = await policyResponse.json();
    const configBody = await configResponse.json();
    if (!queueResponse.ok) throw new Error(queueBody.error || "You cannot use the Tide policy desk.");
    if (!policyResponse.ok) throw new Error(policyBody.error || "Could not load the realm-admin policy.");
    if (!configResponse.ok || typeof configBody.vendorId !== "string") throw new Error("Tide adapter is missing vendorId.");
    setRequests(queueBody.requests);
    setAdminPolicy(policyBody.policy);
    setVendorId(configBody.vendorId);
  }, [isDemo, secureFetch]);

  useEffect(() => { if (authenticated) void refresh().catch((err) => setError(err instanceof Error ? err.message : "Unable to load policy requests.")); }, [authenticated, refresh]);

  async function signAndAttach(request: PolicyRequest) {
    setBusy(true); setError(""); setStatus(isDemo ? "Checking the simulated admin role and consent state…" : "Opening Tide’s enclave for the two record-scoped approvals…");
    try {
      if (isDemo) {
        const response = await secureFetch(absolute("/api/consent/policies"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grantId: request.id }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not approve the simulated policy gate.");
        setStatus("Simulated admin gate approved. No Tide policy signature or cryptographic access was created.");
        await refresh();
        return;
      }
      const expiry = Math.floor(new Date(request.expiresAt).getTime() / 1000);
      // The participant can write only to this record; the named researcher can only read it.
      const writePolicy = await signRelationshipPolicy({ vendorId, subject: { type: "User", id: request.contribution.participantTideKey }, recordId: request.contributionId, access: "write", expiry }, fromBase64(adminPolicy));
      const readPolicy = await signRelationshipPolicy({ vendorId, subject: { type: "User", id: request.researcherTideKey }, recordId: request.contributionId, access: "read", expiry }, fromBase64(adminPolicy));
      const response = await secureFetch(absolute("/api/consent/policies"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grantId: request.id, readPolicy, ownerWritePolicy: writePolicy }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not attach the Tide policies.");
      setStatus("Both Tide policies are attached. The participant can now prepare the encrypted share.");
      await refresh();
    } catch (err) {
      setStatus(""); setError(err instanceof Error ? err.message : "Tide policy signing failed. The request remains pending.");
    } finally { setBusy(false); }
  }

  if (isInitializing) return <main className="shell sign-in"><p role="status">Connecting to Tide…</p></main>;
  if (!authenticated) return <main className="shell sign-in"><span className="brand-icon"><Fingerprint /></span><h1>Tide policy desk</h1><p>Realm administrators sign the scoped Tide policies here.</p><button className="button primary" onClick={() => void login()}>Sign in with TideCloak</button><DemoSignInPanel /></main>;

  return <main className="shell">
    <header className="topbar"><Link className="brand" href="/"><span className="brand-icon"><Fingerprint size={23} /></span>Consent Vault · Policy desk</Link><Link href="/vault" className="text-link">Participant vault</Link></header>
    <div className="page-heading"><Link className="text-link" href="/">Home</Link><span className="badge"><ShieldCheck size={13} /> {isDemo ? "Simulated realm administrator" : "Tide realm administrator"}</span></div>
    <DemoModeBanner />
    <h1 className="page-title">Review policy requests<span className="accent">.</span></h1>
    <p className="lead compact">Consent approval does not grant cryptographic access. Approve one write-only policy for the participant and one read-only policy for the named researcher. Both are limited to this record and consent expiry.</p>
    <div className="notice"><ShieldCheck size={18} /><div><strong>{isDemo ? "Simulated policy gate" : "What your approvals do"}</strong><p>{isDemo ? "This development action checks the simulated tide-realm-admin client role and consent state only. It creates no Tide signature, key grant, or encryption protection." : "The signed policies bind the account keys, contribution ID, operation, and expiry. Tide still enforces them at encryption/decryption; the app server never sees plaintext."}</p></div></div>
    {requests.map((request) => <article className="panel record" key={request.id}>
      <div className="record-top"><span className="badge">Participant approval recorded</span><time>{request.expiresAt.slice(0, 10)} expiry</time></div>
      <h3>Record {request.contributionId.slice(0, 8)}</h3><p>Purpose: {request.purpose}</p>
      <p className="quiet">Researcher key: {request.researcherTideKey.slice(0, 12)}… · Participant key: {request.contribution.participantTideKey.slice(0, 12)}…</p>
      <button className="button primary" disabled={busy || (!isDemo && (!request.researcherTideKey || !request.contribution.participantTideKey))} onClick={() => void signAndAttach(request)}><ShieldCheck size={15} /> {isDemo ? "Approve simulated policy gate" : "Sign both Tide policies"}</button>
    </article>)}
    {!requests.length && <div className="empty-state"><ShieldCheck size={30} /><h3>No policy approvals are waiting</h3><p>After the admin gate is approved, a request leaves this queue and waits for the participant to prepare the share.</p></div>}
    {status && <p className="notice" role="status">{status}</p>}{error && <p className="notice error" role="alert">{error}</p>}
    <footer className="footer">Each grant is scoped to one participant, one researcher, one record, and one expiry.<span>Admin approval · Tide RelationshipAttestation</span></footer>
  </main>;
}
