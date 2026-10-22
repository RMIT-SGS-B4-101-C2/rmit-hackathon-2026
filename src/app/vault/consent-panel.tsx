"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTideCloak } from "@tidecloak/nextjs";
import { Check, Clock3, History, ShieldCheck, X } from "lucide-react";

type Activity = {
  id: string; contributionId: string; purpose: string; status: string; expiresAt: string; createdAt: string;
  researcherSubject?: string; policiesReady?: boolean;
};
type Event = { id: string; action: string; resourceId: string; createdAt: string };
const absolute = (path: string) => new URL(path, window.location.origin).href;
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

export function ConsentPanel() {
  const { secureFetch, doDecrypt, doEncrypt } = useTideCloak();
  const [ownerRequests, setOwnerRequests] = useState<Activity[]>([]);
  const [researcherRequests, setResearcherRequests] = useState<Activity[]>([]);
  const [history, setHistory] = useState<Event[]>([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const refresh = useCallback(async () => {
    const response = await secureFetch(absolute("/api/consent?history=1"), { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to load consent activity.");
    setOwnerRequests(body.asOwner);
    setResearcherRequests(body.asResearcher);
    setHistory(body.history || []);
  }, [secureFetch]);
  useEffect(() => { void refresh().catch((err) => setError(err instanceof Error ? err.message : "Unable to load consent activity.")); }, [refresh]);

  async function decide(grantId: string, decision: "approve" | "deny" | "withdraw") {
    setBusyId(grantId); setError(""); setStatus("");
    try {
      const response = await secureFetch(absolute(`/api/consent?grantId=${grantId}`), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to update consent.");
      setStatus(decision === "approve" ? "Consent recorded. Tide policy signing is still required before a share can be prepared." : decision === "deny" ? "The request was denied." : "Future API access has been revoked. Previously copied plaintext cannot be recalled.");
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update consent."); }
    finally { setBusyId(""); }
  }

  async function prepareShare(grantId: string) {
    setBusyId(grantId); setError(""); setStatus("Opening the original in Tide, then encrypting a separate record-scoped copy…");
    try {
      const response = await secureFetch(absolute(`/api/consent?grantId=${grantId}&shareMaterials=1`), { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The signed policy is not ready.");
      const { materials } = body;
      const plaintextResult = await doDecrypt([{ encrypted: materials.contribution.ciphertext, tags: [materials.contribution.encryptionTag] }]);
      const plaintext = typeof plaintextResult?.[0] === "string" ? plaintextResult[0] : new TextDecoder().decode(plaintextResult[0]);
      const encryptedResult = await doEncrypt([{ data: plaintext, tags: [materials.contributionId] }], fromBase64(materials.ownerWritePolicy));
      if (typeof encryptedResult?.[0] !== "string") throw new Error("Tide did not return the shared ciphertext.");
      const saveResponse = await secureFetch(absolute(`/api/consent?grantId=${grantId}`), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ciphertext: encryptedResult[0] }) });
      const saved = await saveResponse.json();
      if (!saveResponse.ok) throw new Error(saved.error || "Could not save the encrypted share.");
      setStatus("A separate ciphertext is ready for the approved researcher. Your private original remains unchanged.");
      await refresh();
    } catch (err) {
      setStatus(""); setError(err instanceof Error ? err.message : "Could not prepare this encrypted share. Check that Tide encryptor/decryptor roles are active, then try again.");
    } finally { setBusyId(""); }
  }

  return <section className="consent-area">
    <div className="section-title"><span className="number">03</span><h2>Consent & sharing</h2><Link className="text-link" href="/research">Researcher portal →</Link></div>
    <p>Requests identify the researcher and purpose. Your approval is recorded separately from Tide’s cryptographic policy.</p>
    {ownerRequests.length === 0 && <div className="empty-state compact-empty"><Clock3 size={24} /><p>No access requests for your contributions.</p></div>}
    {ownerRequests.map((request) => <article className="panel record" key={request.id}>
      <div className="record-top"><span className={`badge state-${request.status.toLowerCase()}`}>{request.status.replaceAll("_", " ")}</span><time>Expires {request.expiresAt.slice(0, 10)}</time></div>
      <h3>Record {request.contributionId.slice(0, 8)}</h3><p>{request.purpose}</p>
      <p className="quiet">Researcher {request.researcherSubject?.slice(0, 12)}… · requested {request.createdAt.slice(0, 10)}</p>
      {request.status === "REQUESTED" && <div className="inline-actions"><button className="button primary small" disabled={!!busyId} onClick={() => void decide(request.id, "approve")}><Check size={14} /> Approve</button><button className="button danger small" disabled={!!busyId} onClick={() => void decide(request.id, "deny")}><X size={14} /> Deny</button></div>}
      {request.status === "PENDING_POLICY" && (request.policiesReady ? <><p className="quiet">Tide policies approved. Prepare a separate researcher-readable copy with your Tide account.</p><button className="button primary small" disabled={!!busyId} onClick={() => void prepareShare(request.id)}><ShieldCheck size={14} /> Prepare encrypted share</button></> : <><p className="quiet">Your consent is recorded. A Tide realm administrator must sign the record-scoped policies before any copy can be shared.</p><Link className="text-link" href="/admin/policies">Open Tide policy desk →</Link></>)}
      {request.status === "ACTIVE" && <><p className="quiet">Encrypted copy is available to this researcher while consent remains active.</p><button className="button secondary small" disabled={!!busyId} onClick={() => void decide(request.id, "withdraw")}>Withdraw future access</button></>}
    </article>)}
    {researcherRequests.length > 0 && <div className="subsection"><h3>My requests as a researcher</h3>{researcherRequests.map((request) => <p key={request.id}><span className={`badge state-${request.status.toLowerCase()}`}>{request.status.replaceAll("_", " ")}</span> · Record {request.contributionId.slice(0, 8)} · {request.purpose}</p>)}</div>}
    <details className="history-panel"><summary><History size={15} /> Activity history ({history.length})</summary>{history.map((event) => <div className="history-row" key={event.id}><span>{event.action.replaceAll("_", " ")}</span><span>Record {event.resourceId.slice(0, 8)}</span><time>{event.createdAt.slice(0, 16).replace("T", " ")} UTC</time></div>)}</details>
    {status && <p className="notice" role="status">{status}</p>}{error && <p className="notice error" role="alert">{error}</p>}
  </section>;
}
