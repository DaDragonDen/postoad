import Command from "#utils/Command.js"
import createAccountSelector from "#utils/create-account-selector.js";
import decryptString from "#utils/decrypt-string.js";
import encryptString from "#utils/encrypt-string.js";
import IncorrectDecryptionKeyError from "#utils/errors/IncorrectDecryptionKeyError.js";
import MFAIncorrectCodeError from "#utils/errors/MFAIncorrectCodeError.js";
import MissingSystemKeyError from "#utils/errors/MissingSystemKeyError.js";
import NoAccessError from "#utils/errors/NoAccessError.js";
import getGuildIDFromInteraction from "#utils/get-guild-id-from-interaction.js";
import getRandomKey from "#utils/get-random-key.js";
import isGroupKeyCorrect from "#utils/is-group-key-correct.js";
import database from "#utils/mongodb-database.js";
import promptSecurityModal from "#utils/prompt-security-modal.js";
import { CommandInteraction, ComponentInteraction, ComponentTypes, ModalSubmitInteraction, StringSelectMenu } from "oceanic.js";
import { authenticator } from "otplib";

const encryptSubCommand = new Command({
  name: "encrypt",
  description: "Change the encryption settings of your guild's Bluesky sessions.",
  action: async (interaction) => {

    // Verify the guild.
    const guildID = getGuildIDFromInteraction(interaction);

    if (interaction instanceof CommandInteraction) {

      await interaction.defer(64);

      const accountSelector = await createAccountSelector(guildID, "data/encrypt");

      await interaction.createFollowup({
        content: "How do you want Postoad to encrypt your sessions?" + 
          "\n* **Encrypt using system password:** Your sessions will be encrypted using a system password. You can use the bot without Postoad asking for a password." +
          "\n* **Encrypt using group password:** Your sessions will be encrypted using an group password, potentially protecting you from malicious actors with database and system access. However, automatic posting will be disabled because Postoad cannot automatically decrypt the passwords without your attention.",
        components: [
          accountSelector, 
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.STRING_SELECT,
                customID: "data/encrypt/method",
                disabled: true,
                options: [
                  {
                    label: "Encrypt using system password",
                    value: "system",
                    description: "Most convenient"
                  },
                  {
                    label: "Encrypt using group password",
                    value: "group",
                    description: "Most secure"
                  }
                ]
              }
            ]
          }
        ]
      });

    } else if (interaction instanceof ComponentInteraction) {

      const originalComponents = interaction.message.components;
      const accountSelectMenuActionRow = originalComponents[0];
      const accountSelectMenu = accountSelectMenuActionRow?.components?.[0] as StringSelectMenu;
      const securitySelectMenuActionRow = originalComponents[1];
      const securitySelectMenu = originalComponents[1]?.components?.[0] as StringSelectMenu;

      switch (interaction.data.customID) {

        case "data/encrypt/accountSelector": {

          // Catch the event.
          await interaction.deferUpdate();

          // Get the current security level of the DID.
          const selectedDID = "values" in interaction.data ? interaction.data.values.getStrings()[0] : undefined;
          const sessionData = await database.collection("sessions").findOne({sub: selectedDID});
          if (!sessionData) throw new NoAccessError();

          // Set the selection as the default so that the bot knows in the future.
          const encryptionType = sessionData.keyID ? "system" : "group";

          await interaction.editOriginal({
            components: [
              {
                ...accountSelectMenuActionRow, 
                components: [
                  {
                    ...accountSelectMenu,
                    options: accountSelectMenu.options.map((option) => ({
                      ...option,
                      default: option.value === selectedDID
                    }))
                  }
                ]
              },
              {
                ...securitySelectMenuActionRow,
                components: [
                  {
                    ...securitySelectMenu,
                    disabled: false,
                    options: securitySelectMenu.options.map((option) => ({
                      ...option,
                      default: option.value === encryptionType
                    }))
                  }
                ]
              }
            ]
          });

          break;

        }

        case "data/encrypt/method": {
          
          // Make sure a method was provided.
          const goalEncryptionType = "values" in interaction.data ? interaction.data.values.getStrings()[0] : undefined;
          const did = accountSelectMenu.options.find((option) => option.default)?.value;
          if (!goalEncryptionType || !did) throw new Error();

          const sessionData = await database.collection("sessions").findOne({sub: did});
          if (!sessionData) throw new NoAccessError();

          const encryptionType = sessionData.keyID ? "system" : "group";
          if (encryptionType === goalEncryptionType) {
            
            await interaction.deferUpdate();

          } else {

            // Ask the user for a current password.
            const isNewEncryption = encryptionType === "system";
            await promptSecurityModal(interaction, guildID, did, "data/encrypt", isNewEncryption ? "key" : undefined);

            await interaction.editOriginal({
              components: [
                accountSelectMenuActionRow,
                {
                  ...securitySelectMenuActionRow,
                  components: [
                    {
                      ...securitySelectMenu,
                      disabled: true,
                      options: securitySelectMenu.options.map((option) => ({
                        ...option,
                        default: option.value === goalEncryptionType
                      }))
                    }
                  ]
                }
              ]
            })

          }

          break;

        }

        default:
          console.warn(`Unknown custom ID: ${interaction.data.customID}`);
          break;

      }

    } else if (interaction instanceof ModalSubmitInteraction) {

      // Catch the event so we can use .getOriginal().
      await interaction.deferUpdate();

      // Get the goal encryption level.
      const originalMessage = await interaction.getOriginal();
      const originalComponents = originalMessage.components;
      const accountSelectMenuActionRow = originalComponents[0];
      const accountSelectMenu = accountSelectMenuActionRow?.components?.[0] as StringSelectMenu;
      const selectedDID = accountSelectMenu.options.find((option) => option.default)?.value;
      const securitySelectMenuActionRow = originalComponents[1];
      const securitySelectMenu = securitySelectMenuActionRow?.components?.[0] as StringSelectMenu;
      const goalEncryptionType = securitySelectMenu.options.find((option) => option.default)?.value;
      const groupKey = interaction.data.components.getTextInput("data/encrypt/key");
      const totpToken = interaction.data.components.getTextInput("data/encrypt/totp");
      if (!selectedDID || !goalEncryptionType || !groupKey) throw new Error();

      const sessionData = await database.collection("sessions").findOne({guildID, sub: selectedDID});
      if (!sessionData) throw new NoAccessError();

      // Check if that's the correct key.
      async function resetEncryptionTypeSelector() {

        await interaction.editOriginal({
          components: [
            {
              ...accountSelectMenuActionRow,
              components: [
                {
                  ...accountSelectMenu,
                  disabled: false
                }
              ]
            },
            {
              ...securitySelectMenuActionRow,
              components: [
                {
                  ...securitySelectMenu,
                  disabled: false,
                  options: securitySelectMenu.options.map((option) => ({
                    ...option,
                    default: option.value === currentEncryptionType
                  }))
                }
              ]
            }
          ]
        });

      }

      const currentEncryptionType = sessionData.keyID ? "system" : "group";
      if (currentEncryptionType === "group" && (!groupKey || !await isGroupKeyCorrect(sessionData.encryptedSession, groupKey))) {

        await resetEncryptionTypeSelector();
        throw new IncorrectDecryptionKeyError();

      }
      
      // Get the system key if necessary.
      let systemKey: string | undefined;
      let currentKey = groupKey;
      if (currentEncryptionType === "system") {

        const possibleSystemPassword = process.env[`BLUESKY_PRIVATE_KEY_${sessionData.keyID}`];
        if (!possibleSystemPassword) throw new MissingSystemKeyError();
        systemKey = possibleSystemPassword;
        currentKey = systemKey;

      }

      // Check for MFA.
      const decryptedTOTPSecret = sessionData.encryptedTOTPSecret ? await decryptString(sessionData.encryptedTOTPSecret, currentKey) : undefined;
      if (decryptedTOTPSecret && (!totpToken || !authenticator.verify({token: totpToken, secret: decryptedTOTPSecret}))) {

        await resetEncryptionTypeSelector();
        throw new MFAIncorrectCodeError();

      }

      // Decrypt the session using the password.
      const decryptedSessionString = await decryptString(sessionData.encryptedSession, currentKey);

      // Re-encrypt it using the new password.
      if (goalEncryptionType === "system") {

        const keyData = getRandomKey();
        const encryptedSession = await encryptString(decryptedSessionString, keyData.key);
        const encryptedTOTPSecret = decryptedTOTPSecret ? await encryptString(decryptedTOTPSecret, keyData.key) : undefined;
        await database.collection("sessions").updateOne({guildID, sub: sessionData.sub}, {
          $set: {
            encryptedSession,
            keyID: keyData.keyID,
            ... encryptedTOTPSecret ? {encryptedTOTPSecret} : {}
          }
        });

      } else {

        const encryptedSession = await encryptString(decryptedSessionString, groupKey);
        const encryptedTOTPSecret = decryptedTOTPSecret ? await encryptString(decryptedTOTPSecret, groupKey) : undefined;
        await database.collection("sessions").updateOne({guildID, sub: sessionData.sub}, {
          $set: {
            encryptedSession,
            ... encryptedTOTPSecret ? {encryptedTOTPSecret} : {}
          },
          $unset: {
            keyID: 1,
            repostChannelIDs: 1
          }
        });

      }

      // Let the user know.
      await interaction.editOriginal({
        embeds: [],
        components: [
          {
            ...accountSelectMenuActionRow,
            components: [
              {
                ...accountSelectMenu,
                disabled: false
              }
            ]
          },
          {
            ...securitySelectMenuActionRow,
            components: [
              {
                ...securitySelectMenu,
                disabled: false,
                options: securitySelectMenu.options.map((option) => ({
                  ...option,
                  default: option.value === goalEncryptionType
                }))
              }
            ]
          }
        ]
      });

    }

  }
});

export default encryptSubCommand;
