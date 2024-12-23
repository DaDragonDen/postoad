import PostoadError from "./PostoadError.js";

export default class MFAConflictError extends PostoadError {

  constructor() {

    super("MFA has been previously set up with this session.");

  }

}