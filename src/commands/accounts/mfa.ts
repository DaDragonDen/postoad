import Command from "#utils/Command.js"
import createAccountSelector from "#utils/create-account-selector.js";
import decryptString from "#utils/decrypt-string.js";
import encryptString from "#utils/encrypt-string.js";
import MFAConflictError from "#utils/errors/MFAConflictError.js";
import NoAccessError from "#utils/errors/NoAccessError.js";
import getGuildIDFromInteraction from "#utils/get-guild-id-from-interaction.js";
import getHandlePairs from "#utils/get-handle-pairs.js";
import database from "#utils/mongodb-database.js";
import promptIncorrectCode from "#utils/prompt-incorrect-code.js";
import promptUnknownError from "#utils/prompt-unknown-error.js";
import { ButtonStyles, CommandInteraction, ComponentInteraction, ComponentTypes, ModalSubmitInteraction, StringSelectMenu, TextButton, TextInputStyles } from "oceanic.js";
import { authenticator } from "otplib";
import qrcode from "qrcode";

const mfaSubCommand = new Command({
  name: "mfa",
  description: "Configure multi-factor authentication settings for your Bluesky account sessions.",
  usesEphemeralMessages: true,
  async action(interaction) {

    // Get the Bluesky accounts.
    const guildID = getGuildIDFromInteraction(interaction);
    const sessionsCollection = database.collection("sessions");

    const promptCode = async (interaction: ComponentInteraction, shouldRemove?: boolean) => await interaction.createModal({
      title: `${shouldRemove ? "Remove m" : "M"}ulti-factor authentication`,
      customID: "accounts/mfa/codeModal",
      components: [
        {
          type: ComponentTypes.ACTION_ROW,
          components: [
            {
              type: ComponentTypes.TEXT_INPUT,
              customID: "accounts/mfa/code",
              style: TextInputStyles.SHORT,
              label: "Enter the Postoad code provided by your app",
              minLength: 6,
              required: true,
              maxLength: 6,
              placeholder: "000000"
            }
          ]
        }
      ]
    });

    if (interaction instanceof CommandInteraction) {

      // Ask the user which accounts they want to remove.
      await interaction.defer(64);
      
      const defaultSessionData = await database.collection("sessions").findOne({guildID, isDefault: true});
      const accountSelector = await createAccountSelector(guildID, "accounts/mfa", (did) => defaultSessionData?.sub === did);

      await interaction.editOriginal({
        content: "You can require multi-factor authentication for users who want to use Postoad's features. Postoad will ask users for a code from their authenticator app before they run a command. If you no longer have access to your authenticator, consider asking someone else. If no one has access to the authenticator, use **/accounts signout** to remove the account, then re-add it back using **/accounts authorize**.",
        components: [
          accountSelector,
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                disabled: !defaultSessionData,
                type: ComponentTypes.BUTTON,
                customID: "accounts/mfa/configure",
                label: defaultSessionData?.encryptedTOTPSecret ? "Disable MFA" : "Configure MFA",
                style: defaultSessionData?.encryptedTOTPSecret ? ButtonStyles.DANGER : ButtonStyles.SUCCESS
              }
            ]
          }
        ]
      });

    } else if (interaction instanceof ComponentInteraction) {

      const accountSelectorActionRow = interaction.message?.components[0];
      const accountSelector = accountSelectorActionRow?.components[0] as StringSelectMenu;
      const configureButtonActionRow = interaction.message?.components[1];
      const configureButton = configureButtonActionRow?.components[0] as TextButton;

      switch (interaction.data.customID) {

        case "accounts/mfa/accountSelector": {

          await interaction.deferUpdate();
          const selectedDID = "values" in interaction.data ? interaction.data.values.getStrings()[0] : undefined;
          const sessionData = await database.collection("sessions").findOne({guildID, sub: selectedDID});

          await interaction.editOriginal({
            components: [
              {
                ...accountSelectorActionRow,
                components: [
                  {
                    ...accountSelector,
                    options: accountSelector.options.map((option) => ({
                      ...option,
                      default: option.value === selectedDID
                    }))
                  }
                ]
              },
              {
                ...configureButtonActionRow,
                components: [
                  {
                    ...configureButton,
                    label: sessionData?.encryptedTOTPSecret ? "Disable MFA" : "Configure MFA",
                    style: sessionData?.encryptedTOTPSecret ? ButtonStyles.DANGER : ButtonStyles.SUCCESS,
                    disabled: !sessionData
                  }
                ]
              }
            ]
          });

          break;

        }

        case "accounts/mfa/configure": {

          // Make sure an account was selected.
          const accountSelection = accountSelector.options.find((option) => option.default);
          if (!accountSelection) {

            await interaction.editOriginal({
              content: "Something bad happened. Try again later.",
              embeds: [],
              components: []
            });

            return;

          }

          const did = accountSelection.value;
          const session = await sessionsCollection.findOne({guildID, sub: did});
          if (!session) {

            throw new NoAccessError();

          }

          const isEnabling = configureButton.style === ButtonStyles.SUCCESS;
          if (session.encryptedTOTPSecret && !isEnabling) {

            await promptCode(interaction, true);

          } else if (isEnabling) {
          
            // Generate a TOTP secret to display to the user.
            await interaction.deferUpdate();
            const secret = authenticator.generateSecret();
            const uri = authenticator.keyuri(accountSelection.label, "Postoad", secret);
            const qrCodeBuffer = await qrcode.toBuffer(uri);

            await interaction.editOriginal({
              content: "Scan the QR code or enter the secret code in your authenticator app and then press **Verify authenticator code** to finish setup.\n-# Save and share this QR code with authorized staff members so they can set up multi-factor authentication later. You will only see this once.",
              files: [
                {
                  name: "code.png",
                  contents: qrCodeBuffer
                }
              ],
              embeds: [
                {
                  author: {
                    name: accountSelection.label
                  },
                  footer: {
                    text: did
                  },
                  fields: [
                    {
                      name: "Secret code",
                      value: secret
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
                      customID: "accounts/mfa/verify",
                      label: "Verify authentication code",
                      style: ButtonStyles.PRIMARY
                    }
                  ]
                }
              ]
            });
            
          } else {

            await interaction.deferUpdate();
            await interaction.editOriginal({
              content: session.encryptedTOTPSecret ? "That session already has an MFA requirement." : "That session doesn't have an MFA requirement anymore.",
              components: [],
              embeds: []
            });

          }

          break;

        }

        case "accounts/mfa/verify": {
          await promptCode(interaction);
          break;

        }

        default:
          console.warn(`Unknown custom ID: ${interaction.data.customID}`);
          break;

      }
    } else if (interaction instanceof ModalSubmitInteraction) {

      // Verify that the user provided a DID and authentication token.
      await interaction.deferUpdate();
      const originalMessage = await interaction.getOriginal();
      const possibleAccountSelector = originalMessage.components[0]?.components[0] as StringSelectMenu | undefined;
      const did = originalMessage?.embeds[0]?.footer?.text ?? possibleAccountSelector?.options.find((option) => option.default)?.value;
      let secretCode = originalMessage?.embeds[0]?.fields?.[0].value;
      const authenticationToken = interaction.data.components.getTextInput("accounts/mfa/code");
      const sessionData = await sessionsCollection.findOne({guildID, sub: did});
      const existingEncryptedTOTPSecret = sessionData?.encryptedTOTPSecret;
      if (!originalMessage || !did || !authenticationToken || (!secretCode && !existingEncryptedTOTPSecret)) {

        await promptUnknownError(interaction);

        return;

      }

      if (existingEncryptedTOTPSecret) {

        if (secretCode) throw new MFAConflictError();

        const { keyID } = sessionData;
        const key = process.env[`BLUESKY_PRIVATE_KEY_${keyID}`] as string;
        const secret = await decryptString(existingEncryptedTOTPSecret, key);

        if (authenticator.verify({token: authenticationToken, secret})) {

          // Remove MFA secret from the session.
          await sessionsCollection.updateOne(
            {
              guildID,
              sub: did
            },
            {
              $unset: {
                encryptedTOTPSecret: 1
              }
            }
          );

          await interaction.editOriginal({
            content: "All done. That session no longer has an MFA requirement.",
            attachments: [],
            components: [],
            embeds: []
          });

        } else {

          await promptIncorrectCode(interaction);

        }

      } else {

        // Verify the authentication token.
        if (!secretCode || !authenticator.verify({token: authenticationToken, secret: secretCode})) {

          await promptIncorrectCode(interaction);
          return;

        }

        // Verify that Postoad still has access to that session..
        if (!sessionData) throw new NoAccessError();

        // Ask the user to enter their decryption key if necessary.
        const { keyID } = sessionData;
        if (keyID) {

          // Verify that the system key exists.
          const key = process.env[`BLUESKY_PRIVATE_KEY_${keyID}`];
          if (!key) {

            await interaction.editOriginal({
              content: "Postoad is missing an important system key and cannot continue. Please report this to the bot maintainers.",
              attachments: [],
              embeds: [],
              components: []
            });

            return;

          }

          // Encrypt and save the secret code.
          const encryptedTOTPSecret = await encryptString(secretCode, key);
          await sessionsCollection.updateOne(
            {
              guildID, 
              sub: did
            },
            {
              $set: {
                encryptedTOTPSecret
              }
            }
          );

          // Let the user know.
          await interaction.editOriginal({
            content: "All done! If you no longer have access to your authenticator, you can use Postoad again by removing and re-authorizing the account.",
            attachments: [],
            components: [],
            embeds: []
          });

        } else {

          await interaction.editOriginal({
            content: "Almost done. Postoad needs the group key that your guild set when setting up the bot.\n-# If you forgot this key, you can remove the account using **/accounts signout** and then re-authorize the account using **/accounts reauthorize**.",
            files: [],
            components: [
              {
                type: ComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: ComponentTypes.BUTTON,
                    customID: "accounts/mfa/decrypt",
                    style: ButtonStyles.PRIMARY,
                    label: "Enter group key"
                  }
                ]
              }
            ]
          })

        }

      }

    }

  }
});

export default mfaSubCommand;