import Command from "#utils/Command.js"
import getGuildIDFromInteraction from "#utils/get-guild-id-from-interaction.js";
import database from "#utils/mongodb-database.js";
import { ButtonStyles, CommandInteraction, ComponentInteraction, ComponentTypes } from "oceanic.js";

const forgetSubCommand = new Command({
  name: "forget",
  description: "Request Postoad to delete all guild data and associated accounts from its database.",
  action: async (interaction) => {

    // Verify the guild.
    const guildID = getGuildIDFromInteraction(interaction);
    
    if (interaction instanceof CommandInteraction) {

      await interaction.defer();

      await interaction.createFollowup({
        content: "Are you sure you want to delete all guild data and associated accounts from its database? You cannot undo this action.",
        components: [
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.BUTTON,
                customID: "data/forget/confirm",
                style: ButtonStyles.DANGER,
                label: "Delete everything"
              },
              {
                type: ComponentTypes.BUTTON,
                customID: "data/forget/cancel",
                style: ButtonStyles.SECONDARY,
                label: "Nevermind..."
              }
            ]
          }
        ]
      });

    } else if (interaction instanceof ComponentInteraction) {

      await interaction.deferUpdate();

      switch (interaction.data.customID) {

        case "data/forget/confirm": {

          // Delete all sessions.
          await database.collection("sessions").deleteMany({guildID});
          
          // Let the user know.
          await interaction.editOriginal({
            content: "All data deleted.",
            embeds: [
              {
                description: "Thanks for using Postoad. If there's anything we can do to improve the bot, [let us know](https://github.com/DaDragonDen/postoad/issues)."
              }
            ],
            components: []
          })

          break;

        }

        case "data/forget/cancel":
          await interaction.deleteOriginal();
          break;

        default:
          console.warn(`Unknown custom ID: ${interaction.data.customID}`);
          break;

      }

    }

  }
});

export default forgetSubCommand;
