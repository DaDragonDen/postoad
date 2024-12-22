import { CommandInteraction, ComponentInteraction, Interaction, ModalSubmitInteraction } from "oceanic.js";
import NoGuildError from "./errors/NoGuildError.js";

export default function getGuildIDFromInteraction(interaction: CommandInteraction | ModalSubmitInteraction | ComponentInteraction) {

  const { guildID } = interaction;

  if (!guildID) {

    throw new NoGuildError();

  }

  return guildID;

}