import Command from "#utils/Command.js"
import repostAutoSubCommand from "./repost/auto.js";
import repostNowSubCommand from "./repost/now.js";

const repostCommand = new Command({
  name: "repost",
  description: "Repost something on Bluesky or update auto repost settings.",
  subCommands: [repostNowSubCommand, repostAutoSubCommand]
});

export default repostCommand;