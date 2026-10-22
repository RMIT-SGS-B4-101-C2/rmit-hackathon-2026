"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Eye, Fingerprint, LockKeyhole, Send } from "lucide-react";
import { surveySchema, type Survey } from "@/lib/survey";
import { useAppAuth } from "@/lib/auth/use-app-auth";
import { decodeSimulatedPayload } from "@/lib/demo-payload";
import { DemoModeBanner, DemoSignInPanel } from "@/app/demo-sign-in-panel";

type DirectoryRecord = { id: string; createdAt: string };
type RequestRow = { id: string; contributionId: string; purpose: string; status: string; expiresAt: string; policiesReady?: boolean };
type Opened = { record: Survey; expiresAt: number };
const absolute = (path: string) => new URL(path, window.location.origin).href;
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

export default function ResearcherPage() {
  const { authenticated, isInitializing, login, secureFetch, doDecrypt, isDemo } = useAppAuth();
  const [directory, setDirectory] = useState<DirectoryRecord[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [purposes, setPurposes] = useState<Record<string, string>>({});
  const [opened, setOpened] = useState<Record<string, Opened>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const refresh = useCallback(async () => {
    const response = await secureFetch(absolute("/api/consent?directory=1"), { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to load study records.");
    setDirectory(body.directory);
    setRequests(body.asResearcher);
  }, [secureFetch]);
  useEffect(() => { if (authenticated) void refresh().catch((err) => setError(err instanceof Error ? err.message : "Unable to load the study.")); }, [authenticated, refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => setOpened((current) => Object.fromEntries(Object.entries(current).filter(([, value]) => value.expiresAt > Date.now()))), 5000);
    const hide = () => { if (document.hidden) setOpened({}); };
    document.addEventListener("visibilitychange", hide);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", hide); };
  }, []);

  async function request(recordId: string) {
    setBusy(recordId); setError(""); setStatus("");
    try {
      const response = await secureFetch(absolute("/api/consent"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contributionId: recordId, purpose: purposes[recordId] || "" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to request access.");
      setStatus("Request sent. You will see the outcome here after the participant responds.");
      setPurposes((items) => ({ ...items, [recordId]: "" })); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to request access."); }
    finally { setBusy(""); }
  }

  async function open(requestRow: RequestRow) {
    setBusy(requestRow.id); setError(""); setStatus(isDemo ? "Checking your simulated decryptor role and active consent…" : "Tide is decrypting the approved copy in your browser…");
    try {
      const response = await secureFetch(absolute(`/api/consent?grantId=${requestRow.id}`), { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Consent is not active.");
      const { grant } = body;
      let plaintext: string;
      if (isDemo) plaintext = decodeSimulatedPayload(grant.sharedCiphertext);
      else {
        const result = await doDecrypt([{ encrypted: grant.sharedCiphertext, tags: [grant.contributionId] }], fromBase64(grant.signedPolicy));
        plaintext = typeof result?.[0] === "string" ? result[0] : new TextDecoder().decode(result[0]);
      }
      const survey = surveySchema.parse(JSON.parse(plaintext));
      setOpened((items) => ({ ...items, [requestRow.id]: { record: survey, expiresAt: Date.now() + 60_000 } }));
      setStatus("Record opened in this tab. It hides after 60 seconds or when the tab is hidden.");
    } catch (err) { setStatus(""); setError(err instanceof Error ? err.message : "Tide could not open this record."); }
    finally { setBusy(""); }
  }

  if (isInitializing) return <main className="shell sign-in"><p role="status">Connecting to Tide…</p></main>;
  if (!authenticated) return <main className="shell sign-in"><span className="brand-icon"><Fingerprint /></span><h1>Researcher portal</h1><p>Sign in with your own Tide identity to request a participant’s synthetic record.</p><button className="button primary" onClick={() => void login()}>Sign in with TideCloak</button><DemoSignInPanel /></main>;

  return <main className="shell">
    <header className="topbar"><Link className="brand" href="/"><span className="brand-icon"><Fingerprint size={23} /></span>Consent Vault · Research</Link><Link href="/vault" className="text-link">Participant vault</Link></header>
    <div className="page-heading"><Link className="text-link" href="/">Home</Link><span className="badge"><LockKeyhole size={13} /> Purpose-bound requests</span></div>
    <DemoModeBanner />
    <h1 className="page-title">Researcher portal<span className="accent">.</span></h1>
    <p className="lead compact">Request records by ID and state a purpose. You receive no contribution contents until the participant approves, Tide policies are signed, and they prepare a separate encrypted copy.</p>
    <div className="notice"><LockKeyhole size={18} /><div><strong>Only synthetic data in this demo</strong><p>{isDemo ? "The simulated researcher role, participant consent, admin gate, and active-grant check are enforced by the app. The fixture is base64 encoded, not encrypted." : "Participant approval and Tide’s decryption policy are separate gates. Withdrawal blocks future API delivery; it cannot recall a copy already opened or saved."}</p></div></div>
    <section className="directory-grid"><h2>Available contribution IDs</h2>
      {!directory.length && <div className="empty-state"><p>No synthetic contributions are available yet.</p></div>}
      {directory.map((item) => {
        const existing = requests.find((entry) => entry.contributionId === item.id && ["REQUESTED", "PENDING_POLICY", "ACTIVE"].includes(entry.status));
        return <article className="panel record" key={item.id}>
          <div className="record-top"><span className="badge">{isDemo ? "Simulated fixture" : "Encrypted contribution"}</span><time>{item.createdAt.slice(0, 10)}</time></div>
          <h3>Record {item.id.slice(0, 8)}</h3>
        {existing ? <><p><span className={`badge state-${existing.status.toLowerCase()}`}>{existing.policiesReady && existing.status === "PENDING_POLICY" ? "AWAITING SHARE" : existing.status.replaceAll("_", " ")}</span> · {existing.purpose}</p>{existing.policiesReady && existing.status === "PENDING_POLICY" && <p className="quiet">Consent and the admin gate are complete. The participant must prepare the simulated share before you can open it.</p>}</> : <>
            <label htmlFor={`purpose-${item.id}`}>Your research purpose</label>
            <textarea id={`purpose-${item.id}`} rows={2} maxLength={500} minLength={12} value={purposes[item.id] || ""} placeholder="For example: compare sleep and study patterns in this synthetic study." onChange={(event) => setPurposes((items) => ({ ...items, [item.id]: event.target.value }))} />
            <button className="button primary small" disabled={!!busy || (purposes[item.id] || "").trim().length < 12} onClick={() => void request(item.id)}><Send size={14} /> Request participant consent</button>
          </>}
        </article>;
      })}
    </section>
    <section className="research-requests"><h2>My requests</h2>
      {requests.map((item) => <article className="panel record" key={item.id}>
        <div className="record-top"><span className={`badge state-${item.status.toLowerCase()}`}>{item.policiesReady && item.status === "PENDING_POLICY" ? "AWAITING SHARE" : item.status.replaceAll("_", " ")}</span><time>Expires {item.expiresAt.slice(0, 10)}</time></div>
        <h3>Record {item.contributionId.slice(0, 8)}</h3><p>{item.purpose}</p>
        {item.policiesReady && item.status === "PENDING_POLICY" && <p className="quiet">The participant must prepare the simulated share before you can open it.</p>}
        {item.status === "ACTIVE" && (opened[item.id]?.expiresAt > Date.now() ? <div className="answers"><dl><div><dt>Sleep / night</dt><dd>{opened[item.id].record.sleepHours} hours</dd></div><div><dt>Study / day</dt><dd>{opened[item.id].record.studyHours} hours</dd></div><div><dt>Wellbeing</dt><dd>{opened[item.id].record.wellbeing}</dd></div></dl>{opened[item.id].record.notes && <p>{opened[item.id].record.notes}</p>}</div> : <button className="button secondary small" disabled={!!busy} onClick={() => void open(item)}><Eye size={14} /> Open permitted record</button>)}
      </article>)}
      {!requests.length && <p className="quiet">You have not requested a contribution yet.</p>}
    </section>
    {status && <p className="notice" role="status">{status}</p>}{error && <p className="notice error" role="alert">{error}</p>}
    <footer className="footer">{isDemo ? "Simulation only: no Tide decryption is performed." : "Tide decrypts only in the researcher’s browser."}<span>Research access · active consent only</span></footer>
  </main>;
}
