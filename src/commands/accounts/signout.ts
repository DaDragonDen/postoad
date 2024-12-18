import Command from "#utils/Command.js"
import blueskyClient from "#utils/bluesky-client.js"
import database from "#utils/mongodb-database.js";
import { ApplicationCommandOptionTypes, CommandInteraction, ComponentInteraction, ComponentTypes } from "oceanic.js";

const signoutSubCommand = new Command({
  name: "signout",
  description: "Disconnect your Bluesky accounts from Postoad.",
  customIDs: ["accountSelector"],
  async action(interaction) {

    if (interaction instanceof CommandInteraction) {

      await interaction.defer();

      // Get the Bluesky accounts.
      const { guildID } = interaction;
      if (!guildID) {

        throw new Error("You must use this command in a server.");

      }

      const guildData = await database.collection("guilds").findOne({guildID});
      const handlePairs = [];
      for (const sub of guildData?.subs ?? []) {

        const handle = await blueskyClient.didResolver.resolve(sub);
        handlePairs.push([handle.alsoKnownAs?.[0].replace("at://", "") ?? "Unknown handle", sub])

      }

      if (!handlePairs[0]) {

        throw new Error("There are no Bluesky accounts associated with this server.")

      }

      // Ask the user which accounts they want to remove.
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
      if (!dids[0]) {

        await interaction.editOriginal({
          content: "Something bad happened. Please try again later.",
          components: []
        });

        return;

      }

      for (const did of dids) {

        const session = await blueskyClient.restore(did);
        await session.signOut();

      }

      await interaction.editOriginal({
        content: `Successfully signed out of ${dids.length} account${dids.length > 1 ? "s" : ""}.`,
        components: []
      })

    }

  }
});

export default signoutSubCommand;