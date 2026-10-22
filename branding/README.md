# Consent Vault login branding

Generated using Tide Agent Pack's official branding generator, with the owner's approval.

- App name: Consent Vault
- Motif: `vault` (shield)
- Accent: `#246950`
- Logo: `logo.png` (square PNG, circular-safe)
- Background: `background.png`

Both assets passed Tide's validation, were uploaded to the local `research-consent-vault` realm, and the IdP settings were saved and re-signed. Their public endpoints were checked against these files by SHA-256; the served bytes match exactly.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/brand-login.ps1
```

The helper uses the downloaded Tide pack, jq, and a project-local checksum-verified portable Python. Operator credentials are loaded by Tide's script from ignored `.env`; none are stored here. This command replaces the realm's login artwork. It does not change the app's identity or access policies.

The user chose **no profile collection for Stage 1**. No onboarding modal is mounted in the application.
