import {
  constants,
  createCipheriv,
  createDecipheriv,
  createHash,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from "node:crypto";

import { encryptedPayloadSchema, type EncryptedPayload } from "@opencori/contracts";

export interface EncryptedRequest {
  encryptedPayload: EncryptedPayload;
  payloadHash: string;
  payloadSizeBytes: number;
}

export function hashEncryptedPayload(encryptedPayload: EncryptedPayload): string {
  const parsed = encryptedPayloadSchema.parse(encryptedPayload);
  return createHash("sha256").update(Buffer.from(parsed.ciphertext, "base64")).digest("hex");
}

export function encryptRequest(
  message: string,
  receiverPublicKeyPem: string,
  keyId: string,
): EncryptedRequest {
  const messageBytes = Buffer.from(message, "utf8");
  if (messageBytes.length === 0 || messageBytes.length > 65_536) {
    throw new RangeError("Request message must contain between 1 and 65536 UTF-8 bytes");
  }

  const dataKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dataKey, iv);
  const ciphertext = Buffer.concat([cipher.update(messageBytes), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();
  const encryptedDataKey = publicEncrypt(
    {
      key: receiverPublicKeyPem,
      oaepHash: "sha256",
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    dataKey,
  );

  return {
    encryptedPayload: encryptedPayloadSchema.parse({
      algorithm: "AES-256-GCM",
      ciphertext: ciphertext.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authenticationTag.toString("base64"),
      encryptedDataKey: encryptedDataKey.toString("base64"),
      keyId,
    }),
    payloadHash: hashEncryptedPayload({
      algorithm: "AES-256-GCM",
      ciphertext: ciphertext.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authenticationTag.toString("base64"),
      encryptedDataKey: encryptedDataKey.toString("base64"),
      keyId,
    }),
    payloadSizeBytes: ciphertext.length,
  };
}

export function decryptRequest(
  encryptedPayload: EncryptedPayload,
  receiverPrivateKeyPem: string,
  expectedKeyId: string,
): string {
  const parsed = encryptedPayloadSchema.parse(encryptedPayload);
  if (parsed.keyId !== expectedKeyId) {
    throw new Error("Encrypted request key ID is not accepted");
  }
  const dataKey = privateDecrypt(
    {
      key: receiverPrivateKeyPem,
      oaepHash: "sha256",
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(parsed.encryptedDataKey, "base64"),
  );
  const decipher = createDecipheriv("aes-256-gcm", dataKey, Buffer.from(parsed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(parsed.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(parsed.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
