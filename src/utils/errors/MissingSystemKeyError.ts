import PostoadError from "./PostoadError.js";

export default class MissingSystemKeyError extends PostoadError {

  constructor() {

    super("Postoad is missing an important system key and cannot continue. Please report this to the bot maintainers.");

  }

}