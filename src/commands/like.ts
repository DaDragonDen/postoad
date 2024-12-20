import Command from "#utils/Command.js"
import likeNowSubCommand from "./repost/now.js";

const repostCommand = new Command({
  name: "like",
  description: "Like something on Bluesky or update auto-like settings.",
  subCommands: [likeNowSubCommand]
});

export default repostCommand;