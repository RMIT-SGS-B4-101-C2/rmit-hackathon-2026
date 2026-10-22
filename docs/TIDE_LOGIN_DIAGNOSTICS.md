# Tide login diagnostics — 22 October 2026

## Current result

Enrollment and realm provisioning completed, but real application login fails during session-token signing. The user sees “Sign-in could not be completed.” Live encrypted save/open and independent-identity checks cannot proceed yet. This report contains no credentials, tokens, authorization codes, or participant identity keys.

## Application callback correction

The app uses Tide's front-channel provider. Its original callback invoked `useAuthCallback`, which the installed SDK documents as a hybrid-mode helper with a separate PKCE storage mechanism. That helper returned to the home page before the provider had established a session.

`src/app/auth/redirect/page.tsx` now lets the provider finish initialization, navigates with the Next router only when authenticated, and displays an error/retry screen when no session was established. No second token exchange is initiated by the callback page.

A headless Chrome regression intercepts the token endpoint with a synthetic HTTP 500 response. It confirms exactly one token exchange and a visible failure screen on `/auth/redirect`. TypeScript and the production build also pass. This regression does not verify the successful live login path.

## Observed server failure

Repeated real login attempts reached TideCloak token encoding. Representative server timestamps are `2026-10-22 05:42:54 UTC`, `05:51:58 UTC`, and `05:52:08 UTC` (12:42–12:52 in Vietnam).

```text
[Midgard] SignModel failed: Exception: Not enough orks returned an ok response
Tide ORK signing failed during token encode:
Midgard.SignModel: Error with signing model: TidecloakSessionStartTokenSign:1
```

The corresponding signing attempt logged HTTP 500 responses from all 20 ORK requests. This establishes a failure of the session-signing operation for this setup; it does not establish a global Tide outage or identify the underlying cause.

## Configuration checks

Tide Doctor passes all 18 checks. Additional read-only local admin lookups confirm:

| Check | Result |
| --- | --- |
| Realm / application client enabled | Yes |
| Governance attestor | Tide |
| Authorization-code flow enabled | Yes |
| DPoP-bound tokens configured | Yes |
| Localhost callback and app origin allowed | Yes |
| Owner identity linked | Yes |
| Pending owner required actions | 0 |
| Effective `appUser`, `_tide_enabled` roles | Present |
| Effective `_tide_vault.selfencrypt`, `_tide_vault.selfdecrypt` roles | Present |
| Pending governance changes | 0 |
| Adapter contains embedded verification key | Yes |

These checks have not identified a missing role, unapproved change, or callback configuration error. They do not exercise successful distributed signing.

## Installed versions

| Component | Version |
| --- | --- |
| TideCloak development image | `0.14.41` (`tideorg/tidecloak-dev:latest` when pulled) |
| Image digest | `sha256:3f52d0bc3e4e3ae5153e172960003bbe94705cd40af6561fd4c7c4434aaa2708` |
| Image revision | `f9d3e906f73b403e748bc95bb774a380d66c1f8e` |
| `@tidecloak/nextjs` | `0.14.40` |
| Transitive `@tidecloak/js` / `@tidecloak/react` | `0.14.41` / `0.14.33` |
| Tide MCP agent pack | `1.9.33` |

## Next investigation

Share this report with the Tide hackathon technical team. Ask them to inspect the ORK rejection for `TidecloakSessionStartTokenSign:1` at the UTC timestamps above and confirm the supported server/Fabric version combination or any required realm repair. A version mismatch is a possibility to investigate, not a confirmed diagnosis.

After a supported correction, retry real login and complete the acceptance checklist in [STAGE_1.md](STAGE_1.md). Preserve the existing realm and persistent volume. No realm reset, image downgrade, or authentication fallback has been applied.

To repeat the local checks from the README's development shell:

```powershell
npm.cmd run tide:doctor -- --check --url http://localhost:3000
node scripts/check-tide-setup.mjs
npm.cmd run test:callback
```

The app must be running for Doctor and the callback regression. The read-only setup diagnostic requires the local `.env` and exported adapter. Do not share those files or unfiltered server logs.
