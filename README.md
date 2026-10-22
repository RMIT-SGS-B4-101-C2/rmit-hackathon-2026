# Research Consent Vault

RMIT Hackathon 2026: participants contribute synthetic research records, approve access for named researchers, and withdraw future access. **TideCloak provides the identity and encryption foundation.**

## Implementation status

The demo now includes a synthetic survey and owner-only Tide vault, researcher access requests, participant approval/denial/withdrawal, an administrator policy desk, a separate encrypted share, and an activity timeline. Tide enrollment and realm setup are complete, and the owner reported a successful live TideCloak login on 22 October 2026. Real encrypted save/open and two-identity sharing checks remain pending. Earlier sign-in diagnostics are in [login diagnostics](docs/TIDE_LOGIN_DIAGNOSTICS.md); the click-by-click demo is in [docs/DEMO.md](docs/DEMO.md).

- Next.js App Router, TypeScript, Tide SDK, server-side JWT verification, and DPoP proofs.
- `/vault` collects fictional sleep/study survey responses, encrypts the full response before upload, and opens records through Tide in the browser. Participants review named requests, approve/deny/withdraw, prepare a separate ciphertext only after Tide policies are signed, and inspect activity history. Open answers hide within 60 seconds or when the tab is hidden.
- `/research` lets an authenticated researcher request a specific synthetic contribution with a stated purpose. It releases a shared ciphertext only for that researcher's active, unexpired grant; Tide decrypts it in the researcher’s browser.
- `/admin/policies` lets a Tide realm administrator approve two one-record policies in the enclave: participant write-only and researcher read-only. `/api/consent/policies` checks the policies’ subject keys, exact contribution ID, contract/model, operation, key ID, signature presence, and expiry before storing them.
- PostgreSQL persistence, owner-scoped record operations, consent state, and activity events. Old `data/vault/` starter files are no longer used or automatically migrated.
- Responsive participant screens, Zod validation, four Playwright API security groups, and an end-to-end simulator test for role denial, consent, sharing, and withdrawal.
- A setup screen while the real Tide adapter is absent. Protected API requests remain denied. An explicit development-only simulator can exercise app-side identity, role, consent, and ownership checks without live Tide services; it is off by default and never enabled by production builds.

The authenticated API enforces owner/researcher scope, expiry, state transitions, and Tide DPoP. Self-encrypted originals remain private; the participant browser decrypts the original and creates a distinct ciphertext under a Tide write policy for the approved researcher. Withdrawal blocks future app delivery. A researcher who already copied a signed policy or plaintext can retain access until policy expiry or retain the plaintext; never promise immediate per-record cryptographic revocation.

### Assisted setup status (22 October 2026)

- Installed project-local Node.js 24.22.1, npm dependencies, jq 1.8.2, and Microsoft WSL 3.0.3.
- Generated random credentials and saved the owner's Tide licence answers in ignored `.env`.
- Docker Desktop is installed and running after Windows feature setup. PostgreSQL is healthy, and the initial migration has been applied.
- TideCloak is running with a persistent named volume. Owner enrollment is complete, governance is in Tide mode, and the real adapter was exported to ignored `data/tidecloak.json`.
- Prisma generation, TypeScript checks, production build, four API security groups, and the simulated role/consent flow passed. These checks do not prove live Tide encryption.
- Tide Doctor passes all 18 code, adapter, served-relay, and realm checks. Desktop/mobile browser rendering and the unauthenticated vault gate were checked without uncaught browser errors. See [Stage 1 verification](docs/STAGE_1.md) for the remaining live encryption checks.
- The original TideCloak login logo was restored at the owner's request; the generated Consent Vault background remains active. Settings were re-signed and served image bytes verified. The owner chose no profile fields for Stage 1, so no onboarding form is added. See [branding](branding/README.md) for the current artwork and saved custom assets.
- Fixed a callback mismatch: the front-channel provider now owns the token exchange and navigates to the vault only after authentication. A browser regression verifies that a failed token exchange stays visible with retry. The owner subsequently confirmed a successful live login; Doctor alone does not test live token issuance.
- Vault reloads now attempt one top-level session recovery when a previously authenticated tab cannot restore its session silently. The per-tab hint contains no tokens, is cleared on sign-out, and is consumed before redirecting to prevent loops. The callback regression covers the recovery and failure paths; successful live restoration remains a browser acceptance check.

## Recommended stack

