import Command from "#utils/Command.js"
import blueskyClient from "#utils/bluesky-client.js"
import database from "#utils/mongodb-database.js";
import { ButtonStyles, CommandInteraction, ComponentInteraction, ComponentTypes } from "oceanic.js";

const forgetSubCommand = new Command({
  name: "forget",
  description: "Request Postoad to delete all guild data and associated accounts from its database.",
  customIDs: ["confirm"],
  action: async (interaction) => {

    await interaction.defer();

    // Verify the guild.
    const {guildID} = interaction;
    if (!guildID) {

      await interaction.createFollowup({
        content: "You can only run this command in servers that you manage."
      });
      return;

    }
    
    if (interaction instanceof CommandInteraction) {

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

      switch (interaction.data.customID) {

        case "data/forget/confirm": {

          // Delete the guild data.
          const guildData = await database.collection("guilds").findOneAndDelete({guildID});
          
          // Delete all sessions.
          for (const sub of guildData?.subs || []) {

            // Revoke the session.
            const session = await blueskyClient.restore(sub);
            await session.signOut();

          }

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
