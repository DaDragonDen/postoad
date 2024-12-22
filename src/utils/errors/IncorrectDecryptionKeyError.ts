import PostoadError from "./PostoadError.js";

export default class IncorrectDecryptionKeyError extends PostoadError {

  constructor() {

    super("❌ Incorrect decryption key...");

  }

}