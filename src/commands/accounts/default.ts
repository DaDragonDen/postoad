import Command from "#utils/Command.js"
import blueskyClient from "#utils/bluesky-client.js"
import database from "#utils/mongodb-database.js";
import { CommandInteraction, ComponentTypes, StringSelectMenu } from "oceanic.js";

const defaultAccountSubCommand = new Command({
  name: "default",
  description: "Configure the Bluesky account that Postoad will use by default.",
  async action(interaction) {

    // Get the Bluesky accounts.
    const { guildID } = interaction;
    if (!guildID) {

      throw new Error("You must use this command in a server.");

    }

    if (interaction instanceof CommandInteraction) {

      await interaction.defer();
      
      const sessions = await database.collection("sessions").find({guildID}).toArray();
      const handlePairs = [];
      for (const session of sessions) {

        const {sub} = session;
        const handle = await blueskyClient.didResolver.resolve(sub);
        handlePairs.push([handle.alsoKnownAs?.[0].replace("at://", "") ?? "Unknown handle", sub])

      }

      if (!handlePairs[0]) {

        throw new Error("There are no Bluesky accounts associated with this server.")

      }

      // Ask the user which accounts they want to remove.
      const defaultSessionData = sessions.find((sessionData) => sessionData.isDefault);
      await interaction.editOriginal({
        content: "Which account do you want Postoad to use by default?",
        components: [
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.STRING_SELECT,
                customID: "accounts/default/accountSelector",
                minValues: 0,
                options: handlePairs.map(([handle, sub]) => ({
                  label: handle,
                  value: sub,
                  description: sub,
                  default: defaultSessionData?.sub === sub
                }))
              }
            ]
          }
        ]
      });

    } else {

      // Make sure a DID was provided.
      await interaction.deferUpdate();
      const accountSelectorActionList = interaction.message?.components[0];
      const accountSelector = accountSelectorActionList?.components[0] as StringSelectMenu;
      const did = "values" in interaction.data ? interaction.data.values.getStrings()[0] : [];
      if (!accountSelectorActionList || !accountSelector) {

        await interaction.editOriginal({
          content: "Something bad happened. Please try again later.",
          components: []
        });

        return;

      }      

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