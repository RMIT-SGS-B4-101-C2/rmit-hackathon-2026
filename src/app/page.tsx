"use client";

import Link from "next/link";
import { useTideCloak } from "@tidecloak/nextjs";
import { ArrowRight, Fingerprint, LockKeyhole, ShieldCheck } from "lucide-react";

export default function HomePage() {
  const { authenticated, login, logout, isInitializing, initError } = useTideCloak();
  return (
    <main className="shell">
      <header className="topbar"><Link className="brand" href="/"><span className="brand-icon"><Fingerprint size={23} /></span>Consent Vault</Link><span className="badge">RMIT · Research demo</span></header>
      <section className="hero">
        <span className="eyebrow">YOUR CONTRIBUTION. YOUR CONTROL.</span>
        <h1>Better research starts<br />with trust.</h1>
        <p className="lead">A private place for your research contributions. Begin with a fictional survey, encrypted for your identity with TideCloak.</p>
        {isInitializing ? <p role="status">Connecting to TideCloak…</p> : authenticated ? (
          <div className="actions"><Link href="/vault" className="button primary">Open my vault <ArrowRight size={17} /></Link><button className="button secondary" onClick={() => void logout()}>Sign out</button></div>
        ) : <button className="button primary" onClick={() => void login()}>Sign in with TideCloak <ArrowRight size={17} /></button>}
        {initError && <p role="alert" className="notice error">Unable to connect to TideCloak. Please try again after checking the local service.</p>}
        <p className="quiet">Synthetic data only · Stage 1: your private vault</p>
      </section>
      <section className="feature-grid" aria-label="How your vault works">
        <article className="panel"><Fingerprint className="accent" /><h2>Your identity</h2><p>Sign in through TideCloak. Your research records belong to your signed-in identity.</p></article>
        <article className="panel"><LockKeyhole className="accent" /><h2>Encrypted before upload</h2><p>Your survey answers are encrypted in your browser. The application stores ciphertext.</p></article>
        <article className="panel"><ShieldCheck className="accent" /><h2>Private from the start</h2><p>Only the account that encrypted a record can open it in this stage. Researcher consent and sharing come next.</p></article>
      </section>
      <footer className="footer">Research Consent Vault <span>Powered by TideCloak</span></footer>
    </main>
  );
}
