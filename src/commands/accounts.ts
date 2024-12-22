import Command from "#utils/Command.js"
import authorizeSubCommand from "./accounts/authorize.js";
import defaultAccountSubCommand from "./accounts/default.js";
import mfaSubCommand from "./accounts/mfa.js";
import signoutSubCommand from "./accounts/signout.js";

const accountsCommand = new Command({
  name: "accounts",
  description: "Add a Bluesky account with an app password.",
  subCommands: [authorizeSubCommand, signoutSubCommand, defaultAccountSubCommand, mfaSubCommand]
});

export default accountsCommand;