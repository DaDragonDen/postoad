import Command from "#utils/Command.js"
import { Agent } from "@atproto/api";
import { ButtonStyles, CommandInteraction, ComponentInteraction, ComponentTypes, InteractionContent, ModalSubmitInteraction, TextInputStyles } from "oceanic.js";
import database from "#utils/mongodb-database.js";
import blueskyClient from "#utils/bluesky-client.js";
import { Did } from "@atproto/oauth-client-node";

const command = new Command({
  name: "post",
  description: "Post on behalf of a user on Bluesky.",
  customIDs: ["accountSelector", "contentModal", "submitPost", "cancelPost", "changeAuthor", "changeText"],
  async action(interaction) {

    async function promptUserSelection() {

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

        throw new Error("You must authorize Postoad to use a Bluesky account before you use this command.");

      }

      // Ask the user which user they want to post as.
      const originalMessage = await interaction.getOriginal();
      await interaction.editOriginal({
        content: "Which user do you want to post as?",
        components: [
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.STRING_SELECT,
                customID: `post/accountSelector${originalMessage.embeds[0] ? "Update" : ""}`,
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

    }

    async function promptConfirmation(newPostContent: string | undefined, shouldUseEmbedDescription: boolean) {
      
      const originalResponse = await interaction.getOriginal();
      const originalEmbed = originalResponse?.embeds?.[0];
      if (!originalEmbed) throw new Error("Something bad happened. Try again later.");

      await interaction.editOriginal({
        content: "Check this out — make sure it looks good. Reply to this message with any media that you want to add. When you're ready, hit submit!\n-# Note: Bluesky limits the images and [videos](https://bsky.social/about/blog/09-11-2024-video) that you can post.",
        embeds: [
          {
            ...originalEmbed,
            description: (shouldUseEmbedDescription ? originalEmbed.description : newPostContent) || undefined
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

    if (interaction instanceof CommandInteraction) {

      await interaction.defer();
      await promptUserSelection();

    } else if (interaction instanceof ComponentInteraction) {

      switch (interaction.data.customID) {

        case "post/accountSelectorUpdate":
          await interaction.deferUpdate();
          await promptConfirmation(undefined, true);
          break;

        case "post/changeAuthor": {

          await interaction.deferUpdate();
          promptUserSelection();
          break;

        }

        case "post/changeText":
        case "post/accountSelector": {

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
          const originalResponse = await interaction.getOriginal();
          const originalEmbed = originalResponse.embeds?.[0];
          const authorSection = originalEmbed?.author;
          const did = "values" in interaction.data ? interaction.data.values.getStrings().join() : originalEmbed?.footer?.text;
          const handle = !authorSection ? (await blueskyClient.didResolver.resolve(did as Did)).alsoKnownAs?.[0].replace("at://", "") : undefined;
          if (!did) {

            await interaction.editOriginal({
              content: "Something bad happened. Try again later.",
              embeds: [],
              components: []
            });

            return;

          }

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
              content: "Something bad happened. Try again later.",
              embeds: [],
              components: []
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

        case "post/cancelPost": {

          await interaction.deferUpdate();
          await interaction.deleteOriginal();

          break;

        }

        default:
          console.warn(`Unknown ID: ${interaction.data.customID}`);
          break;

      }

    } else if (interaction instanceof ModalSubmitInteraction) {

      await interaction.deferUpdate();
      const postContent = interaction.data.components.getTextInput("post/content");
      await promptConfirmation(postContent, false);

    }

  }
});

export default command;