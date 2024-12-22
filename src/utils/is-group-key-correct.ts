import decryptString from "./decrypt-string.js";

export default async function isGroupKeyCorrect(encryptedString: string, possibleGroupKey: string) {

  try {

    await decryptString(encryptedString, possibleGroupKey);
    return true;

  } catch {

    return false;

  }

}