import Command from "#utils/Command.js"
import decryptSession from "#utils/decrypt-session.js";
import encryptSession from "#utils/encrypt-session.js";
import getRandomKey from "#utils/get-random-key.js";
import database from "#utils/mongodb-database.js";
import { hash, verify } from "argon2";
import { ButtonStyles, CommandInteraction, ComponentInteraction, ComponentTypes, ModalSubmitInteraction, TextInputStyles } from "oceanic.js";

const encryptSubCommand = new Command({
  name: "encrypt",
  description: "Change the encryption settings of your guild's Bluesky sessions.",
  customIDs: ["method"],
  action: async (interaction) => {

    // Verify the guild.
    const {guildID} = interaction;
    if (!guildID) {

      await interaction.defer();
      
      await interaction.createFollowup({
        content: "You can only run this command in servers that you manage."
      });
      return;

    }
    
    // Get the encryption level.
    const guildData = await database.collection("guilds").findOne({guildID});
    const encryptionLevel = guildData?.encryptionLevel ?? 0;
    
    if (interaction instanceof CommandInteraction) {

      await interaction.defer();

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
                customID: "data/encrypt/method",
                options: [
                  {
                    label: "Encrypt using system password",
                    value: "0",
                    description: "Most convenient",
                    default: encryptionLevel === 0
                  }, 
                  {
                    label: "Encrypt using system password and ask for group password",
                    value: "1",
                    description: "Balanced",
                    default: encryptionLevel === 1
                  },
                  {
                    label: "Encrypt using group password",
                    value: "2",
                    description: "Most secure",
                    default: encryptionLevel === 2
                  }
                ]
              }
            ]
          }
        ]
      });

    } else if (interaction instanceof ComponentInteraction) {

      switch (interaction.data.customID) {

        case "data/encrypt/method": {
          
          // Make sure a method was provided.
          const goalEncryptionLevel = "values" in interaction.data ? parseInt(interaction.data.values.getStrings()[0], 10) : undefined;
          if (typeof(goalEncryptionLevel) !== "number") {

            await interaction.deferUpdate();
            await interaction.editOriginal({
              content: "Something bad happened. Please try again later.",
              components: []
            });
            
            return;

          }

          if (goalEncryptionLevel === encryptionLevel) {
            
            await interaction.deferUpdate();

          } else if (encryptionLevel > 0 || goalEncryptionLevel > 0) {

            // Ask the user for a current password.
            const isNewEncryption = encryptionLevel === 0 && goalEncryptionLevel > 0;
            await interaction.createModal({
              customID: "data/encrypt/password",
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
                          description: "Most convenient",
                          default: goalEncryptionLevel === 0
                        }, 
                        {
                          label: "Encrypt using system password and ask for group password",
                          value: "1",
                          description: "Balanced",
                          default: goalEncryptionLevel === 1
                        },
                        {
                          label: "Encrypt using group password",
                          value: "2",
                          description: "Most secure",
                          default: goalEncryptionLevel === 2
                        }
                      ]
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

      // Get the goal encryption level.
      await interaction.deferUpdate();
      const originalMessage = await interaction.getOriginal();
      const dropdownComponent = originalMessage.components?.[0]?.components[0];
      const options = "options" in dropdownComponent ? dropdownComponent.options : undefined;
      const selectedOption = options?.find((option) => option.default);
      const currentGroupPassword = interaction.data.components.getTextInput("data/encrypt/currentPassword");
      const newGroupPassword = interaction.data.components.getTextInput("data/encrypt/newPassword");
      const password = currentGroupPassword ?? newGroupPassword;
      if (!selectedOption || !password) {

        await interaction.editOriginal({
          content: "Something bad happened. Please try again later.",
          components: []
        });
        
        return;

      }
      
      const goalEncryptionLevel = Number(selectedOption.value);

      // Check if that's the correct password.
      const guildData = await database.collection("guilds").findOne({guildID});
      const currentEncryptionLevel = guildData?.encryptionLevel;
      if (guildData?.hashedGroupPassword && (!currentGroupPassword || !await verify(guildData.hashedGroupPassword, currentGroupPassword))) {

        await interaction.editOriginal({
          embeds: [
            {
              color: 15548997,
              description: "❌ Incorrect password..."
            }
          ],
          components: [
            {
              type: ComponentTypes.ACTION_ROW,
              components: [
                {
                  type: ComponentTypes.STRING_SELECT,
                  customID: "data/encrypt/method",
                  options: [
                    {
                      label: "Encrypt using system password",
                      value: "0",
                      description: "Most convenient",
                      default: !currentEncryptionLevel
                    }, 
                    {
                      label: "Encrypt using system password and ask for group password",
                      value: "1",
                      description: "Balanced",
                      default: currentEncryptionLevel === 1
                    },
                    {
                      label: "Encrypt using group password",
                      value: "2",
                      description: "Most secure",
                      default: currentEncryptionLevel === 2
                    }
                  ]
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
          const decryptedSession = await decryptSession(sessionData.encryptedSession, systemPassword || password);
          const decryptedSessionString = JSON.stringify(decryptedSession);

          // Re-encrypt it using the new password.
          let encryptedSession;
          let keyData;
          if (newEncryption === "system") {

            keyData = getRandomKey();
            encryptedSession = await encryptSession(decryptedSessionString, keyData.key);
            await database.collection("sessions").updateOne({guildID, sub: sessionData.sub}, {
              $set: {
                encryptedSession,
                keyID: keyData.keyID
              },
            });

          } else {

            encryptedSession = await encryptSession(decryptedSessionString, password);
            await database.collection("sessions").updateOne({guildID, sub: sessionData.sub}, {
              $set: {
                encryptedSession,
              },
              $unset: {
                keyID: 1
              }
            });

          }
          
        }

      }

      if (goalEncryptionLevel === 0) {
        
        await swapSessionEncryptions(password, "system");

        await database.collection("guilds").updateOne({guildID}, {
          $unset: {
            hashedGroupPassword: 1,
            encryptionLevel: 1
          }
        });

      } else if (goalEncryptionLevel === 1) {

        // Add an encrypted password to the guild data.
        await swapSessionEncryptions(password, "system");

        await database.collection("guilds").updateOne({guildID}, {
          $set: {
            hashedGroupPassword: await hash(password),
            encryptionLevel: 1
          }
        });

      } else if (goalEncryptionLevel === 2) {

        // Update the sessions' encryption directly.
        await swapSessionEncryptions(password, "group");

        await database.collection("guilds").updateOne({guildID}, {
          $set: {
            hashedGroupPassword: await hash(password),
            encryptionLevel: 2
          },
          $unset: {
            autoPairs: 1
          }
        });

      }

      // Let the user know.
      await interaction.editOriginal({
        embeds: [],
        components: [
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.STRING_SELECT,
                customID: "data/encrypt/method",
                options: [
                  {
                    label: "Encrypt using system password",
                    value: "0",
                    description: "Most convenient",
                    default: goalEncryptionLevel === 0
                  }, 
                  {
                    label: "Encrypt using system password and ask for group password",
                    value: "1",
                    description: "Balanced",
                    default: goalEncryptionLevel === 1
                  },
                  {
                    label: "Encrypt using group password",
                    value: "2",
                    description: "Most secure",
                    default: goalEncryptionLevel === 2
                  }
                ]
              }
            ]
          }
        ]
      });

    }

  }
});

export default encryptSubCommand;
