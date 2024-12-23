import Command from "#utils/Command.js"
import createAccountSelector from "#utils/create-account-selector.js";
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

      const accountSelector = await createAccountSelector(guildID, "accounts/signout", undefined, {maxValues: handlePairs.length});
      await interaction.editOriginal({
        content: "Which accounts do you want to sign out of?",
        components: [accountSelector]
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