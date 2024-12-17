import Command from "#utils/Command.js";
import { Client, InteractionTypes } from "oceanic.js";
import "./express-server.js";

// Sign into Discord.
const client = new Client({
  auth: `Bot ${process.env.DISCORD_TOKEN}`
});

client.on("ready", async () => {

  console.log(`[Discord] Signed in as ${client.user.tag} (${client.user.id}).`);

  // Update the commands that are different from Discord's server.
  await Command.updateCommands(client);

});

client.on("interactionCreate", async (interaction) => {

  switch (interaction.type) {

    case InteractionTypes.APPLICATION_COMMAND:

      try {

        // Check if the command exists.
        const command = await Command.getFromCommandInteraction(interaction);
        await command.execute(interaction);

      } catch (error: unknown) {

      }

      break;

    case InteractionTypes.MODAL_SUBMIT:
    case InteractionTypes.MESSAGE_COMPONENT:
      
      try {

        // Check if the command exists.
        const command = await Command.getFromComponentInteraction(interaction);
        await command.execute(interaction);

      } catch (error: unknown) {



      }

      break;

    default:
      break;

  }
  
});

client.on("error", (error) => {

  console.error(error);

});

client.connect();