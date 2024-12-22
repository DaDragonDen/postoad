import Command from "#utils/Command.js"
import decryptString from "#utils/decrypt-string.js";
import encryptString from "#utils/encrypt-string.js";
import NoAccessError from "#utils/errors/NoAccessError.js";
import getGuildIDFromInteraction from "#utils/get-guild-id-from-interaction.js";
import getHandlePairs from "#utils/get-handle-pairs.js";
import getRandomKey from "#utils/get-random-key.js";
import database from "#utils/mongodb-database.js";
import { hash, verify } from "argon2";
import { CommandInteraction, ComponentInteraction, ComponentTypes, ModalSubmitInteraction, StringSelectMenu, TextInputStyles } from "oceanic.js";

const encryptSubCommand = new Command({
  name: "encrypt",
  description: "Change the encryption settings of your guild's Bluesky sessions.",
  action: async (interaction) => {

    // Verify the guild.
    const guildID = getGuildIDFromInteraction(interaction);

    if (interaction instanceof CommandInteraction) {

      await interaction.defer();

      const handlePairs = await getHandlePairs(guildID);

      await interaction.createFollowup({
        content: "How do you want Postoad to encrypt your sessions?" + 
          "\n* **Encrypt using system password:** Your sessions will be encrypted using a system password. You can use the bot without Postoad asking for a password." +
          "\n* **Encrypt using system password and ask for group password:** Your sessions will be encrypted with a system password, but Postoad will ask all bot users for an group password that you set. If you forget the group password, you will have to sign out of the account from Postoad and then re-add the session. This potentially protects you from malicious actors with command access." +
          "\n* **Encrypt using group password:** Your sessions will be encrypted using an group password, potentially protecting you from malicious actors with database and system access. However, automatic posting will be disabled because Postoad cannot automatically decrypt the passwords without your attention.",
        components: [
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.STRING_SELECT,
                customID: "data/encrypt/accountSelector",
                options: handlePairs.map((handlePair) => ({
                  label: handlePair[0],
                  value: handlePair[1],
                  description: handlePair[1]
                }))
              }
            ]
          }, 
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
                    value: "0",
                    description: "Most convenient"
                  }, 
                  {
                    label: "Encrypt using system password and ask for group password",
                    value: "1",
                    description: "Balanced"
                  },
                  {
                    label: "Encrypt using group password",
                    value: "2",
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
          const securityLevel = !sessionData.keyID ? 2 : (sessionData.hashedGroupPassword ? 1 : 0);

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
                      default: option.value === `${securityLevel}`
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
          const goalEncryptionLevel = "values" in interaction.data ? parseInt(interaction.data.values.getStrings()[0], 10) : undefined;
          const selectedDID = accountSelectMenu.options.find((option) => option.default)?.value;
          if (typeof(goalEncryptionLevel) !== "number" || !selectedDID) {

            await interaction.deferUpdate();
            await interaction.editOriginal({
              content: "Something bad happened. Please try again later.",
              embeds: [],
              components: []
            });
            
            return;

          }

          const sessionData = await database.collection("sessions").findOne({sub: selectedDID});
          if (!sessionData) throw new NoAccessError();

          const securityLevel = !sessionData.keyID ? 2 : (sessionData.hashedGroupPassword ? 1 : 0);
          if (goalEncryptionLevel === securityLevel) {
            
            await interaction.deferUpdate();

          } else if (securityLevel > 0 || goalEncryptionLevel > 0) {

            // Ask the user for a current password.
            const isNewEncryption = securityLevel === 0 && goalEncryptionLevel > 0;
            await interaction.createModal({
              customID: "data/encrypt/passwordModal",
              title: `${isNewEncryption ? "Choose a" : "Enter your"} Postoad group password`,
              components: [{
                type: ComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: ComponentTypes.TEXT_INPUT,
                    label: `${isNewEncryption ? "New" : "Current"} Postoad group password`,
                    customID: `data/encrypt/${isNewEncryption ? "new" : "current"}Password`,
                    style: TextInputStyles.SHORT,
                    maxLength: 128,
                    minLength: 8,
                    required: true
                  }
                ]
              }]
            });
            
            await interaction.editOriginal({
              embeds: [
                {
                  description: "Authenticating..."
                }
              ],
              components: [
                {
                  ...accountSelectMenuActionRow,
                  components: [
                    {
                      ...accountSelectMenu,
                      disabled: true
                    }
                  ]
                },
                {
                  ...securitySelectMenuActionRow,
                  components: [
                    {
                      ...securitySelectMenu,
                      disabled: true,
                      options: securitySelectMenu.options.map((option) => ({
                        ...option,
                        default: option.value === `${goalEncryptionLevel}`
                      }))
                    }
                  ]
                }
              ]
            });

          } else {

            await interaction.deferUpdate();

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
      const selectedSecurityLevel = parseInt(securitySelectMenu.options.find((option) => option.default)?.value ?? "", 10);
      const currentGroupPassword = interaction.data.components.getTextInput("data/encrypt/currentPassword");
      const newGroupPassword = interaction.data.components.getTextInput("data/encrypt/newPassword");
      const password = currentGroupPassword ?? newGroupPassword;
      if (!selectedDID || typeof(selectedSecurityLevel) !== "number" || !password) {

        await interaction.editOriginal({
          content: "Something bad happened. Please try again later.",
          components: [],
          embeds: []
        });
        
        return;

      }

      const sessionData = await database.collection("sessions").findOne({guildID, sub: selectedDID});
      if (!sessionData) throw new NoAccessError();

      // Check if that's the correct password.
      const currentSecurityLevel = !sessionData.keyID ? 2 : (sessionData.hashedGroupPassword ? 1 : 0)
      if (sessionData?.hashedGroupPassword && (!currentGroupPassword || !await verify(sessionData.hashedGroupPassword, currentGroupPassword))) {

        await interaction.editOriginal({
          embeds: [
            {
              color: 15548997,
              description: "❌ Incorrect password..."
            }
          ],
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
                    default: option.value === `${currentSecurityLevel}`
                  }))
                }
              ]
            }
          ]
        });

        return;

      }

      // Save the password in the database.
      async function swapSessionEncryptions(password: string, newEncryption: "system" | "group") {

        const sessions = await database.collection("sessions").find({guildID}).toArray();
        for (const sessionData of sessions) {

          let systemPassword = "";
          if (sessionData.keyID) {

            const possibleSystemPassword = process.env[`BLUESKY_PRIVATE_KEY_${sessionData.keyID}`];
            if (!possibleSystemPassword) throw new Error();
            systemPassword = possibleSystemPassword;

          }

          // Decrypt the session using the password.
          const decryptedSessionString = await decryptString(sessionData.encryptedSession, systemPassword || password);

          // Re-encrypt it using the new password.
          let encryptedSession;
          let keyData;
          if (newEncryption === "system") {

            keyData = getRandomKey();
            encryptedSession = await encryptString(decryptedSessionString, keyData.key);
            await database.collection("sessions").updateOne({guildID, sub: sessionData.sub}, {
              $set: {
                encryptedSession,
                ... selectedSecurityLevel !== 0 ? {
                  hashedGroupPassword: await hash(password)
                } : {},
                keyID: keyData.keyID
              },
              ... selectedSecurityLevel === 0 ? {
                $unset: {
                  hashedGroupPassword: 1
                }
              } : {}
            });

          } else {

            encryptedSession = await encryptString(decryptedSessionString, password);
            await database.collection("sessions").updateOne({guildID, sub: sessionData.sub}, {
              $set: {
                hashedGroupPassword: await hash(password),
                encryptedSession,
              },
              $unset: {
                keyID: 1,
                repostChannelIDs: 1
              }
            });

          }
          
        }

      }

      await swapSessionEncryptions(password, selectedSecurityLevel === 2 ? "group" : "system");

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
                  default: option.value === `${selectedSecurityLevel}`
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
