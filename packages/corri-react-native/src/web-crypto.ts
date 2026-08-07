export interface WebCryptoSignatureProvider {
  readonly subtle: SubtleCrypto;
}

interface SignedPayload<T> {
  algorithm: "Ed25519";
  keyId: string;
  payload: T;
  signature: string;
}

interface VerificationKey {
  keyId: string;
  publicKeyPem: string;
}

function canonicalValue(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON does not support non-finite numbers");
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map((item) => canonicalValue(item)).join(",") + "]";
  }

  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Canonical JSON supports only plain objects");
    }
    const entries = Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    if (entries.some(([, item]) => item === undefined)) {
      throw new TypeError("Canonical JSON does not support undefined values");
    }
    return (
      "{" +
      entries.map(([key, item]) => JSON.stringify(key) + ":" + canonicalValue(item)).join(",") +
      "}"
    );
  }

  throw new TypeError("Canonical JSON does not support " + typeof value);
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const decoded = globalThis.atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  return decodeBase64(normalized.padEnd(normalized.length + paddingLength, "="));
}

function decodePublicKey(publicKeyPem: string): Uint8Array<ArrayBuffer> {
  const base64 = publicKeyPem
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s/g, "");
  if (base64.length === 0) {
    throw new TypeError("Expected a PEM-encoded public key");
  }
  return decodeBase64(base64);
}

export async function verifySignedPayloadWithWebCrypto<T>(
  signed: SignedPayload<T>,
  key: VerificationKey,
  cryptoProvider: WebCryptoSignatureProvider = globalThis.crypto,
): Promise<boolean> {
  if (signed.algorithm !== "Ed25519" || signed.keyId !== key.keyId) {
    return false;
  }

  try {
    const publicKey = await cryptoProvider.subtle.importKey(
      "spki",
      decodePublicKey(key.publicKeyPem),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return cryptoProvider.subtle.verify(
      { name: "Ed25519" },
      publicKey,
      decodeBase64Url(signed.signature),
      new TextEncoder().encode(canonicalValue(signed.payload)),
    );
  } catch {
    return false;
  }
}
