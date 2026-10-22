# Research Consent Vault

RMIT Hackathon 2026: participants contribute synthetic research records, approve access for named researchers, and withdraw future access. **TideCloak provides the identity and encryption foundation.**

## Implementation status

Stage 1 code is implemented: a synthetic survey, browser-side Tide self-encryption, and an owner-only PostgreSQL vault. The complete research consent portal is still to be built. Tide enrollment and realm setup are complete, but live login is blocked by Tide session-token signing errors. See [login diagnostics](docs/TIDE_LOGIN_DIAGNOSTICS.md). Real encrypted save/open and second-identity acceptance checks remain pending.

- Next.js App Router, TypeScript, Tide SDK, server-side JWT verification, and DPoP proofs.
- `/vault` collects fictional sleep/study survey responses, encrypts the full response before upload, and opens records through Tide in the browser. Open answers hide within 60 seconds or when the tab is hidden.
- PostgreSQL persistence, an applied initial Prisma migration, owner-scoped list/read/delete operations, and atomic create/delete activity events. Old `data/vault/` starter files are no longer used or automatically migrated.
- Responsive participant screens, Zod validation, and four Playwright API security test groups covering authenticated isolation, DPoP binding/replay, and request validation.
- A setup screen while the real Tide adapter is absent. Protected API requests remain denied; no mock identity is provided.

Researcher sharing, policy signing, consent requests, withdrawal, expiry enforcement, and role dashboards are planned. Self-encrypted prototype entries cannot be made shareable just by changing a database flag.

### Assisted setup status (22 October 2026)

- Installed project-local Node.js 24.22.1, npm dependencies, jq 1.8.2, and Microsoft WSL 3.0.3.
- Generated random credentials and saved the owner's Tide licence answers in ignored `.env`.
- Docker Desktop is installed and running after Windows feature setup. PostgreSQL is healthy, and the initial migration has been applied.
- TideCloak is running with a persistent named volume. Owner enrollment is complete, governance is in Tide mode, and the real adapter was exported to ignored `data/tidecloak.json`.
- Prisma generation, TypeScript checks, production build, and four API security test groups passed. Fixture tests do not prove live Tide encryption.
- Tide Doctor passes all 18 code, adapter, served-relay, and realm checks. Desktop/mobile browser rendering and the unauthenticated vault gate were checked without uncaught browser errors. See [Stage 1 verification](docs/STAGE_1.md) for the remaining live encryption checks.
- Consent Vault login branding is generated, uploaded, signed, and byte-verified. The owner chose no profile fields for Stage 1, so no onboarding form is added. See [branding](branding/README.md) for regeneration instructions.
- Fixed a callback mismatch: the front-channel provider now owns the token exchange and navigates to the vault only after authentication. A browser regression verifies that a failed token exchange stays visible with retry. Real attempts still fail on Tide's `TidecloakSessionStartTokenSign:1` model; Doctor does not test successful live token issuance.

## Recommended stack

| Area | Choice | Purpose |
| --- | --- | --- |
| App and API | Next.js 16 + TypeScript | One project for UI and server endpoints |
| Identity and encryption | TideCloak + `@tidecloak/nextjs` | Login, governed permissions, browser E2EE |
| UI | Tailwind CSS + shadcn/ui | Dashboards and consent forms |
| Data | PostgreSQL 17 + Prisma 7 | Studies, contributions, grants, activity |
| Validation | Zod | Form and request validation |
| Browser verification | Playwright | Independent participant/researcher sessions |
| Local services | Docker Desktop / Compose | PostgreSQL and local TideCloak |

Node.js 24 is pinned in `.node-version`. Commit `package-lock.json` and use `npm ci` on an existing checkout. Recheck Tide SDK/server compatibility when upgrading.

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
| `src/lib/survey.ts` | Fixed demo study, synthetic survey schema, ciphertext-envelope validation |
| `tests/api.security.spec.ts` | Real API/PostgreSQL integration checks with ephemeral fixture credentials |
| `docs/STAGE_1.md` | Stage 1 acceptance checks and implementation limits |
| `scripts/setup.ps1` | Repeatable Windows preparation; preserves local config |
| `scripts/env.ps1` | Local tool PATH for the current development shell |
| `scripts/init-tidecloak.sh` | First-run Tide bootstrap adapted from the official starter |
| `src/lib/auth/` | Server JWT and DPoP verification wrappers |
| `public/tide_dpop_auth.html` | Byte-exact Tide relay; do not format or add a trailing newline |

`npm.cmd run db:studio` opens Prisma Studio. `docker stop research-consent-tidecloak` stops Tide. Neither deletes persistent data. Supplied ignores cover secrets, generated adapters, vault files, dependencies, tools, and installers.

Run `npm.cmd run test:security` with local PostgreSQL ready. This starts an isolated server on port 3101 and tests real JWT/DPoP verification and database ownership rules. It does not exercise the Tide Fabric or modify the real realm adapter. Run it separately from production builds, since both own subdirectories of `.next`.

## Recommended build stages

| Stage | Deliverable | Completion check |
| --- | --- | --- |
| 1. Identity and encryption | Real Tide login and one synthetic encrypted survey | Owner decrypts; another identity cannot |
| 2. Sharing and withdrawal | Named-recipient Tide policy and consent mapping | Approved researcher decrypts, unrelated researcher fails; withdrawal timing measured |
| 3. Participant dashboard | Contributions, requests, expiry, grant/withdraw controls | Participant completes the flow through the app |
| 4. Researcher dashboard | Study descriptions, purpose-based requests, permitted record viewer | Only approved researchers with active scoped grants see records |
| 5. Activity history | Requests, grants, withdrawal, access, and reported decryption | Participant can inspect a clear timeline |
| 6. Demo and checks | Synthetic fixtures and meaningful Playwright scenarios | Independent sessions reproduce allowed and denied cases |

Start with structured synthetic sleep/study-habit surveys. Add documents, bulk exports, large files, and AI analysis after the consent flow works.

### Application and cryptographic authorization

Each protected API verifies Tide JWT and DPoP proof, then checks ownership, researcher approval, active consent, study/contribution scope, and expiry. Reuse `withAuth`/`withRole`; UI checks are insufficient. Client API calls use the hook's `secureFetch` with absolute URLs to attach proofs.

Sharing will adapt Tide's built-in `RelationshipAttestation:1` contract. Each shared vault/contribution needs a scoped signed policy and matching encryption tag. Do not grant shared capability roles to every user by default. The reference requires a Tide realm administrator to sign policies in the enclave; participant consent is not automatically a signed policy. Keep a grant `PENDING_POLICY` until the required cryptographic setup succeeds.

Prove this mapping with real separate identities before building dashboards. The MCP documents role/group updates taking token refresh, up to 120 seconds. Immediate API denial and cryptographic revocation are separate checks: test retained ciphertext, policies, and credentials before promising instant decryption revocation.

The initial schema includes named researcher identity, contribution/study, purpose, expiry, withdrawal state, and optional signed policy. Researcher approval and access-request workflows remain to be implemented. A general researcher role never grants access to all participants' data.

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
