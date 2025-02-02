import { ApplicationCommandOptionsWithValue, ApplicationCommandOptionTypes, ApplicationCommandTypes, Client, CommandInteraction, ComponentInteraction, CreateChatInputApplicationCommandOptions, InteractionOptions, InteractionOptionsWrapper, ModalSubmitInteraction } from "oceanic.js";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import PostoadError from "./errors/PostoadError.js";
import MFAIncorrectCodeError from "./errors/MFAIncorrectCodeError.js";
import IncorrectDecryptionKeyError from "./errors/IncorrectDecryptionKeyError.js";

export interface CommandProperties {
  name: string;
  description: string;
  subCommands?: Command[];
  usesEphemeralMessages?: boolean;
  options?: ApplicationCommandOptionsWithValue[];
  action?: (interaction: CommandInteraction | ComponentInteraction | ModalSubmitInteraction) => Promise<void>;
  defaultMemberPermissions?: number;
}

export default class Command {

  /** The command's name. This is shown to the users. */
  name: CommandProperties["name"];

  /** The command's description. This is shown to the users. */
  description: CommandProperties["description"];
  
  /** A list of applicable sub-commands. */
  subCommands: CommandProperties["subCommands"];

  /** A boolean value on whether other users should be able to see command usage. */
  usesEphemeralMessages: CommandProperties["usesEphemeralMessages"];

  defaultMemberPermissions: CommandProperties["defaultMemberPermissions"] = 32;

  /** A list of applicable options. */
  options?: CommandProperties["options"];
  
  /** A function to execute when a user runs the command. If not provided, the command will be treated as a command group. */ 
  action: CommandProperties["action"];

  rateLimitedUsers: {
    [userID: string]: [number, number]
  } = {};

  constructor(properties: CommandProperties) {

    this.name = properties.name;
    this.description = properties.description;
    this.subCommands = properties.subCommands;
    this.usesEphemeralMessages = properties.usesEphemeralMessages;
    this.options = properties.options;
    this.action = properties.action;

  }

  static async getFromCommandInteraction(interaction: CommandInteraction): Promise<Command> {

    // Get the base commmand.
    const baseCommandName = interaction.data.name;
    const command = (await import(`../commands/${baseCommandName}.js`)).default;

    if (!(command instanceof Command)) {

      throw new Error(`${baseCommandName}.js did not return a Command.`);

    }

    // Return the sub-command if there is one. 
    const subCommandArray = interaction.data.options.getSubCommand();
    if (subCommandArray?.[0]) {

      const subCommand = command.subCommands?.find((subCommand) => subCommand.name === subCommandArray[0]);

      if (!subCommand) {

        throw new Error(`${subCommandArray[0]} is not a valid sub-command of ${command.name}.`);

      }

      return subCommand;

    }

    return command;

  }

  static async getFromComponentInteraction(interaction: ComponentInteraction | ModalSubmitInteraction): Promise<Command> {

    // Get the base commmand.
    const separations = interaction.data.customID.split("/");
    separations.pop();
    const commandPath = separations.join("/");
    const command = (await import(`../commands/${commandPath}.js`)).default;

    if (!(command instanceof Command)) {

      throw new Error(`${commandPath}.js did not return a Command.`);

    }

    return command;

  }
  
  static async updateCommands(client: Client): Promise<void> {

    const fileNames = fs.readdirSync(path.join(dirname(fileURLToPath(import.meta.url)), "..", "commands"));
    const newCommandList = [];

    for (const fileName of fileNames) {
  
      if (fileName.slice(fileName.length - 3) === ".js") {
  
        const path = `../commands/${fileName}`;
        const { default: command } = await import(path);
        if (command instanceof Command) {

          const commandJSON: CreateChatInputApplicationCommandOptions = {
            type: ApplicationCommandTypes.CHAT_INPUT,
            name: command.name,
            description: command.description,
            defaultMemberPermissions: `${command.defaultMemberPermissions}`,
            options: command.options ?? []
          }

          if (command.subCommands) {

            for (const subCommand of command.subCommands) {

              commandJSON.options?.push({
                type: ApplicationCommandOptionTypes.SUB_COMMAND,
                name: subCommand.name,
                description: subCommand.description,
                options: subCommand.options
              });

            }

          }

          newCommandList.push(commandJSON);

        }
  
      }
  
    }

    await client.application.bulkEditGlobalCommands(newCommandList);

  }

  async execute(interaction: CommandInteraction | ComponentInteraction | ModalSubmitInteraction) {

    if (!this.action) {

      throw new Error("This command has no action function.");

    }

    // Make sure we have an ID.
    const authorID = (interaction.member ?? interaction.user)?.id;
    if (!authorID) return;

    // Ignore everyone else that isn't the original actor.
    const originalActorID = "message" in interaction ? interaction.message?.interactionMetadata?.user.id : undefined;
    if (originalActorID && authorID !== originalActorID) return; 

    // Now check if the creator is under a cooldown.
    const executionTime = new Date().getTime();
    const remainingCooldownTime = this.rateLimitedUsers[authorID] ? (this.rateLimitedUsers[authorID][0] + this.rateLimitedUsers[authorID][1]) - executionTime : 0;
    if (this.rateLimitedUsers[authorID] && remainingCooldownTime > 0 && interaction.channel) {

      await interaction.defer(this.usesEphemeralMessages ? 64 : undefined);

      return await interaction.createFollowup({
        content: `You are rate-limited. Wait ${remainingCooldownTime / 1000} more seconds before trying that again.`
      });

    }

    // Execute the command
    try {

      await this.action(interaction);

    } catch (error: unknown) {

      if (!interaction.acknowledged) { 
        
        if ("deferUpdate" in interaction) {

          await interaction.deferUpdate();

        } else {

          await interaction.defer();

        }

      }

      if (error instanceof MFAIncorrectCodeError || error instanceof IncorrectDecryptionKeyError) {

        const originalMessage = ("message" in interaction ? interaction.message : undefined) ?? await interaction.getOriginal();

        return await interaction.editOriginal({
          embeds: [
            ... originalMessage.embeds[0] && !originalMessage.embeds[0].color ? [originalMessage.embeds[0]] : [],
            {
              color: 15548997,
              description: error.message
            }
          ]
        });

      } else {

        const isPostoadError = error instanceof PostoadError;
        await interaction.editOriginal({
          content: isPostoadError ? error.message : "Something bad happened on our side. If this happens often, [let us know](https://github.com/DaDragonDen/postoad/issues).",
          embeds: [
            ... error instanceof Error && !isPostoadError ? [
              {
                description: error.stack ?? error.message
              }
            ] : []
          ],
          components: [],
          attachments: []
        });

      }

    }

  }

}