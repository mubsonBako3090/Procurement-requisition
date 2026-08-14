import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function getKey() {
  const encoded = process.env.SIGNATURE_ENCRYPTION_KEY;

  if (!encoded) {
    throw new Error("SIGNATURE_ENCRYPTION_KEY is not configured.");
  }

  let key;
  try {
    key = Buffer.from(encoded, "base64");
  } catch {
    throw new Error("SIGNATURE_ENCRYPTION_KEY must be base64 encoded.");
  }

  if (key.length !== KEY_LENGTH) {
    throw new Error("SIGNATURE_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }

  return key;
}

export function encryptSignature(signatureDataUrl) {
  if (typeof signatureDataUrl !== "string" || !signatureDataUrl.startsWith("data:image/")) {
    throw new Error("Invalid signature image data.");
  }

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(signatureDataUrl, "utf8")),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // One database-safe value: version:iv:authTag:ciphertext
  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptSignature(payload) {
  if (typeof payload !== "string") {
    throw new Error("Invalid encrypted signature.");
  }

  const [version, ivText, authTagText, ciphertextText] = payload.split(":");
  if (version !== "v1" || !ivText || !authTagText || !ciphertextText) {
    throw new Error("Unsupported encrypted signature format.");
  }

  const key = getKey();
  const iv = Buffer.from(ivText, "base64url");
  const authTag = Buffer.from(authTagText, "base64url");
  const ciphertext = Buffer.from(ciphertextText, "base64url");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
