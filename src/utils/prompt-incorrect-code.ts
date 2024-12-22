import { ModalSubmitInteraction } from "oceanic.js";

export default async function promptIncorrectCode(interaction: ModalSubmitInteraction) {

  const originalMessage = interaction.message ?? await interaction.getOriginal();

  return await interaction.editOriginal({
    embeds: [
      ... originalMessage.embeds[0] && !originalMessage.embeds[0].color ? [originalMessage.embeds[0]] : [],
      {
        color: 15548997,
        description: "❌ Incorrect code..."
      }
    ]
  });

}