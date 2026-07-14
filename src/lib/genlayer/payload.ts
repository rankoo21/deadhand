// Client-side payload confidentiality for Deadhand.
//
// The reviewer's ask: the secret message must NEVER be stored on-chain as
// plaintext. Only a commitment goes on-chain. Here the commitment is a
// client-encrypted ciphertext envelope (AES-256-GCM) plus a SHA-256 commitment
// hash of the plaintext. The AES key is generated client-side and is NEVER put
// on-chain or inside the envelope; it is held only in the author's browser
// (localStorage). On-chain data therefore reveals nothing about the secret
// before release, and even the revealed reference (the ciphertext) cannot be
// read without the client-held key.
//
// Flow:
//   commitPayload(plaintext)  -> { commitment, keyRef }  (call before seal)
//   rememberKey(vaultId, key) -> persist the key locally, keyed by vault id
//   revealPayload(vaultId, commitment) -> plaintext if the local key exists,
//                                         otherwise the opaque reference itself.

export interface PayloadCommitment {
  // The opaque blob stored on-chain. JSON with version, algorithm, iv, the
  // ciphertext, and the plaintext commitment hash. No key material.
  commitment: string;
  // The raw AES key (base64) to persist client-side after the vault id is known.
  keyRef: string;
}

const ENVELOPE_VERSION = 1;
const ENVELOPE_ALG = "AES-GCM-256";
const KEY_STORAGE_PREFIX = "deadhand.payloadKey.";

function hasSubtle(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as any).crypto !== "undefined" &&
    typeof (globalThis as any).crypto.subtle !== "undefined"
  );
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  if (typeof btoa !== "undefined") return btoa(binary);
  // Node/build fallback.
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(b64: string): Uint8Array {
  if (typeof atob !== "undefined") {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  if (hasSubtle()) {
    const digest = await (globalThis as any).crypto.subtle.digest("SHA-256", data);
    const bytes = new Uint8Array(digest);
    let hex = "";
    for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
    return hex;
  }
  // Deterministic non-crypto fallback (build/SSR only; browser always has subtle).
  let h1 = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h1 ^= text.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0");
}

// Build the on-chain commitment (ciphertext envelope + plaintext hash). The
// plaintext never leaves this function except as ciphertext.
export async function commitPayload(plaintext: string): Promise<PayloadCommitment> {
  const clean = plaintext.trim();
  const hash = await sha256Hex(clean);

  if (!hasSubtle()) {
    // Should not happen in the browser. Never emit plaintext; emit a hash-only
    // commitment so the on-chain data still reveals nothing.
    return {
      commitment: JSON.stringify({ v: ENVELOPE_VERSION, alg: "sha256-only", hash }),
      keyRef: "",
    };
  }

  const subtle = (globalThis as any).crypto.subtle;
  const iv = (globalThis as any).crypto.getRandomValues(new Uint8Array(12));
  const key = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const cipherBuf = await subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(clean),
  );
  const rawKey = new Uint8Array(await subtle.exportKey("raw", key));

  const commitment = JSON.stringify({
    v: ENVELOPE_VERSION,
    alg: ENVELOPE_ALG,
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(cipherBuf)),
    hash,
  });

  return { commitment, keyRef: toBase64(rawKey) };
}

// Persist the client-held key once the vault id is known. Never on-chain.
export function rememberKey(vaultId: string, keyRef: string): void {
  if (!keyRef || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_STORAGE_PREFIX + vaultId, keyRef);
  } catch {
    // storage unavailable: the key is simply not persisted this session.
  }
}

function loadKey(vaultId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY_STORAGE_PREFIX + vaultId);
  } catch {
    return null;
  }
}

// After release, turn the revealed commitment back into readable plaintext when
// the client-held key is present. If it is not (a different browser or the
// recipient's device), return the opaque reference so the UI can show that the
// plaintext is held client-side and must be supplied out of band.
export async function revealPayload(
  vaultId: string,
  commitment: string,
): Promise<string> {
  if (!commitment) return "";
  let env: any;
  try {
    env = JSON.parse(commitment);
  } catch {
    // Not one of our envelopes (e.g. a legacy reference); show as-is.
    return commitment;
  }
  if (!env || env.alg !== ENVELOPE_ALG || !hasSubtle()) {
    return commitment;
  }
  const keyRef = loadKey(vaultId);
  if (!keyRef) return commitment;
  try {
    const subtle = (globalThis as any).crypto.subtle;
    const key = await subtle.importKey(
      "raw",
      fromBase64(keyRef),
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const plainBuf = await subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(env.iv) },
      key,
      fromBase64(env.ct),
    );
    return new TextDecoder().decode(plainBuf);
  } catch {
    return commitment;
  }
}
