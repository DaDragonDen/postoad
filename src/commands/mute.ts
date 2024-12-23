import Command from "#utils/Command.js"
import { ApplicationCommandOptionTypes } from "oceanic.js";
import interactWithBlueskyNow from "#utils/interact-with-bluesky-now.js";

const muteNowCommand = new Command({
  name: "mute",
  description: "Mute an account on Bluesky.",
  options: [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "handle",
      description: "What's the name of the account?",
      required: true
    }
  ],
  async action(interaction) {
    
    return await interactWithBlueskyNow(interaction, "mute", "mute");

  }
});

export default muteNowCommand;