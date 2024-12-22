import Command from "#utils/Command.js"
import createAccountSelector from "#utils/create-account-selector.js";
import getGuildIDFromInteraction from "#utils/get-guild-id-from-interaction.js";
import getHandlePairs from "#utils/get-handle-pairs.js";
import database from "#utils/mongodb-database.js";
import { CommandInteraction, ComponentTypes, StringSelectMenu } from "oceanic.js";

const defaultAccountSubCommand = new Command({
  name: "default",
  description: "Configure the Bluesky account that Postoad will use by default.",
  async action(interaction) {

    // Get the Bluesky accounts.
    const guildID = getGuildIDFromInteraction(interaction);

    if (interaction instanceof CommandInteraction) {

      await interaction.defer();

      // Ask the user which accounts they want to remove.
      const defaultSessionData = await database.collection("sessions").findOne({guildID, isDefault: true});
      const accountSelector = await createAccountSelector(guildID, "accounts/default", (did) => defaultSessionData?.sub === did);
      await interaction.editOriginal({
        content: "Which account do you want Postoad to use by default?",
        components: [accountSelector]
      });

    } else {

      // Make sure a DID was provided.
      await interaction.deferUpdate();
      const accountSelectorActionList = interaction.message?.components[0];
      const accountSelector = accountSelectorActionList?.components[0] as StringSelectMenu;
      const did = "values" in interaction.data ? interaction.data.values.getStrings()[0] : [];
      if (!accountSelectorActionList || !accountSelector) throw new Error();

      // Disable the component while we're editing it.
      const options = accountSelector.options.map((option) => ({
        ...option,
        default: option.value === did
      }));

      await interaction.editOriginal({
        components: [
          {
            ...accountSelectorActionList,
            components: [
              {
                ...accountSelector,
                disabled: true,
                options
              }
            ]
          }
        ]
      });

      // Remove the old default.
      const sessionsCollection = database.collection("sessions");
      await sessionsCollection.updateMany(
        {
          guildID,
          isDefault: true
        }, 
        {
          $unset: {
            isDefault: 1
          }
        }
      )

      // Set the new default.
      if (did) {

        await sessionsCollection.updateOne(
          {
            guildID, 
            sub: did
          },
          {
            $set: {
              isDefault: true
            }
          }
        );

      }

      // Let the user change the account again.
      await interaction.editOriginal({
        components: [
          {
            ...accountSelectorActionList,
            components: [
              {
                ...accountSelector,
                options
              }
            ]
          }
        ]
      });

    }

  }
});

export default defaultAccountSubCommand;