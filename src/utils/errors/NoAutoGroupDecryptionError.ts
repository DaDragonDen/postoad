import PostoadError from "./PostoadError.js";

export default class NoAutoGroupDecryptionError extends PostoadError {

  constructor() {

    super("This server has requested for Postoad to encrypt your sessions using a group password. Postoad cannot automatically act on your behalf without your attention. To use this feature, please change your data encryption settings through the **/data encrypt** command.");

  }

}