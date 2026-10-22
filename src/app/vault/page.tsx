"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useTideCloak } from "@tidecloak/nextjs";
import { ArrowLeft, Check, Eye, EyeOff, Fingerprint, FlaskConical, LockKeyhole, Plus, Trash2 } from "lucide-react";
import { ENCRYPTION_TAG, STUDY, SYNTHETIC_SURVEY, surveySchema, type EncryptedRecord, type Survey } from "@/lib/survey";
import { forgetSession } from "@/lib/session-recovery";
import { ConsentPanel } from "./consent-panel";

const absolute = (path: string) => new URL(path, window.location.origin).href;
const BYTE_CIPHERTEXT_PREFIX = "tide-bytes:v1:";

function encodeCiphertext(value: string | Uint8Array): string {
  if (typeof value === "string") return value;
  // Tide can return binary ciphertext. Store it as base64 in the JSON envelope,
  // then restore the original bytes before calling doDecrypt.
  let binary = "";
  for (let offset = 0; offset < value.length; offset += 0x8000) {
    binary += String.fromCharCode(...value.subarray(offset, offset + 0x8000));
  }
  return BYTE_CIPHERTEXT_PREFIX + btoa(binary);
}

function decodeCiphertext(value: string): string | Uint8Array {
  if (!value.startsWith(BYTE_CIPHERTEXT_PREFIX)) return value;
  const binary = atob(value.slice(BYTE_CIPHERTEXT_PREFIX.length));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), milliseconds);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

