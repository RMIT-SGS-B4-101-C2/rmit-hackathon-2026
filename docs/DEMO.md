# Research Consent Vault demo

This runbook covers the participant, researcher, and realm-admin screens. Use fictional survey entries only.

## Before the demo

1. Start the existing TideCloak container and PostgreSQL, then apply the consent workflow migration:

   ```powershell
   docker start research-consent-tidecloak
   npm.cmd run services:up
   npm.cmd run db:migrate
   npm.cmd run db:generate
   npm.cmd run dev
   ```

2. Confirm `data/tidecloak.json` is the real adapter and `npm.cmd run tide:doctor -- --check --url http://localhost:3000` passes.
3. Confirm the Fabric network has the built-in `RelationshipAttestation:1` contract. It is present on ORK main since 16 October 2026, but an older network may not have it. If policy signing reports an unknown contract, stop and ask Tide; do not substitute a custom contract.
4. Use three separate Tide identities if possible: participant, researcher, and realm administrator. Each account must sign in after its roles are granted. The client must emit the `tideuserkey` claim. The participant needs `_tide_encryptor`; the researcher needs `_tide_decryptor`; the admin needs the `tide-realm-admin` client role on `realm-management`. Do not put encryptor/decryptor in default roles.
5. Use separate browser profiles for each identity. Avoid testing owner and researcher with the same logged-in account.

## Demo flow

1. **Participant:** sign in at `/vault`, select **Fill a synthetic example**, then encrypt and save. Open it again to show that only the participant can open the original self-encrypted entry.
2. **Researcher:** open `/research`, select a record ID, write a specific purpose of at least 12 characters, and request consent. Requests are bound to the researcher's verified Tide subject and `tideuserkey`.
3. **Participant:** return to `/vault`, review the named request and purpose, and approve it. This records consent but does not yet release any data.
4. **Realm administrator:** open `/admin/policies`. For the approved request, use the enclave to approve the participant's write-only policy and the named researcher's read-only policy. Both policies name the same contribution ID and expire with the consent. The app's policy route verifies their user keys, assignment ID, key ID, contract/model, permitted role, signature presence, and expiry.
5. **Participant:** return to `/vault` and choose **Prepare encrypted share**. Tide opens the original in the participant's browser and encrypts a separate copy for the record ID. The owner-only original remains unchanged. The API changes the request to active only after this ciphertext is saved.
6. **Researcher:** return to `/research` and open the permitted record. The API rechecks that the caller is the named researcher and consent is active and unexpired; Tide decrypts the shared ciphertext in the researcher’s browser.
7. **Participant:** withdraw access. Subsequent delivery is denied. A researcher who already copied a signed policy may still decrypt until its expiry, and plaintext already viewed or copied cannot be recalled.
8. **Participant:** expand Activity history to review request, decision, policy, share, delivery, and withdrawal events. This is app history, not an immutable ledger or proof that a person read plaintext.

## What each layer proves

- The API checks Tide JWT, DPoP, roles, subject ownership, grant status, purpose, contribution, and expiry on each request.
- The signed `RelationshipAttestation:1` policy limits encryption/decryption to one record ID and one named Tide user. The app server stores ciphertext and policy bytes; it does not decrypt survey data.
- A withdrawal blocks future API delivery and deletes the policy from the application's grant row. It does not instantly revoke a policy copy already held by a researcher. This demo uses short consent expiry as the per-user revocation boundary.
- API security fixtures do not prove the network policy contract or live Tide encryption. Complete the two-identity save/open, grant, denial, and withdrawal checks before claiming those live properties.

## If the policy desk cannot sign

Check that the admin signed in after receiving the `realm-management` client role, pop-ups are allowed, and the network contains `RelationshipAttestation:1`. Check that participant and researcher have signed in after receiving `_tide_encryptor` / `_tide_decryptor`. If Tide returns “unknown contract,” stop; the network needs a Tide update. If an API reports a missing `tideuserkey`, enable the Tide User Key mapper and have the affected account sign in again. No UI status or database approval bypasses these requirements.
