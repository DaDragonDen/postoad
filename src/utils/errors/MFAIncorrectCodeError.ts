import PostoadError from "./PostoadError.js";

export default class MFAIncorrectCodeError extends PostoadError {

  constructor() {

    super("❌ Incorrect code...");

  }

}