export default function VaultPage() {
  const { authenticated, isInitializing, login, logout, doEncrypt, doDecrypt, secureFetch, getValueFromToken } = useTideCloak();
  const [leaving, setLeaving] = useState(false);
  const subject = authenticated && !leaving ? String(getValueFromToken("sub") ?? "") : "";
  const identity = useRef(subject);
  identity.current = subject;
  const fetchRef = useRef(secureFetch);
  fetchRef.current = secureFetch;
  const [records, setRecords] = useState<EncryptedRecord[]>([]);
  const [form, setForm] = useState<Survey>({ ...SYNTHETIC_SURVEY, notes: "" });
  const [opened, setOpened] = useState<Record<string, Survey>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const hasOpened = Object.keys(opened).length > 0;

  const refresh = useCallback(async () => {
    if (!subject) return;
    setLoading(true);
    try {
      const response = await fetchRef.current(absolute("/api/vault"), { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load records.");
      if (identity.current === subject) setRecords(body.records);
    } catch (err) {
      if (identity.current === subject) setError(err instanceof Error ? err.message : "Unable to load records.");
    } finally { if (identity.current === subject) setLoading(false); }
  }, [subject]);

  useEffect(() => { setRecords([]); setOpened({}); setError(""); setStatus(""); setBusy(false); setPendingDelete(null); setForm({ ...SYNTHETIC_SURVEY, notes: "" }); void refresh(); }, [refresh]);
  // Limit how long decrypted answers remain visible. Nothing is written to browser storage.
  useEffect(() => {
    if (!hasOpened) return;
    const timer = window.setTimeout(() => setOpened({}), 60_000);
    const hide = () => { if (document.hidden) setOpened({}); };
    document.addEventListener("visibilitychange", hide);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", hide); };
  }, [hasOpened]);

  async function save(event: FormEvent) {
    event.preventDefault();
    const parsed = surveySchema.safeParse(form);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Check your survey answers."); return; }
    const current = subject;
    setBusy(true); setError(""); setStatus("Encrypting your fictional answers with Tide…");
    try {
      const result = await withTimeout(
        doEncrypt([{ data: JSON.stringify(parsed.data), tags: [ENCRYPTION_TAG] }]),
        45_000,
        "Tide encryption took too long. Check that your account has the vault self-encrypt role, then sign out and back in.",
      );
      if (identity.current !== current) return;
      if (typeof result?.[0] !== "string" && !(result?.[0] instanceof Uint8Array)) throw new Error("Tide did not return a valid encrypted record.");
      setStatus("Saving the encrypted record…");
      const response = await withTimeout(secureFetch(absolute("/api/vault"), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ciphertext: encodeCiphertext(result[0]) }),
      }), 20_000, "The encrypted record was created, but the save request timed out. Check that PostgreSQL and the app server are running, then retry.");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save your record.");
      if (identity.current !== current) return;
      setForm({ ...SYNTHETIC_SURVEY, notes: "" });
      setStatus("Encrypted record saved. Only your account can open it.");
      await refresh();
    } catch (err) {
      if (identity.current === current) { setStatus(""); setError(err instanceof Error ? err.message : "Encryption failed. No plaintext was uploaded."); }
    } finally { if (identity.current === current) setBusy(false); }
  }

  async function open(record: EncryptedRecord) {
    const current = subject;
    setBusy(true); setError(""); setStatus("Opening your record with Tide…");
    try {
      // Recheck ownership server-side on every open before asking Tide to decrypt.
      const response = await secureFetch(absolute(`/api/vault?id=${record.id}`), { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Record unavailable.");
      const result = await doDecrypt([{ encrypted: decodeCiphertext(body.record.ciphertext), tags: [ENCRYPTION_TAG] }]);
      const plaintext = typeof result?.[0] === "string" ? result[0] : new TextDecoder().decode(result[0]);
      const survey = surveySchema.parse(JSON.parse(plaintext));
      if (identity.current === current) { setOpened((items) => ({ ...items, [record.id]: survey })); setStatus("Record opened. Answers hide after 60 seconds or when you leave this tab."); }
    } catch {
      if (identity.current === current) { setStatus(""); setError("This record could not be opened. Check your Tide session and try again."); }
    } finally { if (identity.current === current) setBusy(false); }
  }

  async function remove(id: string) {
    const current = subject;
    setBusy(true); setError("");
    try {
      const response = await secureFetch(absolute(`/api/vault?id=${id}`), { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete the record.");
      if (identity.current !== current) return;
      setOpened((items) => { const copy = { ...items }; delete copy[id]; return copy; });
      setPendingDelete(null); setStatus("Record deleted from your vault."); await refresh();
    } catch (err) { if (identity.current === current) setError(err instanceof Error ? err.message : "Unable to delete the record."); }
    finally { if (identity.current === current) setBusy(false); }
  }

  async function signOut() {
    forgetSession();
    setLeaving(true); setOpened({}); setForm({ ...SYNTHETIC_SURVEY, notes: "" });
    try { await logout(); }
    catch { setError("Sign-out could not finish. Please try again."); }
    finally { setLeaving(false); }
  }

  if (leaving) return <main className="shell"><p role="status">Signing out of your vault…</p></main>;
  if (isInitializing) return <main className="shell"><p role="status">Connecting to your Tide identity…</p></main>;
  if (!authenticated) return <main className="shell sign-in"><span className="brand-icon"><Fingerprint /></span><h1>Your private research vault</h1><p>Sign in with TideCloak to create and open your encrypted contributions.</p><button className="button primary" onClick={() => void login()}>Sign in with TideCloak</button><Link href="/" className="text-link">Back to home</Link></main>;

  return <main className="shell">
    <header className="topbar"><Link className="brand" href="/"><span className="brand-icon"><Fingerprint size={23} /></span>Consent Vault</Link><button className="button secondary small" onClick={() => void signOut()}>Sign out</button></header>
    <div className="page-heading"><Link className="text-link" href="/"><ArrowLeft size={14} /> Home</Link><span className="badge"><LockKeyhole size={13} /> Private to your account</span></div>
    <h1 className="page-title">My research vault<span className="accent">.</span></h1>
    <p className="lead compact">Start with a fictional contribution. Your answers stay encrypted until you choose to open them.</p>
    {status && <p className="notice" role="status">{status}</p>}{error && <p className="notice error" role="alert">{error} <button className="text-link" onClick={() => setError("")}>Dismiss</button></p>}
    <div className="notice"><FlaskConical size={19} /><div><strong>Demo study · {STUDY.title}</strong><p>Use made-up answers only. Sharing requires your consent and separate, record-scoped Tide policies.</p></div></div>
    <div className="vault-grid">
      <section className="panel survey-panel">
        <div className="section-title"><span className="number">01</span><h2>New contribution</h2></div>
        <p>These answers are encrypted together before upload.</p>
        <form onSubmit={(event) => void save(event)}>
          <fieldset disabled={busy}>
            <label htmlFor="sleep">Sleep per night <span>hours</span></label><input id="sleep" type="number" min="0" max="24" step="0.5" required value={form.sleepHours} onChange={(e) => setForm({ ...form, sleepHours: e.target.valueAsNumber })} />
            <label htmlFor="study">Study per day <span>hours</span></label><input id="study" type="number" min="0" max="24" step="0.5" required value={form.studyHours} onChange={(e) => setForm({ ...form, studyHours: e.target.valueAsNumber })} />
            <label htmlFor="wellbeing">How does the fictional participant feel?</label><select id="wellbeing" value={form.wellbeing} onChange={(e) => setForm({ ...form, wellbeing: e.target.value as Survey["wellbeing"] })}><option value="low">Low</option><option value="fair">Fair</option><option value="good">Good</option><option value="great">Great</option></select>
            <label htmlFor="notes">Fictional notes <span>optional</span></label><textarea id="notes" rows={3} maxLength={500} value={form.notes} placeholder="A made-up observation…" onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <button type="button" className="text-link sample" onClick={() => setForm({ ...SYNTHETIC_SURVEY })}><Plus size={14} /> Fill a synthetic example</button>
            <button type="submit" className="button primary wide"><LockKeyhole size={16} />{busy ? "Working…" : "Encrypt & save contribution"}</button>
          </fieldset>
        </form>
      </section>
      <section className="records-panel" aria-label="My encrypted contributions">
        <div className="section-title"><span className="number">02</span><h2>My contributions</h2><span className="count">{records.length}</span></div>
        <p className="quiet">Latest 100 records · visible only to your account</p>
        {loading && <p role="status">Loading encrypted records…</p>}
        {!loading && !records.length && <div className="empty-state"><LockKeyhole size={30} /><h3>Your vault starts here</h3><p>Save your first synthetic contribution.<br />Your survey answers will remain encrypted.</p></div>}
        {records.map((record) => <article className="panel record" key={record.id}>
          <div className="record-top"><span className="badge"><Check size={12} /> Encrypted</span><time dateTime={record.createdAt}>{new Date(record.createdAt).toLocaleDateString()}</time></div>
          <h3>{STUDY.title}</h3><p className="record-id">Record {record.id.slice(0, 8)}</p>
          {opened[record.id] ? <div className="answers"><dl><div><dt>Sleep / night</dt><dd>{opened[record.id].sleepHours} hours</dd></div><div><dt>Study / day</dt><dd>{opened[record.id].studyHours} hours</dd></div><div><dt>Wellbeing</dt><dd>{opened[record.id].wellbeing}</dd></div></dl>{opened[record.id].notes && <p>{opened[record.id].notes}</p>}</div> : <div className="sealed"><LockKeyhole size={15} /><span>Survey answers are encrypted</span></div>}
          <div className="record-actions">{opened[record.id] ? <button className="button secondary small" onClick={() => setOpened((items) => { const copy = { ...items }; delete copy[record.id]; return copy; })}><EyeOff size={14} /> Hide answers</button> : <button className="button secondary small" disabled={busy} onClick={() => void open(record)}><Eye size={14} /> Open record</button>}<button className="icon-button" disabled={busy} aria-label={`Delete record ${record.id.slice(0, 8)}`} onClick={() => setPendingDelete(record.id)}><Trash2 size={16} /></button></div>
          {pendingDelete === record.id && <div className="delete-confirm"><p>Delete this encrypted contribution from your vault?</p><button className="button danger small" disabled={busy} onClick={() => void remove(record.id)}>Delete contribution</button><button className="button secondary small" disabled={busy} onClick={() => setPendingDelete(null)}>Keep it</button></div>}
        </article>)}
      </section>
    </div>
    <ConsentPanel />
    <footer className="footer">Your answers are encrypted with TideCloak.<span>Participant consent · scoped sharing · audit history</span></footer>
  </main>;
}
