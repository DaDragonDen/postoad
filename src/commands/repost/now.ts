import Command from "#utils/Command.js"
import { ApplicationCommandOptionTypes } from "oceanic.js";
import interactWithBlueskyNow from "#utils/interact-with-bluesky-now.js";

const repostNowSubCommand = new Command({
  name: "now",
  description: "Repost a post on Bluesky.",
  options: [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "link",
      description: "What's the link of the post?",
      required: true
    }
  ],
  async action(interaction) {

    return await interactWithBlueskyNow(interaction, "repost/now", "repost");

  }
});

export default repostNowSubCommand;