| Area | Choice | Purpose |
| --- | --- | --- |
| App and API | Next.js 16 + TypeScript | One project for UI and server endpoints |
| Identity and encryption | TideCloak + `@tidecloak/nextjs` | Login, governed permissions, browser E2EE |
| UI | Next.js React + project CSS + Lucide icons | Participant, researcher, and admin portals |
| Data | PostgreSQL 17 + Prisma 7 | Studies, contributions, grants, activity |
| Validation | Zod | Form and request validation |
| Browser verification | Playwright | Independent participant/researcher sessions |
| Local services | Docker Desktop / Compose | PostgreSQL and local TideCloak |

Node.js 24 is pinned in `.node-version`. Commit `package-lock.json` and use `npm ci` on an existing checkout. Recheck Tide SDK/server compatibility when upgrading.

## Run the app (existing setup)

Use this on the machine that already has the local TideCloak realm, `.env`, and `data/tidecloak.json`. From the repository root, open PowerShell and run:

```powershell
. .\scripts\env.ps1
docker start research-consent-tidecloak
npm.cmd run services:up
npm.cmd run db:migrate
npm.cmd run db:generate
npm.cmd run dev
```

Leave that terminal running and open <http://localhost:3000>. The first two service commands start TideCloak and PostgreSQL; the Prisma commands apply any pending migrations and generate the database client. Do not rerun `npm.cmd run init` on this existing realm. Press **Ctrl+C** to stop the app; `npm.cmd run services:down` stops PostgreSQL, and `docker stop research-consent-tidecloak` stops TideCloak without deleting its data.

To preview the production build locally instead, run `npm.cmd run build` followed by `npm.cmd run start`. For a fresh machine or a new checkout without the local realm, follow [Windows environment setup](#windows-environment-setup) first. To demonstrate sharing, also follow the role and identity setup in [docs/DEMO.md](docs/DEMO.md).

### Use the local TideCloak simulator

If live Tide sign-in or ORK services are unavailable, copy these settings into your ignored `.env` file and restart `npm.cmd run dev`:

```dotenv
DEMO_AUTH_ENABLED=true
DEMO_AUTH_SECRET=<a private random value of at least 32 characters>
```

Generate a value in PowerShell with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. On the home page, choose Participant, Researcher, or Realm admin. Switch personas by signing out and choosing the next one. Protected APIs verify a signed, short-lived, HttpOnly session cookie and enforce the selected persona's app roles, record ownership, consent state, and researcher grant. See [the simulation walkthrough](docs/DEMO.md#local-simulated-tidecloak-walkthrough).

The simulator is only for fictional local data. Its survey fixtures are base64 encoded, not encrypted; it does not issue Tide tokens, verify DPoP, sign policies, or call Tide's cryptographic network. Keep these settings out of production and never enter real personal data. Set `DEMO_AUTH_ENABLED=false` when finished. The simulator requires a Tide adapter to be present because the existing browser app still mounts Tide's provider.

## Windows environment setup

Run from this repository in PowerShell. Git for Windows provides Bash and curl for Tide's scripts.

### 1. Prepare tools and configuration

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/setup.ps1
```

This installs checksum-verified Node.js into ignored `.tools/`, fetches Tide's official pack into ignored `.tide-pack/`, installs dependencies, and creates `.env` with random database/admin credentials if absent. It preserves `.env`, never creates a realm, and never accepts terms. Execution-policy bypass applies only to this process.

Open a development shell with the local tools on PATH:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -NoExit -Command ". ./scripts/env.ps1"
node --version
npm.cmd --version
```

All commands below assume this shell. `npm.cmd` avoids Windows restrictions on npm's PowerShell wrapper. Machine-wide PATH and execution policy are not changed.

### 2. Enable WSL and Docker Desktop

Local Linux containers require WSL 2 and hardware virtualization. If WSL is missing, run in **Administrator PowerShell**:

```powershell
wsl --install --no-distribution
```

If Windows' WSL launcher cannot install it, use the signed x64 MSI from [Microsoft's WSL releases](https://github.com/microsoft/WSL/releases/latest). Follow Microsoft's instructions for enabling Virtual Machine Platform if needed. Restart only when Windows requests it; this project's scripts never restart your computer.

Install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/), choose WSL 2, open Docker Desktop, and review the first-run agreement. Wait for the engine to start. In a fresh development shell:

```powershell
wsl --version
docker version
docker compose version
```

Downloading an installer does not mean Docker is running. Windows administrator actions and a restart may be necessary before containers work. The signed installers are cached in ignored `.tools/` during assisted setup. To finish a blocked installation after enabling Virtual Machine Platform and restarting, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/install-docker.ps1
```

To enable Virtual Machine Platform using the supplied script, run this in Administrator PowerShell. It does not restart Windows:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/enable-wsl.ps1
```

### 3. Start PostgreSQL

