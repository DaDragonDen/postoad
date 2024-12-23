import PostoadError from "./PostoadError.js";

export default class MFARemovedError extends PostoadError {

  constructor() {

    super("That session doesn't have an MFA requirement anymore.");

  }

}