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

    const { guildID } = interaction;
    if (!guildID) {

      throw new Error("You must authorize Postoad to use a Bluesky account before you use this command.");

    }

    async function promptUserSelection() {

      // Get the accounts that the server can access.
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

      const description = (shouldUseEmbedDescription ? originalEmbed.description : newPostContent) || undefined;
      const attachmentSources = originalEmbed.fields?.[0]?.value ?? "-# Reply to this message with any media that you want to add.";

      await interaction.editOriginal({
        content: "Check this out — make sure it looks good. When you're ready, hit submit!\n-# Note: Bluesky limits the images and [videos](https://bsky.social/about/blog/09-11-2024-video) that you can post.",
        embeds: [
          {
            ...originalEmbed,
            description,
            fields: [
              {
                name: "Attachment source",
                value: attachmentSources
              }
            ]
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
                label: "Submit post",
                disabled: attachmentSources.includes("Reply") && !description
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
          let handle;
          let did;
          if (interaction.data.customID === "post/accountSelector") {

            did = "values" in interaction.data ? interaction.data.values.getStrings().join() : originalEmbed?.footer?.text;
            handle = (await blueskyClient.didResolver.resolve(did as Did)).alsoKnownAs?.[0].replace("at://", "");
            if (!did) {

              await interaction.editOriginal({
                content: "Something bad happened. Try again later.",
                embeds: [],
                components: []
              });

              return;

            }
            
          }

          await interaction.editOriginal({
            content: "What do you want the message to say? Respond in the modal.",
            embeds: handle && did ? [
              {
                author: {
                  name: handle
                },
                footer: {
                  text: did
                }
              }
            ] : originalResponse.embeds,
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
          if (!did) {

            await interaction.editOriginal({
              content: "Something bad happened. Try again later.",
              embeds: [],
              components: []
            });
            
            return;

          }
          
          const session = await blueskyClient.restore(did, "auto", {guildID});
          const agent = new Agent(session);
          
          // Try to get images and videos from attachment sources.
          const attachmentSourceJumpLink = originalEmbed.fields?.[0].value;
          const blobsWithAltText: [Blob, string?][] = [];
          let mode: "image" | "video" = "image";
          if (attachmentSourceJumpLink && !attachmentSourceJumpLink.includes("-#")) {

            // 
            const attachmentSourceJumpLinkSplits = attachmentSourceJumpLink.split("/");
            const channelID = attachmentSourceJumpLinkSplits[attachmentSourceJumpLinkSplits.length - 2];
            const messageID = attachmentSourceJumpLinkSplits[attachmentSourceJumpLinkSplits.length - 1];
            const message = await interaction.client.rest.channels.getMessage(channelID, messageID);
            for (const attachment of message.attachments.filter(() => true)) {

              const response = await fetch(attachment.url);
              if (!response.ok) {

                

              }

              const blob = await response.blob();
              const altText = attachment.description;
              blobsWithAltText.push([blob, altText]);

              if (attachment.contentType?.includes("video")) {

                mode = "video";

              }

            }

          }

          // Verify that there is at least text or media.
          if (!blobsWithAltText[0] && !text) {

            const originalComponent = originalResponse.components?.[0];

            if (!originalComponent) return;

            await interaction.editOriginal({
              components: [
                {
                  ...originalComponent,
                  components: originalComponent.components.map((component, index) => index === 0 ? {
                    type: ComponentTypes.BUTTON,
                    customID: "post/submitPost",
                    style: ButtonStyles.PRIMARY,
                    label: "Submit post",
                    disabled: true
                  } : component)
                }
              ]
            });

            return;

          }

          const media = [];
          for (const blob of blobsWithAltText) {

            const {data} = await agent.uploadBlob(blob[0]);
            media.push({
              alt: blob[1] ?? "",
              [mode === "video" ? "video" : "image"]: data.blob
            });

          }

          // Post to Bluesky.
          const post = await agent.post({
            text: text ?? "", 
            embed: mode === "video" ? {
              $type: "app.bsky.embed.video",
              ...media[0]
            } : {
              $type: "app.bsky.embed.images",
              images: media
            }
          });

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