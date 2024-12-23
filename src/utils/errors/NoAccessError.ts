import PostoadError from "./PostoadError.js";

export default class NoAccessError extends PostoadError {

  constructor() {

    super("Postoad doesn't have access to that account anymore.");

  }

}