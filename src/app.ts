import Command from "#utils/Command.js";
import { Client, InteractionTypes } from "oceanic.js";

const client = new Client({
  auth: `Bot ${process.env.DISCORD_TOKEN}`
});

client.on("ready", async () => {

  console.log(`[Discord] Signed in as ${client.user.tag} (${client.user.id}).`);

  // Update the commands that are different from Discord's server.
  await Command.updateCommands(client);

});

client.on("interactionCreate", async (interaction) => {

  if (interaction.type === InteractionTypes.APPLICATION_COMMAND) {

    try {

      // Check if the command exists.
      const command = await Command.getFromInteraction(interaction);
      await command.execute(interaction);

    } catch (error: unknown) {

    }

  }
  
});

client.connect();