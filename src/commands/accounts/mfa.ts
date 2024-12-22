import Command from "#utils/Command.js"
import blueskyClient from "#utils/bluesky-client.js"
import database from "#utils/mongodb-database.js";
import { ButtonStyles, CommandInteraction, ComponentTypes } from "oceanic.js";

const mfaSubCommand = new Command({
  name: "mfa",
  description: "Configure multi-factor authentication settings for your Bluesky account sessions.",
  async action(interaction) {

    // Get the Bluesky accounts.
    const { guildID } = interaction;
    if (!guildID) {

      throw new Error("You must use this command in a server.");

    }

    if (interaction instanceof CommandInteraction) {

      await interaction.defer();
      
      const sessions = await database.collection("sessions").find({guildID}).toArray();
      const defaultSession = sessions.find((session) => session.isDefault);
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
        content: "You can configure your multi-factor authentication settings here. Postoad will ask users for a code from their authenticator app before they run a command. If you no longer have access to your authenticator, consider asking someone else. If no one has access to the authenticator, use **/accounts signout** to remove the account, then re-add it back using **/accounts authorize**.",
        components: [
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.STRING_SELECT,
                customID: "accounts/mfa/accountSelector",
                options: handlePairs.map(([handle, sub]) => ({
                  label: handle,
                  value: sub,
                  description: sub,
                  default: sub === defaultSession?.sub
                }))
              }
            ]
          },
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                disabled: !defaultSession,
                type: ComponentTypes.BUTTON,
                customID: "accounts/mfa/configure",
                label: defaultSession?.totpSecret ? "Disable MFA" : "Configure MFA",
                style: defaultSession?.totpSecret ? ButtonStyles.DANGER : ButtonStyles.SUCCESS
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

export default mfaSubCommand;