"use client";

import Link from "next/link";
import { ArrowRight, Fingerprint, LockKeyhole, ShieldCheck } from "lucide-react";
import { forgetSession } from "@/lib/session-recovery";
import { useAppAuth } from "@/lib/auth/use-app-auth";
import { DemoSignInPanel } from "./demo-sign-in-panel";

export default function HomePage() {
  const { authenticated, login, logout, isInitializing, isDemo, demoPersona } = useAppAuth();
  const landing = demoPersona === "admin" ? "/admin/policies" : demoPersona === "researcher" ? "/research" : "/vault";
  return (
    <main className="shell">
      <header className="topbar"><Link className="brand" href="/"><span className="brand-icon"><Fingerprint size={23} /></span>Consent Vault</Link><span className="badge">RMIT · Research demo</span></header>
      <section className="hero">
        <span className="eyebrow">YOUR CONTRIBUTION. YOUR CONTROL.</span>
        <h1>Better research starts<br />with trust.</h1>
        <p className="lead">{isDemo ? "Exercise the participant, researcher, and admin workflow with local simulated TideCloak identities." : "A private place for your research contributions. Begin with a fictional survey, encrypted for your identity with TideCloak."}</p>
        {isInitializing ? <p role="status">Connecting to TideCloak…</p> : authenticated ? (
          <div className="actions"><Link href={landing} className="button primary">{isDemo ? `Open ${demoPersona} portal` : "Open my vault"} <ArrowRight size={17} /></Link><button className="button secondary" onClick={() => { forgetSession(); void logout(); }}>Sign out</button></div>
        ) : <button className="button primary" onClick={() => void login()}>Sign in with TideCloak <ArrowRight size={17} /></button>}
        <DemoSignInPanel />
        <p className="quiet">Synthetic data only · consent-controlled research sharing</p>
      </section>
      <section className="feature-grid" aria-label="How your vault works">
        <article className="panel"><Fingerprint className="accent" /><h2>Your identity</h2><p>{isDemo ? "The local simulator issues one of three signed mock identities. Server APIs enforce each persona's role claims." : "Sign in through TideCloak. Your research records belong to your signed-in identity."}</p></article>
        <article className="panel"><LockKeyhole className="accent" /><h2>{isDemo ? "Fixture simulation" : "Encrypted before upload"}</h2><p>{isDemo ? "Simulator records are reversible base64 fixtures. Live Tide encryption remains a separate step." : "Your survey answers are encrypted in your browser. The application stores ciphertext."}</p></article>
        <article className="panel"><ShieldCheck className="accent" /><h2>Sharing with consent</h2><p>{isDemo ? "The app checks participant consent and a simulated admin gate before granting the named researcher access." : "Participants approve each request. A realm administrator signs scoped Tide policies before a separate encrypted copy is shared."}</p></article>
      </section>
      <nav className="portal-links" aria-label="Demo portals"><Link className="button secondary" href="/research">Open researcher portal <ArrowRight size={15} /></Link><Link className="button secondary" href="/admin/policies">Open Tide policy desk <ShieldCheck size={15} /></Link></nav>
      <footer className="footer">Research Consent Vault <span>{isDemo ? "Development-only TideCloak simulator" : "Powered by TideCloak"}</span></footer>
    </main>
  );
}
