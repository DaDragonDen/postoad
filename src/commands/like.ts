import Command from "#utils/Command.js"
import { Agent } from "@atproto/api";
import { ApplicationCommandOptionTypes, ButtonStyles, CommandInteraction, ComponentInteraction, ComponentTypes, InteractionContent, ModalSubmitInteraction, TextInputStyles } from "oceanic.js";
import database from "#utils/mongodb-database.js";
import blueskyClient from "#utils/bluesky-client.js";
import { Did } from "@atproto/oauth-client-node";

const command = new Command({
  name: "like",
  description: "Like a post on Bluesky.",
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
                customID: "like/accountSelector",
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

      await interaction.deferUpdate();

      // Get the rkey of the post.
      const originalMessage = await interaction.getOriginal();
      const originalEmbed = originalMessage.embeds[0];
      const postLink = originalEmbed?.footer?.text;
      const postSplit = postLink?.split("/");
      const rkey = postSplit?.pop();
      if (!postSplit || !rkey) {

        await interaction.editOriginal({
          content: "Something bad happened. Please try again later.",
          components: [],
          embeds: []
        });

        return;

      }


      // Restore the session.
      const actorDID = "values" in interaction.data ? interaction.data.values.getStrings()[0] : undefined;
      if (!actorDID) {

        await interaction.editOriginal({
          content: "Something bad happened. Please try again later.",
          components: [],
          embeds: []
        });

        return;

      }

      // Get the CID of the post.
      const session = await blueskyClient.restore(actorDID);
      const agent = new Agent(session);
      const postCreatorHandle = postSplit[4];
      const postCreatorDID = await blueskyClient.handleResolver.resolve(postCreatorHandle);
      if (!postCreatorDID) {

        await interaction.editOriginal({
          content: "Something bad happened. Please try again later.",
          components: [],
          embeds: []
        });

        return;

      }

      const { data: {cid} } = await agent.com.atproto.repo.getRecord({
        collection: "app.bsky.feed.post",
        repo: postCreatorDID,
        rkey
      });

      if (!cid) {

        await interaction.editOriginal({
          content: "Something bad happened. Please try again later.",
          components: [],
          embeds: []
        });

        return;

      }

      // Like the post.
      await agent.like(`at://${postCreatorDID}/app.bsky.feed.post/${rkey}`, cid);

      // Let the user know that we liked the post.
      await interaction.editOriginal({
        content: "💖 :)",
        components: [],
        embeds: []
      });

    }

  }
});

export default command;