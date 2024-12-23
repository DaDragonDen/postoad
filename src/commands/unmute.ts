import Command from "#utils/Command.js"
import { ApplicationCommandOptionTypes } from "oceanic.js";
import interactWithBlueskyNow from "#utils/interact-with-bluesky-now.js";

const unmuteNowCommand = new Command({
  name: "unmute",
  description: "Unmute an account on Bluesky.",
  options: [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "handle",
      description: "What's the name of the account?",
      required: true
    }
  ],
  async action(interaction) {
    
    return await interactWithBlueskyNow(interaction, "unmute", "unmute");

  }
});

export default unmuteNowCommand;