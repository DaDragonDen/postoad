import { CommandInteraction, ComponentInteraction, ComponentTypes, ModalActionRow, TextInputStyles } from "oceanic.js";
import database from "./mongodb-database.js";
import NoAccessError from "./errors/NoAccessError.js";

export default async function promptSecurityModal(interaction: CommandInteraction | ComponentInteraction, guildID: string, did: string, customIDPrefix: string, setupType?: "key" | "totp"): Promise<boolean> {

  const sessionData = await database.collection("sessions").findOne({guildID, sub: did});
  if (!sessionData) throw new NoAccessError();

  const isSessionEncryptedByGroupKey = !sessionData.keyID;
  const isSessionProtectedByTOTP = !!sessionData.encryptedTOTPSecret;
  const shouldPromptSecurityModal = !!setupType || isSessionEncryptedByGroupKey || isSessionProtectedByTOTP;

  if (shouldPromptSecurityModal) {

    await interaction.createModal({
      title: "Postoad security",
      customID: `${customIDPrefix}/securityModal`,
      components: [
        ... setupType === "key" || isSessionEncryptedByGroupKey ? [
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.TEXT_INPUT,
                customID: `${customIDPrefix}/key`,
                style: TextInputStyles.SHORT,
                label: `Enter ${setupType === "key" ? "a new" : "your current"} group decryption key`,
                minLength: 8,
                maxLength: 128,
                required: true
              }
            ]
          } as ModalActionRow
        ] : [],
        ... setupType === "totp" || isSessionProtectedByTOTP ? [
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