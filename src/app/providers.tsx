"use client";

import { TideCloakProvider } from "@tidecloak/nextjs";
import { SessionRecovery } from "./session-recovery";

// The provider takes the adapter JSON directly as the config prop.
// useDPoP goes inside the config object, not as a separate JSX prop (I-12).
export function Providers({ children, config }: { children: React.ReactNode; config: Record<string, unknown> }) {
  return (
    <TideCloakProvider
      config={{ ...config, useDPoP: { mode: "strict", alg: "ES256" } }}
    >
      <SessionRecovery>{children}</SessionRecovery>
    </TideCloakProvider>
  );
}
