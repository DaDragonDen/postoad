import Command from "#utils/Command.js"
import { ApplicationCommandOptionTypes } from "oceanic.js";
import interactWithBlueskyNow from "#utils/interact-with-bluesky-now.js";

const unfollowNowCommand = new Command({
  name: "unfollow",
  description: "Unfollow an account on Bluesky.",
  options: [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "handle",
      description: "What's the name of the account?",
      required: true
    }
  ],
  async action(interaction) {
    
    return await interactWithBlueskyNow(interaction, "unfollow", "deleteFollow");

  }
});

export default unfollowNowCommand;