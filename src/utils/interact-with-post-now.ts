import { ButtonStyles, CommandInteraction, ComponentInteraction, ComponentTypes, ModalSubmitInteraction, StringSelectMenu } from "oceanic.js";
import interactWithPost from "./interact-with-post.js";
import database from "./mongodb-database.js";
import createAccountSelector from "./create-account-selector.js";
import getGuildIDFromInteraction from "./get-guild-id-from-interaction.js";
import isGroupKeyCorrect from "./is-group-key-correct.js";
import promptSecurityModal from "./prompt-security-modal.js";
import MissingSystemKeyError from "./errors/MissingSystemKeyError.js";
import decryptString from "./decrypt-string.js";
import { authenticator } from "otplib";
import IncorrectDecryptionKeyError from "./errors/IncorrectDecryptionKeyError.js";
import MFAIncorrectCodeError from "./errors/MFAIncorrectCodeError.js";

async function interactWithPostNow(interaction: CommandInteraction | ComponentInteraction | ModalSubmitInteraction, customIDPrefix: string, action: "deleteRepost" | "like" | "deleteLike" | "repost") {

  const guildID = getGuildIDFromInteraction(interaction);

  async function confirmAction(options: {interaction: ModalSubmitInteraction | ComponentInteraction, guildID: string, actorDID: string, decryptionKey?: string}) {

    // Repost the post.
    await interactWithPost(options, action);

    // Let the user know that we liked the post.
    const responses = {
      repost: "♻️",
      like: "💖",
      deleteLike: "💔",
      deleteRepost: "🗑️"
    };
    await interaction.editOriginal({
      content: responses[action],
      components: [],
      embeds: []
    });

  }

  if (interaction instanceof CommandInteraction) {

    // Ask the user which user they want to post as.
    await interaction.defer(64);
    const postLink = interaction.data.options.getString("link");
    if (!postLink) throw new Error();

    const defaultSession = await database.collection("sessions").findOne({guildID, isDefault: true});
    const accountSelector = await createAccountSelector(guildID, customIDPrefix, (did) => did === defaultSession?.sub);

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
        accountSelector,
        {
          type: ComponentTypes.ACTION_ROW,
          components: [
            {
              type: ComponentTypes.BUTTON,
              customID: `${customIDPrefix}/confirm`,
              label: "Continue",
              style: ButtonStyles.PRIMARY
            }
          ]
        }
      ]
    });

  } else if (interaction instanceof ComponentInteraction) {

    // Check if a password is necessary.
    const originalMessage = interaction.message;
    const accountSelector = originalMessage.components[0]?.components[0] as StringSelectMenu;
    const actorDID = accountSelector.options.find((option) => option.default)?.value;
    const sessionData = await database.collection("sessions").findOne({guildID, sub: actorDID});
    if (!actorDID || !sessionData) throw new Error();
    
    if (interaction.data.customID === `${customIDPrefix}/accountSelector`) {

      await interaction.deferUpdate();
      const actorDID = "values" in interaction.data ? interaction.data.values.getStrings()[0] : undefined;

      await interaction.editOriginal({
        components: [
          {
            ...originalMessage.components[0],
            components: [
              {
                ...accountSelector,
                options: accountSelector.options.map((component) => ({
                  ...component,
                  default: component.value === actorDID
                }))
              }
            ]
          },
          originalMessage.components[1]
        ]
      });

    } else if (!(await promptSecurityModal(interaction, guildID, actorDID, customIDPrefix))) {

      await interaction.deferUpdate();
      await confirmAction({interaction, guildID, actorDID});

    }

  } else if (interaction instanceof ModalSubmitInteraction) {

    // Check if the guild still has a security level.
    await interaction.deferUpdate();
    const originalMessage = await interaction.getOriginal();
    const accountSelectorActionRow = originalMessage.components?.[0];
    const accountSelector = accountSelectorActionRow?.components[0];
    const options = "options" in accountSelector ? accountSelector.options : undefined;
    const actorDID = options?.find((option) => option.default)?.value;
    let decryptionKey = interaction.data.components.getTextInput(`${customIDPrefix}/key`);
    const totpToken = interaction.data.components.getTextInput(`${customIDPrefix}/totp`);
    const sessionData = await database.collection("sessions").findOne({guildID, sub: actorDID});
    if (!sessionData || !actorDID) throw new Error();

    async function resetSelection() {

      await interaction.editOriginal({
        components: [
          {
            ...accountSelectorActionRow,
            components: [
              {
                ...accountSelector,
                disabled: false
              }
            ]
          },
          {
            ...originalMessage.components[1],
            components: [
              {
                ...originalMessage.components[1].components[0],
                disabled: false
              }
            ]
          }
        ]
      });

    }

    // Check if there's an encryption.
    if (sessionData.keyID) {

      // Verify that the system has the correct key.
      const possibleKey = process.env[`BLUESKY_PRIVATE_KEY_${sessionData.keyID}`];
      if (!possibleKey) throw new MissingSystemKeyError();
      decryptionKey = possibleKey;

    } else {

      // Check if the password is correct.
      if (!decryptionKey || !(await isGroupKeyCorrect(sessionData.encryptedSession, decryptionKey))) {

        await resetSelection();
        throw new IncorrectDecryptionKeyError();

      }

    }

    // Verify the TOTP if necessary.
    const decryptedTOTPSecret = sessionData.encryptedTOTPSecret ? await decryptString(sessionData.encryptedTOTPSecret, decryptionKey) : undefined;
    if (decryptedTOTPSecret && (!totpToken || !authenticator.verify({token: totpToken, secret: decryptedTOTPSecret}))) {

      await resetSelection();
      throw new MFAIncorrectCodeError();

    }

    // Run the action.
    await confirmAction({interaction, guildID, decryptionKey, actorDID});

  }

}

export default interactWithPostNow;