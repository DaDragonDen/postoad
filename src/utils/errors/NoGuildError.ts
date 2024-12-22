import PostoadError from "./PostoadError.js";

export default class NoGuildError extends PostoadError {

  constructor() {

    super("You must use this command in a server.");

  }

}