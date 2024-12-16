import { ApplicationCommandOptionTypes, ApplicationCommandTypes } from "oceanic.js";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
export default class Command {
    /** The command's name. This is shown to the users. */
    name;
    /** The command's description. This is shown to the users. */
    description;
    /** A list of applicable sub-commands. */
    subCommands;
    /** A boolean value on whether other users should be able to see command usage. */
    usesEphemeralMessages;
    /** A list of applicable options. */
    options;
    /** A function to execute when a user runs the command. If not provided, the command will be treated as a command group. */
    action;
    rateLimitedUsers = {};
    constructor(properties) {
        this.name = properties.name;
        this.description = properties.description;
        this.subCommands = properties.subCommands;
        this.usesEphemeralMessages = properties.usesEphemeralMessages;
        this.options = properties.options;
        this.action = properties.action;
    }
    static get(name, options) {
        const subCommandGroup = options;
        return undefined;
    }
    static async updateCommands(client) {
        const fileNames = fs.readdirSync(path.join(dirname(fileURLToPath(import.meta.url)), "..", "commands"));
        const newCommandList = [];
        for (const fileName of fileNames) {
            if (fileName.slice(fileName.length - 3) === ".js") {
                const path = `../commands/${fileName}`;
                const { default: command } = await import(path);
                if (command instanceof Command) {
                    const commandJSON = {
                        type: ApplicationCommandTypes.CHAT_INPUT,
                        name: command.name,
                        description: command.description,
                        options: command.options ?? []
                    };
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
    async execute(interaction) {
        if (!this.action) {
            throw new Error("This command has no action function.");
        }
        if (interaction.type === 2) {
            await interaction.defer(this.usesEphemeralMessages ? 64 : undefined);
        }
        // Make sure we have an ID.
        const authorID = (interaction.member ?? interaction.user)?.id;
        if (!authorID)
            return;
        // Now check if the creator is under a cooldown.
        const executionTime = new Date().getTime();
        const remainingCooldownTime = this.rateLimitedUsers[authorID] ? (this.rateLimitedUsers[authorID][0] + this.rateLimitedUsers[authorID][1]) - executionTime : 0;
        if (this.rateLimitedUsers[authorID] && remainingCooldownTime > 0 && interaction.channel) {
            return await interaction.createFollowup({
                content: `You are rate-limited. Wait ${remainingCooldownTime / 1000} more seconds before trying that again.`
            });
        }
        // Execute the command
        try {
            await this.action(interaction);
        }
        catch (err) {
            await interaction.createFollowup({
                content: err instanceof Error ? err.message : "Something bad happened. How about running that by me one more time?"
            });
        }
    }
}
