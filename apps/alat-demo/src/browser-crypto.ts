import { encryptedPayloadSchema } from "@corri/contracts";

import type { AlatEncryptedRequest } from "./index.js";

export interface AlatBrowserCryptoProvider {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  readonly subtle: SubtleCrypto;
}

function encodeBase64(value: Uint8Array<ArrayBuffer>): string {
  let binary = "";
  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }
  return globalThis.btoa(binary);
}

function decodePublicKey(publicKeyPem: string): Uint8Array<ArrayBuffer> {
  const base64 = publicKeyPem
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s/g, "");
  if (base64.length === 0) {
    throw new TypeError("Expected a PEM-encoded receiver public key");
  }
  const decoded = globalThis.atob(base64);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function toHex(value: Uint8Array<ArrayBuffer>): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function encryptRequestWithWebCrypto(
  message: string,
  receiverPublicKeyPem: string,
  keyId: string,
  cryptoProvider: AlatBrowserCryptoProvider = globalThis.crypto,
): Promise<AlatEncryptedRequest> {
  const messageBytes = new TextEncoder().encode(message);
  if (messageBytes.byteLength === 0 || messageBytes.byteLength > 65_536) {
    throw new RangeError("Request message must contain between 1 and 65536 UTF-8 bytes");
  }

  const dataKeyBytes = cryptoProvider.getRandomValues(new Uint8Array(32));
  const iv = cryptoProvider.getRandomValues(new Uint8Array(12));
  const receiverPublicKey = await cryptoProvider.subtle.importKey(
    "spki",
    decodePublicKey(receiverPublicKeyPem),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
  const dataKey = await cryptoProvider.subtle.importKey(
    "raw",
    dataKeyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const encrypted = new Uint8Array(
    await cryptoProvider.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      dataKey,
      messageBytes,
    ),
  );
  const authenticationTagLength = 16;
  const ciphertext = encrypted.slice(0, -authenticationTagLength);
  const authenticationTag = encrypted.slice(-authenticationTagLength);
  const encryptedDataKey = new Uint8Array(
    await cryptoProvider.subtle.encrypt({ name: "RSA-OAEP" }, receiverPublicKey, dataKeyBytes),
  );
  const payloadHash = new Uint8Array(await cryptoProvider.subtle.digest("SHA-256", ciphertext));

  return {
    encryptedPayload: encryptedPayloadSchema.parse({
      algorithm: "AES-256-GCM",
      ciphertext: encodeBase64(ciphertext),
      iv: encodeBase64(iv),
      authTag: encodeBase64(authenticationTag),
      encryptedDataKey: encodeBase64(encryptedDataKey),
      keyId,
    }),
    payloadHash: toHex(payloadHash),
    payloadSizeBytes: ciphertext.byteLength,
  };
}
