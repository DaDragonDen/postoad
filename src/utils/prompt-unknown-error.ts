import { ComponentInteraction, ModalSubmitInteraction } from "oceanic.js";

export default async function promptUnknownError(interaction: ComponentInteraction | ModalSubmitInteraction) {

  const originalMessage = interaction.message ?? await interaction.getOriginal();

  return await interaction.editOriginal({
    embeds: [
      ... originalMessage.embeds[0] && !originalMessage.embeds[0].color ? [originalMessage.embeds[0]] : [],
      {
        color: 16776960,
        description: "⚠️ Something bad happened. Please try again."
      }
    ]
  });

}