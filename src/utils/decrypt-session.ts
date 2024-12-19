import { createDecipheriv, createHash } from "crypto";

async function decryptSession(encryptedSession: string, key: string) {

  const keyHash = createHash("sha256").update(key).digest();
  const buffer = Buffer.from(encryptedSession, "base64");
  const iv = buffer.subarray(0, 16);
  const encryptedText = buffer.subarray(16).toString("hex");
  const decipher = createDecipheriv("aes-256-cbc", keyHash, iv);
  let decryptedText = decipher.update(encryptedText, "hex", "utf8");
  decryptedText += decipher.final("utf8");

  // Turn the session back into an object.
  const session = JSON.parse(decryptedText);
  
  return session;

}

export default decryptSession;