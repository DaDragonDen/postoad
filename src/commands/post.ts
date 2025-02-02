import Command from "#utils/Command.js"
import { Agent } from "@atproto/api";
import { ButtonStyles, CommandInteraction, ComponentInteraction, ComponentTypes, Message, ModalSubmitInteraction, StringSelectMenu, TextInputStyles } from "oceanic.js";
import database from "#utils/mongodb-database.js";
import blueskyClient from "#utils/bluesky-client.js";
import { Did } from "@atproto/oauth-client-node";
import getGuildIDFromInteraction from "#utils/get-guild-id-from-interaction.js";
import createAccountSelector from "#utils/create-account-selector.js";
import isGroupKeyCorrect from "#utils/is-group-key-correct.js";
import NoAccessError from "#utils/errors/NoAccessError.js";
import promptSecurityModal from "#utils/prompt-security-modal.js";
import isTOTPTokenCorrect from "#utils/is-totp-token-correct.js";
import MissingSystemKeyError from "#utils/errors/MissingSystemKeyError.js";
import MFAIncorrectCodeError from "#utils/errors/MFAIncorrectCodeError.js";
import IncorrectDecryptionKeyError from "#utils/errors/IncorrectDecryptionKeyError.js";
import PostoadError from "#utils/errors/PostoadError.js";

