# Consent Vault login branding

The active login logo was restored to **TideCloak's original logo** at the owner's request on 22 October 2026. `tide-original-logo.png` is the unmodified 838×838 PNG downloaded from [Tide's login service](https://ork5.tideprotocol.com/assets/default-logo.png). The generated background remains active. Settings were saved and re-signed successfully; served logo/background bytes were verified against the local files.

Original logo SHA-256: `700d6e774634b76020e472125667f92cda84631c156b4e87f3768170d9fab825`.

## Saved custom artwork

Generated using Tide Agent Pack's official branding generator, with the owner's approval.

- App name: Consent Vault
- Motif: `vault` (shield)
- Accent: `#246950`
- Logo: `logo.png` (square PNG, circular-safe)
- Background: `background.png`

Both custom assets passed Tide's validation and were previously uploaded and signed for the local `research-consent-vault` realm. The shield in `logo.png` is retained as saved artwork; it is no longer the active login logo.

To explicitly reapply the custom Consent Vault shield and background:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/brand-login.ps1
```

The helper uses the downloaded Tide pack, jq, and a project-local checksum-verified portable Python. Operator credentials are loaded by Tide's script from ignored `.env`; none are stored here. This command replaces the realm's login artwork. It does not change the app's identity or access policies.

The user chose **no profile collection for Stage 1**. No onboarding modal is mounted in the application.
