import Command from "#utils/Command.js"
import { ApplicationCommandOptionTypes } from "oceanic.js";
import interactWithPostNow from "#utils/interact-with-post-now.js";

const unrepostNowCommand = new Command({
  name: "unrepost",
  description: "Unrepost a post on Bluesky.",
  options: [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "link",
      description: "What's the link of the post?",
      required: true
    }
  ],
  async action(interaction) {
    
    return await interactWithPostNow(interaction, "unrepost", "deleteRepost");

  }
});

export default unrepostNowCommand;