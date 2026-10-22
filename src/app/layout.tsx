import { Providers } from "./providers";
import "./globals.css";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadTideConfig } from "@/lib/auth/tidecloakConfig";

// Re-read the adapter at runtime, including when it is exported after a build.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Research Consent Vault",
  description: "Participant-controlled research contributions powered by TideCloak",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const configured = Boolean(process.env.CLIENT_ADAPTER) || existsSync(join(process.cwd(), "data/tidecloak.json"));
  const config = configured ? loadTideConfig() : null;
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "2rem", background: "#0a0a0a", color: "#ededed" }}>
        {config ? <Providers config={config as unknown as Record<string, unknown>}>{children}</Providers> : (
          <main style={{ maxWidth: 720, margin: "4rem auto", lineHeight: 1.7 }}>
            <h1>Research Consent Vault</h1>
            <p>The development app is ready. TideCloak account setup is still required.</p>
            <p>Follow the local setup instructions in README.md, then restart the app after exporting data/tidecloak.json.</p>
            <p>Login and the vault remain unavailable until a real Tide adapter is configured.</p>
          </main>
        )}
      </body>
    </html>
  );
}
