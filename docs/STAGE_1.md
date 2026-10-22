# Stage 1: private synthetic contributions

Stage 1 implements Tide login wiring, browser-side self-encryption of a structured synthetic survey, and PostgreSQL persistence with owner-scoped access. Researcher sharing and consent controls are Stage 2 work.

On 22 October 2026, the owner confirmed a successful live TideCloak login. The earlier login blocker is no longer observed in that attempt. Live encrypted save/open, persistence after reload, and second-identity API/Fabric isolation remain unverified; Stage 1 acceptance is still in progress.

## Local prerequisites

Start Docker Desktop, PostgreSQL (`npm.cmd run services:up`), and the existing Tide container (`docker start research-consent-tidecloak`). Apply migrations with `npm.cmd run db:migrate` on a new checkout, then run `npm.cmd run dev` in the development shell described in the README.

Owner enrollment and the first realm bootstrap are complete. The real adapter is saved in ignored `data/tidecloak.json`. Do not rerun provisioning or delete the existing realm. The owner selected no profile collection for Stage 1. The login now uses TideCloak's original logo with the generated Consent Vault background; the settings were re-signed and image bytes verified after restoring the logo.

## What is implemented

- `/` introduces the project and offers TideCloak login.
- A previously signed-in vault tab attempts one top-level Tide login redirect if the SDK's silent session check cannot restore it after reload. A non-secret sessionStorage hint is consumed before that redirect and cleared on sign-out; it grants no access. Fresh visitors retain the sign-in gate, and failed recovery does not loop. An active Tide SSO session can complete the redirect without asking for credentials again.
- `/vault` collects fictional sleep hours, study hours, wellbeing, and optional fictional notes. “Fill a synthetic example” populates demonstration values.
- The client validates and serializes the complete survey, then calls Tide `doEncrypt` with the self-encryption tag `vault`.
- `POST /api/vault` accepts only `{ ciphertext }`, limits the request body, and derives ownership from the verified token. Survey fields and supplied ownership fields are rejected.
- PostgreSQL stores ciphertext, a fixed public study identifier, the encryption tag, the owner subject, and timestamps. The study row is created automatically on the first record. Survey answers never appear in the intended API upload or metadata.
- `GET /api/vault` lists the current identity's latest 100 encrypted records. `GET /api/vault?id=UUID` and `DELETE /api/vault?id=UUID` return 404 for both missing and foreign records, including callers with an admin role.
- Opening a record rechecks server-side ownership and calls Tide `doDecrypt` in the browser. Plaintext is kept in React memory and rendered as text; it is not saved to browser storage. Open answers clear within 60 seconds, when the tab becomes hidden, or on sign-out. Other copies or browser memory are not erased by this display behavior.
- Create/delete activity events are recorded atomically with the corresponding database changes. These are ordinary application events, not proof of decryption or an immutable audit ledger.

Every protected request verifies the embedded Tide signing key, issuer, client, required subject/expiry/issued-at claims, `appUser` realm role, and sender-bound DPoP proof. Authorization fails closed without a real adapter. Local requests do not trust forwarded host headers. DPoP replay tracking is currently single-process memory, suitable for this local demo; a distributed deployment needs shared replay storage.

The server validates the envelope shape, not that a malicious authenticated client really encrypted its own payload. This distinction does not change the browser's encryption flow or permit access to another identity's records.

## Automated verification

```powershell
npm.cmd run db:generate
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:security
npm.cmd run tide:doctor -- --check --url http://localhost:3000
npm.cmd run test:callback
```

Security tests launch a separate server on port 3101 with an ephemeral fixture issuer passed only to that child process. They use the same JWT, role, DPoP, API, and PostgreSQL code as the app. They do not change `.env` or the real adapter, and do not add a test login or auth bypass to application code. Generated test signing keys remain in the test process environment. Do not point this suite at a production database.

The four test groups cover:

1. Missing authentication, Bearer replay, missing/wrong-key proofs, missing subject, expired token, and missing application role.
2. Proof replay, a proof for the wrong method, and a proof for another path.
3. Database persistence across signed sessions, owner retrieval/deletion, and cross-account denial even with a generic admin role.
4. Plaintext form fields, spoofed ownership, extra plaintext metadata, malformed JSON, and oversized uploads.

Tests use opaque ciphertext fixtures; they **do not prove live Tide encryption or identity isolation in the Fabric**. They create then delete their own records in the local development database; corresponding activity events remain. Run builds and tests sequentially because the production build owns `.next`, including the test build subdirectory.

With the main app running, the callback browser regression simulates silent-SSO failure and a token-endpoint error. It verifies the visible callback error, a single recovery redirect for a remembered tab, no redirect loop after failure, and API denial when only the session hint is present. It issues no real Tide tokens. Real session restoration still needs the browser acceptance check below.

## Real Tide acceptance check

Use two distinct Tide identities, A and B, in separate browser profiles. A second app principal may need an invite and approval through Tide's realm console because open registration is disabled. Do not reuse identity A for both profiles.

1. Finish owner enrollment, ensure `data/tidecloak.json` has the real embedded key, and get Tide Doctor to pass against the running app.
2. Sign in as A at `http://localhost:3000`, open the vault, fill the synthetic example, and save it.
3. Inspect the upload in browser developer tools: it should contain only the ciphertext envelope, without survey answers. Inspect the database row and verify the answers are absent from its ciphertext/metadata.
4. Reload the page. An active session should restore silently or through one brief Tide redirect, then return to the vault. The record remains, with answers initially hidden. Open it and verify the original synthetic values reappear. Test Hide answers, automatic hiding, and sign-out. After signing out, return to `/vault` and reload: the sign-in gate should remain without automatic recovery.
5. Sign in as B. A's record must not appear. Request A's record ID with B's **own valid** `secureFetch` context: reads and deletes must return 404. Retain A's ciphertext for the next independent cryptographic check; do not change server ownership.
6. From a developer-only harness using B's `useTideCloak()` hook context, pass A's retained ciphertext to `doDecrypt([{ encrypted: ciphertext, tags: ["vault"] }])`. This must fail. A successful API denial alone does not prove this cryptographic check.
7. Return to A, verify the record still opens after B's failed attempts, then delete the synthetic record. The next fetch should return 404.

Record the actual results, SDK/image version, and any failure without substituting fixture tests for these steps. No live encryption success is claimed until the owner has completed these checks.

## Runtime state at implementation

The initial PostgreSQL migration was applied and the four API security test groups passed. Owner enrollment, adapter export, and realm bootstrap are complete. Tide Doctor passes all 18 checks, with no pending governance changes. TideCloak's original logo and the generated Consent Vault background are active, signed, and verified to match the served bytes. Profile collection is disabled for this stage, and a read-only realm diagnostic confirms no post-signup form will fire. Desktop/mobile home rendering and the unauthenticated vault gate were checked without uncaught browser errors. Live encrypted save/open and the second-identity Fabric check remain pending; fixture tests do not substitute for them. The image pulled for this setup was `tideorg/tidecloak-dev:latest` at digest `sha256:3f52d0bc3e4e3ae5153e172960003bbe94705cd40af6561fd4c7c4434aaa2708`.
