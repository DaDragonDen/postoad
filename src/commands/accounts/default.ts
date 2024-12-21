import Command from "#utils/Command.js"
import blueskyClient from "#utils/bluesky-client.js"
import database from "#utils/mongodb-database.js";
import { CommandInteraction, ComponentTypes } from "oceanic.js";

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
      await interaction.editOriginal({
        content: "Which account do you want Postoad to use by default?",
        components: [
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.STRING_SELECT,
                customID: "accounts/default/accountSelector",
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

      // const dids = "values" in interaction.data ? interaction.data.values.getStrings() : [];
      // if (!dids[0]) {

      //   await interaction.editOriginal({
      //     content: "Something bad happened. Please try again later.",
      //     components: []
      //   });

      //   return;

      // }

      // for (const did of dids) {

      //   await database.collection("sessions").deleteOne({sub: did});

      // }

      // await interaction.editOriginal({
      //   content: `Successfully signed out of ${dids.length} account${dids.length > 1 ? "s" : ""}.`,
      //   components: []
      // })

    }

  }
});

export default defaultAccountSubCommand;