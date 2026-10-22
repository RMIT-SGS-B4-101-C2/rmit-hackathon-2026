"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTideCloak } from "@tidecloak/nextjs";

export default function AuthRedirectPage() {
  const router = useRouter();
  const { authenticated, isInitializing, initError, login } = useTideCloak();
  const [retryError, setRetryError] = useState(false);

  // Front-channel mode: the provider owns callback storage and token exchange.
  // useAuthCallback is for hybrid mode and expects a different PKCE storage key.
  // Wait for the provider's verified session, then preserve it with client navigation.
  useEffect(() => {
    if (!isInitializing && authenticated) router.replace("/vault");
  }, [authenticated, isInitializing, router]);

  if (isInitializing || authenticated) {
    return <main className="shell sign-in"><p role="status">Completing your Tide sign-in…</p></main>;
  }

  return (
    <main className="shell sign-in">
      <span className="eyebrow">CONSENT VAULT</span>
      <h1>Sign-in could not be completed.</h1>
      <p role="alert">{initError
        ? "Tide could not create your session. Please try again."
        : "No active Tide session was received. The sign-in request may have expired or been interrupted."}</p>
      <button className="button primary" onClick={() => { setRetryError(false); void login().catch(() => setRetryError(true)); }}>Try sign-in again</button>
      {retryError && <p role="alert">Unable to start sign-in. Please reload and try again.</p>}
      <Link href="/" className="text-link">Back to home</Link>
    </main>
  );
}