const command = new Command({
  name: "post",
  description: "Post on behalf of a user on Bluesky.",
  async action(interaction) {

    const guildID = getGuildIDFromInteraction(interaction);

    async function promptUserSelection(guildID: string) {

      // Get the accounts that the server can access.
      const possibleDefaultSession = await sessionsCollection.findOne({guildID, isDefault: true});

      // Ask the user which user they want to post as.
      const originalMessage = await interaction.getOriginal();
      const originalEmbed = originalMessage.embeds?.[0];
      const accountSelector = await createAccountSelector(guildID, "post", (did) => originalEmbed?.footer?.text === did);
      await interaction.editOriginal({
        content: "Which user do you want to post as?",
        embeds: originalEmbed ? [originalEmbed] : undefined,
        components: [
          accountSelector,
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                customID: `post/accountSelector${originalMessage.embeds[0] ? "Update" : "Confirm"}`,
                type: ComponentTypes.BUTTON,
                label: "Continue",
                style: ButtonStyles.PRIMARY,
                disabled: !possibleDefaultSession
              }
            ]
          }
        ]
      });

    }

    async function promptConfirmation(newPostContent: string | undefined, shouldUseEmbedDescription: boolean) {
      
      const originalResponse = await interaction.getOriginal();
      const originalEmbed = originalResponse?.embeds?.[0];
      if (!originalEmbed) throw new Error();

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

    async function submitPost(interaction: ComponentInteraction | ModalSubmitInteraction, originalResponse: Message, decryptionKey?: string) {

      const originalEmbed = originalResponse?.embeds?.[0];
      const did = originalEmbed?.footer?.text;
      const text = originalEmbed?.description;
      if (!did) throw new Error();

      const session = await blueskyClient.restore(did, "auto", {guildID, decryptionKey});
      const agent = new Agent(session);
      
      // Try to get images and videos from attachment sources.
      const attachmentSourceJumpLink = originalEmbed.fields?.[0].value;
      const blobsWithAltText: [Blob, string?][] = [];
      let mode: "image" | "video" = "image";
      if (attachmentSourceJumpLink && !attachmentSourceJumpLink.includes("-#")) {

        // Download each attachment.
        const attachmentSourceJumpLinkSplits = attachmentSourceJumpLink.split("/");
        const channelID = attachmentSourceJumpLinkSplits[attachmentSourceJumpLinkSplits.length - 2];
        const messageID = attachmentSourceJumpLinkSplits[attachmentSourceJumpLinkSplits.length - 1];
        
        try {

          const message = await interaction.client.rest.channels.getMessage(channelID, messageID);
          for (const attachment of message.attachments.filter(() => true)) {

            const response = await fetch(attachment.url);
            if (!response.ok) throw new PostoadError(`Unable to download attachment: ${attachment.url}`);

            const blob = await response.blob();
            const altText = attachment.description;
            blobsWithAltText.push([blob, altText]);

            mode = attachment.contentType?.includes("video") ? "video" : mode;

          }

        } catch {

          // All alone again...

        }

      }

      // Verify that there is at least text or media.
      if (!blobsWithAltText[0] && !text) {

        const originalEmbed = originalResponse.embeds?.[0];
        const originalComponent = originalResponse.components?.[0];

        if (!originalComponent || !originalEmbed) throw new Error();

        await interaction.editOriginal({
          embeds: [
            {
              ...originalEmbed,
              fields: [
                {
                  name: "Attachment source",
                  value: "-# Reply to this message with any media that you want to add."
                }
              ]
            }
          ],
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

    }

    const sessionsCollection = database.collection("sessions");
    const getSessionData = async (did: string) => await sessionsCollection.findOne({guildID, sub: did});

    async function promptChangeText(interaction: ComponentInteraction) {

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
      let did = originalEmbed?.footer?.text;
      if (interaction.isComponentInteraction() && interaction.data.customID === "post/accountSelectorConfirm") {

        const accountSelector = interaction.message?.components[0].components[0] as StringSelectMenu;
        did = accountSelector.options.find((option) => option.default)?.value ?? did;
        handle = (await blueskyClient.didResolver.resolve(did as Did)).alsoKnownAs?.[0].replace("at://", "");
        
      }

      if (!did) throw new Error();

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

    }

    if (interaction instanceof CommandInteraction) {

      await interaction.defer();
      await promptUserSelection(guildID);

      return;

    } else if (interaction instanceof ComponentInteraction) {

      switch (interaction.data.customID) {

        case "post/accountSelectorUpdate":
          await interaction.deferUpdate();
          await promptConfirmation(undefined, true);
          break;

        case "post/accountSelector":
          await interaction.deferUpdate();

          const originalEmbed = interaction.message?.embeds?.[0];
          const accountSelectorActionRow = interaction.message?.components[0];
          const accountSelector = accountSelectorActionRow.components[0] as StringSelectMenu;
          const selectedDID = "values" in interaction.data ? interaction.data.values.getStrings()[0] : undefined;
          const continueButtonActionRow = interaction.message.components[1];
          const options = accountSelector.options.map((option) => ({
            ...option,
            default: option.value === selectedDID
          }));
          const selectedOption = options.find((option) => option.default);

          await interaction.editOriginal({
            ... originalEmbed && selectedOption ? {
              embeds: [{
                ...originalEmbed, 
                author: {
                  name: selectedOption.label
                },
                footer: {
                  text: selectedOption.value
                }
              }]
            } : {},
            components: [
              {
                ...accountSelectorActionRow,
                components: [
                  {
                    ...accountSelector,
                    options
                  }
                ]
              },
              {
                ...continueButtonActionRow,
                components: [
                  {
                    ...continueButtonActionRow.components[0],
                    disabled: !selectedDID
                  }
                ]
              }
            ]
          });
          break;

        case "post/changeAuthor": {

          await interaction.deferUpdate();
          await promptUserSelection(guildID);
          break;

        }

        case "post/changeText":
        case "post/accountSelectorConfirm": {

          await promptChangeText(interaction);
          break;

        }

        case "post/submitPost": {

          // Create a Bluesky client based on the ID.
          const originalResponse = interaction.message;
          const did = interaction.message.embeds[0]?.footer?.text;
          if (!did) throw new Error();

          // Check if the client requires a group password.
          const sessionData = await getSessionData(did);
          if (!sessionData) throw new NoAccessError();

          if (!(await promptSecurityModal(interaction, guildID, did, "post"))) {

            await interaction.deferUpdate();
            await submitPost(interaction, originalResponse);
            
          }

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
      switch (interaction.data.customID) {

        case "post/securityModal": {

          // Make sure we still have a DID.
          const originalResponse = await interaction.getOriginal();
          const originalEmbed = originalResponse?.embeds?.[0];
          const did = originalEmbed?.footer?.text;
          if (!did) throw new Error();

          // Check if the password is correct.
          const sessionData = await getSessionData(did);
          if (!sessionData) throw new NoAccessError();
          const groupDecryptionKey = interaction.data.components.getTextInput("post/key");
          const shouldHaveSystemDecryptionKey = !groupDecryptionKey && sessionData?.keyID;
          const systemDecryptionKey = shouldHaveSystemDecryptionKey ? process.env[`BLUESKY_PRIVATE_KEY_${sessionData.keyID}`] : undefined;
          if (shouldHaveSystemDecryptionKey && !systemDecryptionKey) throw new MissingSystemKeyError();
          const totpToken = interaction.data.components.getTextInput("post/totp");
          const isKeyCorrect = !sessionData || !!sessionData.keyID || (groupDecryptionKey && await isGroupKeyCorrect(sessionData.encryptedSession, groupDecryptionKey));
          const decryptionKey = systemDecryptionKey ?? groupDecryptionKey;
          const isTokenCorrect = isKeyCorrect && (!sessionData?.encryptedTOTPSecret || (totpToken && decryptionKey && await isTOTPTokenCorrect(totpToken, sessionData.encryptedTOTPSecret, decryptionKey)))
          if (isKeyCorrect && isTokenCorrect) {

            await submitPost(interaction, originalResponse, !sessionData.keyID ? groupDecryptionKey : undefined);
            
          } else {

            // Re-enable the components and tell the user that the password was incorrect.
            await promptConfirmation(undefined, true);
            throw isKeyCorrect ? new MFAIncorrectCodeError() : new IncorrectDecryptionKeyError(); 

          }
          
          break;

        }

        case "post/contentModal": {

          const postContent = interaction.data.components.getTextInput("post/content");
          await promptConfirmation(postContent, false);

          break;

        }

        default:
          break;

      }
      
    }

  }
});

export default command;