import Command from "#utils/Command.js"
import forgetSubCommand from "./data/forget.js";
import encryptSubCommand from "./data/encrypt.js";

const dataCommand = new Command({
  name: "data",
  description: "Manage data that Postoad has about this server and associated accounts.",
  subCommands: [forgetSubCommand, encryptSubCommand]
});

export default dataCommand;