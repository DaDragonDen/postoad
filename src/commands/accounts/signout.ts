import Command from "#utils/Command.js"
import getGuildIDFromInteraction from "#utils/get-guild-id-from-interaction.js";
import getHandlePairs from "#utils/get-handle-pairs.js";
import database from "#utils/mongodb-database.js";
import { CommandInteraction, ComponentTypes } from "oceanic.js";

const signoutSubCommand = new Command({
  name: "signout",
  description: "Disconnect your Bluesky accounts from Postoad.",
  async action(interaction) {

    // Get the Bluesky accounts.
    const guildID = getGuildIDFromInteraction(interaction);

    if (interaction instanceof CommandInteraction) {

      // Ask the user which accounts they want to remove.
      await interaction.defer();
      
      const handlePairs = await getHandlePairs(guildID);

      await interaction.editOriginal({
        content: "Which accounts do you want to sign out of?",
        components: [
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.STRING_SELECT,
                customID: "accounts/signout/accountSelector",
                maxValues: handlePairs.length,
                options: handlePairs.map(([handle, sub]) => ({
                  label: handle,
                  value: sub,
                  description: sub,
                }))
              }
            ]
          }
        ]
      });

    } else {

      await interaction.deferUpdate();

      const dids = "values" in interaction.data ? interaction.data.values.getStrings() : [];
      if (!dids[0]) throw new Error();

      for (const did of dids) {

        await database.collection("sessions").deleteOne({guildID, sub: did});

      }

      await interaction.editOriginal({
        content: `Successfully signed out of ${dids.length} account${dids.length > 1 ? "s" : ""}.`,
        components: []
      })

    }

  }
});

export default signoutSubCommand;