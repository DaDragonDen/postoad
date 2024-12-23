import Command from "#utils/Command.js"
import { ApplicationCommandOptionTypes } from "oceanic.js";
import interactWithBlueskyNow from "#utils/interact-with-bluesky-now.js";

const unlikeNowCommand = new Command({
  name: "unlike",
  description: "Unlike a post on Bluesky.",
  options: [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "link",
      description: "What's the link of the post?",
      required: true
    }
  ],
  async action(interaction) {
    
    return await interactWithBlueskyNow(interaction, "unlike", "deleteLike");

  }
});

export default unlikeNowCommand;