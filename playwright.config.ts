import "dotenv/config";
import { defineConfig } from "@playwright/test";
import { generateKeyPairSync } from "node:crypto";

// Ephemeral fixture issuer, only for the separate test process on port 3101.
// The application still runs its real JWT/DPoP verification; no auth bypass is added.
if (!process.env.TEST_TIDE_PRIVATE_JWK) {
  const pair = generateKeyPairSync("ed25519");
  process.env.TEST_TIDE_PRIVATE_JWK = JSON.stringify(pair.privateKey.export({ format: "jwk" }));
  process.env.TEST_TIDE_PUBLIC_JWK = JSON.stringify(pair.publicKey.export({ format: "jwk" }));
}
export default defineConfig({
  testDir: "tests",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  reporter: "list",
  use: { baseURL: "http://localhost:3101" },
  webServer: {
    command: "npm run dev -- --port 3101",
    url: "http://localhost:3101",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_DIST_DIR: ".next/security-tests",
      NEXT_TELEMETRY_DISABLED: "1",
      CLIENT_ADAPTER: JSON.stringify({
        realm: "security-test", "auth-server-url": "http://localhost:8999", resource: "security-test-client",
        "public-client": true, "ssl-required": "none", "confidential-port": 0,
        jwk: { keys: [{ ...JSON.parse(process.env.TEST_TIDE_PUBLIC_JWK!), kid: "test-key", alg: "EdDSA" }] },
      }),
    },
  },
});
