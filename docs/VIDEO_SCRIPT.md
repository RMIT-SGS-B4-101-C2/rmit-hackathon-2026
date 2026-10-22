# Two-minute MVP demo video script

Target length: **1:50–2:00**. Use the local simulated TideCloak personas and fictional survey data only. This script shows the consent-controlled sharing flow without claiming that the simulator performs Tide encryption.

## Before recording

- Start the app at `http://localhost:3000` and confirm the local simulator is enabled.
- As **Participant**, save one fictional contribution that has no existing request. Note its short record ID.
- Return to `/`, sign out of the simulation, then choose **Researcher** and open `/research` before starting the screen recording.
- Keep each persona switch short: click **Home**, sign out of the current simulated identity, and choose the next persona.
- Have the narration ready and use the same fresh contribution throughout.

## Recording script

| Time | Screen action | Narration |
| --- | --- | --- |
| 0:00–0:12 | Show the Researcher portal and the contribution card. Keep the simulated TideCloak banner visible. | “This is Research Consent Vault. It lets people share fictional study data only after they approve a named researcher and a specific purpose.” |
| 0:12–0:30 | Enter a clear purpose, such as “Compare fictional sleep and study habits.” Click **Request participant consent** and show **REQUESTED**. | “I’m the researcher. I choose a contribution and explain why I need it. The request is recorded, but the answers stay hidden.” |
| 0:30–0:46 | Switch to **Participant**, open `/vault`, locate the request, and click **Approve**. | “The participant reviews the request and approves it. Consent is a separate decision; approval alone does not release the record.” |
| 0:46–1:00 | Switch to **Realm admin**, open `/admin/policies`, and click **Approve simulated policy gate**. | “A separate administrator checks the policy gate for this request. In the live design, Tide policies limit access to this participant, researcher, and record.” |
| 1:00–1:17 | Switch to **Participant**, return to `/vault`, and click **Prepare simulated share**. Show the success message. | “The participant prepares a separate share for the approved researcher. Their private original remains in their vault.” |
| 1:17–1:36 | Switch to **Researcher**, refresh `/research`, and click **Open permitted record**. Hold on the displayed fictional answers. | “Now the researcher can open the permitted copy. Access only becomes available after the participant’s approval, the admin gate, and the participant’s share are all complete.” |
| 1:36–1:55 | Show the opened fictional values, then the simulator banner. | “The MVP demonstrates the app’s roles, consent steps, and access checks. This local mode simulates TideCloak; its fixture is base64 encoded, not encrypted. Live Tide identity and record-scoped encryption are the production path.” |

## Shorter closing line

If you need to finish at exactly two minutes, end with: **“Your data. Your consent. Access only for the purpose you approve.”**

## Recording tips

- Move the pointer away from the data before each narration pause, and leave the final opened record visible for two seconds.
- If the participant sees **Awaiting policy approval**, switch to the realm admin and approve the gate before preparing the share.
- If the researcher sees **Awaiting share**, the admin gate is complete; return as Participant and prepare the share.
- Do not show real survey data, account credentials, invite links, or browser address-bar query tokens in the recording.
