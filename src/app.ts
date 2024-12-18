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

client.on("messageCreate", async (message) => {

  // Check if the author is adding media to their post.
  const {referencedMessage} = message; 
  if (referencedMessage && referencedMessage.author.id === client.user.id && referencedMessage.content.includes("Check this out")) {

    const mainEmbed = referencedMessage.embeds[0];

    await referencedMessage.edit({
      embeds: [
        mainEmbed,
        {
          title: "Included attachments",
          description: `https://discord.com/channels//${referencedMessage.channelID}/${referencedMessage.id}`
        }
      ]
    });

  }

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