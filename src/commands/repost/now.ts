import Command from "#utils/Command.js"
import { ApplicationCommandOptionTypes } from "oceanic.js";
import interactWithPostNow from "#utils/interact-with-post-now.js";

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

    return await interactWithPostNow(interaction, "repost/now", "repost");

  }
});

export default repostNowSubCommand;