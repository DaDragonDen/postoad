import Command from "#utils/Command.js"
import { Agent } from "@atproto/api";
import { ButtonStyles, CommandInteraction, ComponentInteraction, ComponentTypes, ModalSubmitInteraction, TextInputStyles } from "oceanic.js";
import database from "#utils/mongodb-database.js";
import blueskyClient from "#utils/bluesky-client.js";
import { Did } from "@atproto/oauth-client-node";

const command = new Command({
  name: "post",
  description: "Post on behalf of a user on Bluesky.",
  customIDs: ["accountSelector", "contentModal", "submitPost", "cancelPost", "changeAuthor", "changeText"],
  async action(interaction) {

    if (interaction instanceof CommandInteraction) {

      await interaction.defer(this.usesEphemeralMessages ? 64 : undefined);

      // Get the accounts that the server can access.
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
      await interaction.createFollowup({
        content: "Which user do you want to post as?",
        components: [
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.STRING_SELECT,
                customID: "post/accountSelector",
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

      switch (interaction.data.customID) {

        case "post/accountSelector": {

          if (!("values" in interaction.data)) return;

          // Send the modal first because Discord wants an initial response.
          await interaction.createModal({
            customID: "post/contentModal",
            title: "Create a post on Bluesky",
            components: [{
              type: ComponentTypes.ACTION_ROW,
              components: [
                {
                  type: ComponentTypes.TEXT_INPUT,
                  label: "Post content",
                  customID: "post/content",
                  style: TextInputStyles.PARAGRAPH,
                  maxLength: 300,
                  required: false
                }
              ]
            }]
          });

          // Update the message.
          const did = interaction.data.values.getStrings().join();
          const originalResponse = await interaction.getOriginal();
          const authorSection = originalResponse?.embeds?.[0]?.author;
          const handle = !authorSection ? (await blueskyClient.didResolver.resolve(did as Did)).alsoKnownAs?.[0].replace("at://", "") : undefined;

          await interaction.editOriginal({
            content: "What do you want the message to say? Respond in the modal.",
            embeds: [
              {
                author: handle ? {
                  name: handle
                } : authorSection,
                footer: {
                  text: did
                }
              }
            ],
            components: []
          });

          break;

        }

        case "post/submitPost": {

          await interaction.deferUpdate();

          // Create a Bluesky client based on the ID.
          const originalResponse = await interaction.getOriginal();
          const originalEmbed = originalResponse?.embeds?.[0];
          const did = originalEmbed?.footer?.text;
          const text = originalEmbed?.description;
          if (!did || !text) {

            await interaction.editOriginal({
              content: "Something bad happened. Try again later."
            })
            
            return;

          }

          // Post to Bluesky.
          const session = await blueskyClient.restore(did);
          const agent = new Agent(session);
          const post = await agent.post({text});

          // Give the link to the user.
          const uriSplits = post.uri.split("/");
          const postID = uriSplits[uriSplits.length - 1];

          await interaction.editOriginal({
            content: `Posted. https://bsky.app/profile/${did}/post/${postID}`,
            embeds: [],
            components: []
          });

          break;

        }

        default:
          console.warn(`Unknown ID: ${interaction.data.customID}`);
          break;

      }

    } else if (interaction instanceof ModalSubmitInteraction) {

      await interaction.deferUpdate();
      
      const originalResponse = await interaction.getOriginal();
      const originalEmbed = originalResponse?.embeds?.[0];
      if (!originalEmbed) throw new Error("Something bad happened. Try again later.");

      const postContent = interaction.data.components.getTextInput("post/content");
      await interaction.editOriginal({
        content: "Check this out — make sure it looks good. When you're ready, hit submit!",
        embeds: [
          {
            ...originalEmbed,
            description: postContent || undefined
          }
        ],
        components: [
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.BUTTON,
                customID: "post/submitPost",
                style: ButtonStyles.PRIMARY,
                label: "Submit post"
              },
              {
                type: ComponentTypes.BUTTON,
                customID: "post/changeAuthor",
                style: ButtonStyles.SECONDARY,
                label: "Change author"
              },
              {
                type: ComponentTypes.BUTTON,
                customID: "post/changeText",
                style: ButtonStyles.SECONDARY,
                label: "Change post text"
              },
              {
                type: ComponentTypes.BUTTON,
                customID: "post/cancelPost",
                style: ButtonStyles.DANGER,
                label: "Cancel post"
              },
            ]
          }
        ]
      });

    }

  }
});

export default command;