The setup script writes matching `POSTGRES_PASSWORD` and `DATABASE_URL` values into `.env`. Keep them synchronized if edited.

```powershell
npm.cmd run services:up
docker compose ps
npm.cmd run db:validate
npm.cmd run db:migrate -- --name init
```

PostgreSQL binds to `127.0.0.1:5432` and stores data in a named volume. `npm.cmd run services:down` stops Compose services without deleting data. Changing the password in `.env` after volume initialization does not change the existing database user's password.

### 4. Bootstrap TideCloak

The chosen hosting path is **local Docker**. Tide's MCP says a realm cannot later move between local and hosted Skycloak. Local TideCloak still reaches Tide's remote Fabric and licensing services; it is not an offline environment.

The owner supplies these values in ignored `.env`:

```dotenv
TIDE_LICENSE_EMAIL=
TIDE_TERMS_ACCEPTED=
```

Use an address you control and set `TIDE_TERMS_ACCEPTED=yes` only after personally accepting [Tide's Terms & Conditions](https://tide.org/legal). The owner's answers were saved separately in `.env` during assisted setup. Never put licence identity, credentials, or accepted-terms state in `.env.example`.

The bootstrap requires `jq` on PATH; this Windows checkout uses `.tools/bin/jq.exe`. Other platforms can install jq with their package manager.

```powershell
npm.cmd run init
```

The first-run script checks prerequisites and consent, refuses to overwrite an exported adapter or existing realm, and starts `research-consent-tidecloak` on `127.0.0.1:8080` with a persistent named volume. It initializes volume ownership for the image's non-root user. It creates realm `research-consent-vault` and client `research-consent-vault-client`, activates Tide, and configures governed changes. `TIDE_REUSE_CONTAINER=1` is only for retrying a failed container startup **before** realm creation; it still refuses to import over an existing realm.

**Open the printed account-linking URL and complete the browser flow.** At that step, decide whether to brand the login screen and which optional profile fields to collect. Tide MCP provides `tide_branding` and `tide_onboarding`. Do not invent profile names/emails or assume the licence email belongs to every user.

Bootstrap then completes approvals and exports `data/tidecloak.json` (ignored). For subsequent sessions, start the existing container instead of bootstrapping again:

```powershell
docker start research-consent-tidecloak
npm.cmd run services:up
```

The bootstrap uses Tide's supported development image, `tideorg/tidecloak-dev:latest`. Record its tested digest after first successful setup. This development database/image is not production infrastructure.

### 5. Run and verify

```powershell
npm.cmd run db:generate
npm.cmd run typecheck
npm.cmd run build
npm.cmd run tide:doctor -- --check
npm.cmd run dev
```

Open <http://localhost:3000>. Before bootstrap, the setup screen is expected and Tide Doctor reports the missing adapter. After bootstrap, restart the app and perform a real login. From another development shell:

```powershell
npm.cmd run tide:doctor -- --check --url http://localhost:3000
```

Doctor must pass with the real adapter and served relay before claiming authentication works. A successful build does not verify login, encryption, sharing, or revocation.

If sign-in shows “Sign-in could not be completed”, consult [the current diagnostic report](docs/TIDE_LOGIN_DIAGNOSTICS.md). From a second shell while the app runs, these checks reproduce the callback failure handling and inspect local realm configuration:

```powershell
npm.cmd run test:callback
node scripts/check-tide-setup.mjs
```

The callback test intercepts the token endpoint with a synthetic failure; it cannot establish a real Tide session. The setup diagnostic performs read-only realm lookups using the local admin credentials in `.env`, printing only checks and counts. Neither check proves live login works.

## Repository map

| Path | Purpose |
| --- | --- |
| `.env.example` / `.env` | Variable template / ignored local credentials and licence answers |
| `compose.yaml` | PostgreSQL and persistent named volume |
| `prisma/schema.prisma` | Starting studies, ciphertext contributions, grants, and event schema |
| `src/lib/db.ts` / `src/lib/vault-store.ts` | Prisma connection and owner-scoped encrypted-record persistence |
| `src/app/api/consent/route.ts` | Consent requests, decisions, shared ciphertext, and scoped researcher delivery |
| `src/app/api/consent/policies/route.ts` | Admin policy queue and policy-scope/expiry checks |
| `src/lib/relationship.ts` | Tide `RelationshipAttestation:1` signing and browser encrypt/decrypt helpers |
| `docs/DEMO.md` | Two-identity demo walkthrough and remaining live checks |
| `src/lib/survey.ts` | Fixed demo study, synthetic survey schema, ciphertext-envelope validation |
| `tests/api.security.spec.ts` | Real API/PostgreSQL integration checks with ephemeral fixture credentials |
| `docs/STAGE_1.md` | Stage 1 acceptance checks and implementation limits |
| `scripts/setup.ps1` | Repeatable Windows preparation; preserves local config |
| `scripts/env.ps1` | Local tool PATH for the current development shell |
| `scripts/init-tidecloak.sh` | First-run Tide bootstrap adapted from the official starter |
| `src/lib/auth/` | Server JWT and DPoP verification wrappers |
| `src/lib/auth/demo-session.ts` / `src/app/api/demo-auth/` | Development-only signed persona sessions and role claims |
| `public/tide_dpop_auth.html` | Byte-exact Tide relay; do not format or add a trailing newline |

`npm.cmd run db:studio` opens Prisma Studio. `docker stop research-consent-tidecloak` stops Tide. Neither deletes persistent data. Supplied ignores cover secrets, generated adapters, vault files, dependencies, tools, and installers.

Run `npm.cmd run test:security` with local PostgreSQL ready. This starts an isolated server on port 3101 and tests real JWT/DPoP verification and database ownership rules. It does not exercise the Tide Fabric or modify the real realm adapter. Run it separately from production builds, since both own subdirectories of `.next`.

## Recommended build stages

| Stage | Deliverable | Completion check |
| --- | --- | --- |
| 1. Identity and encryption | Implemented | Live owner save/open and second identity still need acceptance |
| 2. Sharing and withdrawal | Implemented with Tide relationship policies | Live two-identity encrypt/decrypt and withdrawal expiry still need acceptance |
| 3. Participant dashboard | Implemented | Complete with a real consent request |
| 4. Researcher dashboard | Implemented | Complete with an active signed grant |
| 5. Activity history | Implemented | Ordinary application history, not proof of plaintext viewing or an immutable ledger |
| 6. Demo and checks | Demo path documented | Run live steps in [docs/DEMO.md](docs/DEMO.md); fixture API checks do not prove Fabric behavior |

Start with structured synthetic sleep/study-habit surveys. Add documents, bulk exports, large files, and AI analysis after the consent flow works.

### Application and cryptographic authorization

Each protected API verifies Tide JWT and DPoP proof, then checks ownership, researcher approval, active consent, study/contribution scope, and expiry. Reuse `withAuth`/`withRole`; UI checks are insufficient. Client API calls use the hook's `secureFetch` with absolute URLs to attach proofs.

Sharing will adapt Tide's built-in `RelationshipAttestation:1` contract. Each shared vault/contribution needs a scoped signed policy and matching encryption tag. Do not grant shared capability roles to every user by default. The reference requires a Tide realm administrator to sign policies in the enclave; participant consent is not automatically a signed policy. Keep a grant `PENDING_POLICY` until the required cryptographic setup succeeds.

Prove this mapping with real separate identities before building dashboards. The MCP documents role/group updates taking token refresh, up to 120 seconds. Immediate API denial and cryptographic revocation are separate checks: test retained ciphertext, policies, and credentials before promising instant decryption revocation.

The schema includes named researcher identity, contribution/study, purpose, expiry, withdrawal state, and scoped signed policies. A general researcher role never grants access to all participants' data. The policy desk requires the `tide-realm-admin` client role on `realm-management`; participants and researchers need the corresponding `_tide_encryptor` / `_tide_decryptor` realm role, and the network must contain `RelationshipAttestation:1`.

### Demo story

1. Alice submits an encrypted synthetic survey.
2. Bob, an approved researcher, requests it for a named study and purpose.
3. Alice grants consent; required policy approval completes; Bob opens it.
4. Charlie, a different researcher, is denied.
5. Alice withdraws consent; Bob's next API access is denied. Show verified cryptographic revocation behavior separately.
6. Show Alice's activity timeline.

Withdrawal stops future authorized access; it cannot erase data already viewed or copied. Record access attempts separately from client-reported decryption success. Download logs do not prove plaintext viewing, and a database activity table is not a tamper-proof ledger.

## References

- [Tide Next.js SDK](https://docs.tide.org/Languages/NextJS/tidecloak-nextjs-intro)
- [Tide E2EE setup](https://docs.tide.org/Admin/e2ee)
- [Tide terms](https://tide.org/legal)
- [Docker Windows installation](https://docs.docker.com/desktop/setup/install/windows-install/)
- [Microsoft WSL installation](https://learn.microsoft.com/windows/wsl/install)
- [Prisma configuration](https://docs.prisma.io/docs/orm/reference/prisma-config-reference)

The connected Tide MCP reported **Tide Agent Pack v1.9.33**. Its shared-vault scenario informed this plan; the checked-in starter currently demonstrates owner-only encryption.
