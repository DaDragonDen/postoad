import Command from "#utils/Command.js"
import { ApplicationCommandOptionTypes, CommandInteraction, ComponentInteraction, ComponentTypes } from "oceanic.js";
import database from "#utils/mongodb-database.js";
import blueskyClient from "#utils/bluesky-client.js";
import interactWithPost from "#utils/interact-with-post.js";

const repostNowSubCommand = new Command({
  name: "now",
  description: "Repost a post on Bluesky.",
  options: [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "link",
      description: "What's the link of the post that you want to like?",
      required: true
    }
  ],
  customIDs: ["accountSelector"],
  async action(interaction) {

    if (interaction instanceof CommandInteraction) {

      // Get the accounts that the server can access.
      await interaction.defer();
      const { guildID } = interaction;
      if (!guildID) {

        throw new Error("You must authorize Postoad to use a Bluesky account before you use this command.");

      }

      const guildData = await database.collection("guilds").findOne({guildID});
      const handlePairs = [];
      for (const sub of guildData?.subs ?? []) {

        const handle = await blueskyClient.didResolver.resolve(sub);
        handlePairs.push([handle.alsoKnownAs?.[0].replace("at://", "") ?? "Unknown handle", sub])

      }

      if (!handlePairs[0]) {

        throw new Error("You must authorize Postoad to use a Bluesky account before you use this command.")

      }

      // Ask the user which user they want to post as.
      const postLink = interaction.data.options.getString("link");
      if (!postLink) {

        await interaction.editOriginal({
          content: "Something bad happened. Please try again later."
        });

        return;

      }

      await interaction.editOriginal({
        content: "Which account do you want to use?",
        embeds: [
          {
            footer: {
              text: postLink.split("?")[0]
            }
          }
        ],
        components: [
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.STRING_SELECT,
                customID: "repost/now/accountSelector",
                options: handlePairs.map(([handle, sub]) => ({
                  label: handle,
                  value: sub,
                  description: sub
                }))
              }
            ]
          }
        ]
      });

    } else if (interaction instanceof ComponentInteraction) {

      // Repost the post.
      await interactWithPost(interaction, "repost");

      // Let the user know that we liked the post.
      await interaction.editOriginal({
        content: "♻️",
        components: [],
        embeds: []
      });

    }

  }
});

export default repostNowSubCommand;