import PostoadError from "./PostoadError.js";

export default class NoSessionsError extends PostoadError {

  constructor() {

    super("You haven't added any Bluesky accounts yet. Use **/accounts authorize** to set up Postoad.");

  }

}