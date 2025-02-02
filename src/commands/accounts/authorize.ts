import Command from "#utils/Command.js"
import blueskyClient from "#utils/bluesky-client.js"
import getGuildIDFromInteraction from "#utils/get-guild-id-from-interaction.js";
import { ApplicationCommandOptionTypes, CommandInteraction } from "oceanic.js";

const authorizeSubCommand = new Command({
  name: "authorize",
  description: "Pair a Bluesky account with this server.",
  options: [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "handle",
      description: "What's the handle of the Bluesky account?",
      required: true
    }
  ],
  action: async (interaction) => {

    await interaction.defer();
    
    if (!(interaction instanceof CommandInteraction)) {

      throw new Error();

    }

    // Verify the guild.
    const guildID = getGuildIDFromInteraction(interaction);

    // Ensure that a handle was provided.
    const handle = interaction.data.options.getString("handle");
    if (!handle) {

      await interaction.createFollowup({
        content: `Please provide a valid Bluesky handle. For example, "postoad.beastslash.com".`
      })
      return;

    }

    // Create an authorization handle based on the provided handle.
    const authorizationURL = await blueskyClient.authorize(handle, {
      state: guildID
    });

    await interaction.createFollowup({
      content: `Please authorize Postoad to use that account by using this link: ${authorizationURL}`
    });

  }
});

export default authorizeSubCommand;
