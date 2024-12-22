import { CommandInteraction, ComponentInteraction, ComponentTypes, ModalActionRow, TextInputStyles } from "oceanic.js";
import database from "./mongodb-database.js";
import NoAccessError from "./errors/NoAccessError.js";

export default async function promptSecurityModal(interaction: CommandInteraction | ComponentInteraction, guildID: string, did: string, customIDPrefix: string, isSettingUpMFA?: boolean): Promise<boolean> {

  const sessionData = await database.collection("sessions").findOne({guildID, sub: did});
  if (!sessionData) throw new NoAccessError();

  const isSessionEncryptedByGroupKey = !sessionData.keyID;
  const isSessionProtectedByTOTP = !!sessionData.encryptedTOTPSecret;
  const shouldPromptSecurityModal = isSettingUpMFA || isSessionEncryptedByGroupKey || isSessionProtectedByTOTP;

  if (shouldPromptSecurityModal) {

    await interaction.createModal({
      title: "Postoad security",
      customID: `${customIDPrefix}/securityModal`,
      components: [
        ... isSessionEncryptedByGroupKey ? [
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.TEXT_INPUT,
                customID: `${customIDPrefix}/key`,
                style: TextInputStyles.SHORT,
                label: "Enter your current group decryption key",
                required: true
              }
            ]
          } as ModalActionRow
        ] : [],
        ... isSettingUpMFA || isSessionProtectedByTOTP ? [
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.TEXT_INPUT,
                customID: `${customIDPrefix}/totp`,
                style: TextInputStyles.SHORT,
                label: "Enter the Postoad code provided by your app",
                minLength: 6,
                required: true,
                maxLength: 6,
                placeholder: "000000"
              }
            ]
          } as ModalActionRow
        ] : []
      ]
    });

  }

  return shouldPromptSecurityModal;

}