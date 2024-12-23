import { authenticator } from "otplib";
import decryptString from "./decrypt-string.js";

export default async function isTOTPTokenCorrect(totpToken: string, encryptedTOTPSecret: string, decryptionKey: string): Promise<boolean> {

  try {

    const decryptedTOTPSecret = encryptedTOTPSecret ? await decryptString(encryptedTOTPSecret, decryptionKey) : undefined;
    return Boolean(decryptedTOTPSecret && totpToken && authenticator.verify({token: totpToken, secret: decryptedTOTPSecret}));

  } catch {

    return false;

  }

}