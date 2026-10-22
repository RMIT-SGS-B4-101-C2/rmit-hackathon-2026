// A per-tab navigation hint, never evidence of authentication or authorization.
// Tokens and identity details are deliberately not stored here.
export const SESSION_RECOVERY_KEY = "consent-vault:resume-session";

export function rememberSession() {
  try { window.sessionStorage.setItem(SESSION_RECOVERY_KEY, "1"); } catch { /* Storage may be disabled. */ }
}

export function forgetSession() {
  try { window.sessionStorage.removeItem(SESSION_RECOVERY_KEY); } catch { /* Storage may be disabled. */ }
}

export function consumeSessionRecovery(): boolean {
  try {
    const remembered = window.sessionStorage.getItem(SESSION_RECOVERY_KEY) === "1";
    // Consume before navigating: a failed callback/reload cannot start a loop.
    window.sessionStorage.removeItem(SESSION_RECOVERY_KEY);
    return remembered;
  } catch { return false; }
}
