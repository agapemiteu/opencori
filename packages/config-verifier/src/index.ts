import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

export interface SigningKey {
  keyId: string;
  privateKeyPem: string;
}

export interface VerificationKey {
  keyId: string;
  publicKeyPem: string;
}

export interface SignedPayload<T> {
  algorithm: "Ed25519";
  keyId: string;
  payload: T;
  signature: string;
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
    return `[${value.map((item) => canonicalValue(item)).join(",")}]`;
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
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalValue(item)}`)
      .join(",")}}`;
  }

  throw new TypeError(`Canonical JSON does not support ${typeof value}`);
}

export function canonicalize(value: unknown): string {
  return canonicalValue(value);
}

export function signPayload<T>(payload: T, key: SigningKey): SignedPayload<T> {
  const privateKey = createPrivateKey(key.privateKeyPem);
  const signature = sign(null, Buffer.from(canonicalize(payload), "utf8"), privateKey);

  return {
    algorithm: "Ed25519",
    keyId: key.keyId,
    payload,
    signature: signature.toString("base64url"),
  };
}

export function verifySignedPayload<T>(signed: SignedPayload<T>, key: VerificationKey): boolean {
  if (signed.algorithm !== "Ed25519" || signed.keyId !== key.keyId) {
    return false;
  }

  try {
    const publicKey = createPublicKey(key.publicKeyPem);
    return verify(
      null,
      Buffer.from(canonicalize(signed.payload), "utf8"),
      publicKey,
      Buffer.from(signed.signature, "base64url"),
    );
  } catch {
    return false;
  }
}
