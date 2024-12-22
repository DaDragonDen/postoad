import { createCipheriv, createHash, randomBytes } from "crypto";

async function encryptString(decryptedSession: string, key: string) {
  
  // Encrypt the session using the key.
  const keyHash = createHash("sha256").update(key).digest();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", keyHash, iv);
  let encryptedSession = cipher.update(decryptedSession, "utf8", "hex");
  encryptedSession += cipher.final("hex");
  const encryptedSessionBase64 = Buffer.concat([iv, Buffer.from(encryptedSession, "hex")]).toString("base64");

  return encryptedSessionBase64;

}

export default encryptString;