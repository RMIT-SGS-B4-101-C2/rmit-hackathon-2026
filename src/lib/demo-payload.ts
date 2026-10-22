// Browser-only fixture encoding for the local simulator. This is reversible
// base64 encoding, not encryption, and must only contain fictional survey data.
export const SIMULATED_PAYLOAD_PREFIX = "simulated-only:base64:v1:";

export function encodeSimulatedPayload(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return SIMULATED_PAYLOAD_PREFIX + btoa(binary);
}

export function decodeSimulatedPayload(value: string) {
  if (!value.startsWith(SIMULATED_PAYLOAD_PREFIX)) throw new Error("This is not a simulated fixture payload.");
  const binary = atob(value.slice(SIMULATED_PAYLOAD_PREFIX.length));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
