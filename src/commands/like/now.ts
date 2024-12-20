import Command from "#utils/Command.js"
import { ApplicationCommandOptionTypes } from "oceanic.js";
import interactWithPostNow from "#utils/interact-with-post-now.js";

const likeNowSubCommand = new Command({
  name: "now",
  description: "Like a post on Bluesky.",
  options: [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "link",
      description: "What's the link of the post that you want to like?",
      required: true
    }
  ],
  async action(interaction) {
    
    return await interactWithPostNow(interaction, "like");

  }
});

export default likeNowSubCommand;