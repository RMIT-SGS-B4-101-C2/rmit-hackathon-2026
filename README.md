# Research Consent Vault

Local MVP for sharing fictional research contributions through participant consent, researcher requests, and an administrator policy gate.

## Run the app

These steps assume this machine has already been set up, with `.env`, `data/tidecloak.json`, Docker Desktop, and the local TideCloak realm in place. Open PowerShell in the repository root:

```powershell
. .\scripts\env.ps1
docker start research-consent-tidecloak
npm.cmd run services:up
npm.cmd run db:migrate
npm.cmd run db:generate
npm.cmd run dev
```

Keep the terminal open and browse to <http://localhost:3000>. Stop the app with **Ctrl+C**. To stop the local services without deleting their data, run `npm.cmd run services:down` and `docker stop research-consent-tidecloak`.

## Test the demo

For a quick demo without creating separate Tide accounts, make sure `.env` contains:

```dotenv
DEMO_AUTH_ENABLED=true
DEMO_AUTH_SECRET=<private random value of at least 32 characters>
```

Generate a secret with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Restart `npm.cmd run dev` after changing `.env`. On the home page, choose a simulated persona. To switch roles, return to **Home**, sign out of the current simulation, and choose the next persona.

1. **Participant:** open `/vault`, choose **Fill a synthetic example**, then save it. Use fictional answers only.
2. **Researcher:** choose the Researcher persona, open `/research`, enter a clear purpose of at least 12 characters, and request the new contribution.
3. **Participant:** switch personas and approve the request in `/vault`.
4. **Realm admin:** switch personas, open `/admin/policies`, and approve the simulated policy gate.
5. **Participant:** return to `/vault` and prepare the simulated share.
6. **Researcher:** return to `/research`, refresh, and open the permitted record. Optionally withdraw access as Participant and verify the researcher can no longer open it.

The local simulator checks app roles, record ownership, consent, and grant state. It does **not** issue Tide tokens, verify DPoP, encrypt data, or sign Tide policies; simulated survey fixtures are base64 encoded. Do not enter real personal information. For the live Tide flow, use separate participant, researcher, and realm-admin Tide identities.

## Automated checks

With local PostgreSQL running and `.env` configured, run:

```powershell
npm.cmd run typecheck
npm.cmd run test:security
```

The Playwright security tests start a separate app server on port `3101` and test the API and simulated consent flow against the configured local database. They do not test Tide's cryptographic network or prove live encryption.
