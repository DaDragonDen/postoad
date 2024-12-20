import Command from "#utils/Command.js"
import { ApplicationCommandOptionTypes, CommandInteraction, ComponentInteraction, ComponentTypes, ModalSubmitInteraction, StringSelectMenu, TextInputStyles } from "oceanic.js";
import database from "#utils/mongodb-database.js";
import blueskyClient from "#utils/bluesky-client.js";
import interactWithPost from "#utils/interact-with-post.js";
import { verify } from "argon2";

const repostNowSubCommand = new Command({
  name: "now",
  description: "Repost a post on Bluesky.",
  options: [
    {
      type: ApplicationCommandOptionTypes.STRING,
      name: "link",
      description: "What's the link of the post that you want to like?",
      required: true
    }
  ],
  customIDs: ["accountSelector"],
  async action(interaction) {

    const { guildID } = interaction;
    if (!guildID) {

      throw new Error("You must authorize Postoad to use a Bluesky account before you use this command.");

    }

    async function confirmAction(options: {interaction: ModalSubmitInteraction | ComponentInteraction, guildID: string, actorDID: string, decryptionPassword?: string}) {

      // Repost the post.
      await interactWithPost(options, "repost");

      // Let the user know that we liked the post.
      await interaction.editOriginal({
        content: "♻️",
        components: [],
        embeds: []
      });

    }

    async function getHandlePairs() {

      const sessions = await database.collection("sessions").find({guildID}).toArray();
      const handlePairs = [];
      for (const session of sessions) {

        const {sub} = session;
        const handle = await blueskyClient.didResolver.resolve(sub);
        handlePairs.push([handle.alsoKnownAs?.[0].replace("at://", "") ?? "Unknown handle", sub])

      }

      if (!handlePairs[0]) {

        throw new Error("You must authorize Postoad to use a Bluesky account before you use this command.")

      }

      return handlePairs;

    }

    async function error() {

      await interaction.editOriginal({
        content: "Something bad happened. Please try again later.",
        embeds: [],
        components: []
      });

    }
    
    if (interaction instanceof CommandInteraction) {

      // Get the accounts that the server can access.
      await interaction.defer();
      const handlePairs = await getHandlePairs();

      // Ask the user which user they want to post as.
      const postLink = interaction.data.options.getString("link");
      if (!postLink) {

        return await error();

      }

      await interaction.editOriginal({
        content: "Which account do you want to use?",
        embeds: [
          {
            footer: {
              text: postLink.split("?")[0]
            }
          }
        ],
        components: [
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.STRING_SELECT,
                customID: "repost/now/accountSelector",
                options: handlePairs.map(([handle, sub]) => ({
                  label: handle,
                  value: sub,
                  description: sub
                }))
              }
            ]
          }
        ]
      });

    } else if (interaction instanceof ComponentInteraction) {

      // Check if a password is necessary.
      const guildData = await database.collection("guilds").findOne({guildID});
      const actorDID = "values" in interaction.data ? interaction.data.values.getStrings()[0] : undefined;
      if (!actorDID) {

        return await error();

      }

      if (guildData?.encryptionLevel > 0) {

        await interaction.createModal({
          customID: "repost/now/passwordModal",
          title: "Enter your Postoad group password",
          components: [{
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.TEXT_INPUT,
                label: "Current Postoad group password",
                customID: "repost/now/password",
                style: TextInputStyles.SHORT,
                maxLength: 128,
                minLength: 8,
                required: true
              }
            ]
          }]
        });

        const originalMessage = await interaction.getOriginal();
        const stringSelectMenu = originalMessage.components[0]?.components[0] as StringSelectMenu;
        if (!actorDID || !stringSelectMenu) {

          return await error();

        }

        await interaction.editOriginal({
          embeds: [
            originalMessage.embeds[0],
            {
              description: "Authenticating..."
            }
          ],
          components: [
            {
              ...originalMessage.components[0],
              components: [
                {
                  ...stringSelectMenu,
                  disabled: true,
                  options: stringSelectMenu.options.map((component) => ({
                    ...component,
                    default: component.value === actorDID
                  }))
                }
              ]
            }
          ]
        });

      } else {

        await interaction.deferUpdate();
        await confirmAction({interaction, guildID, actorDID});

      }

    } else if (interaction instanceof ModalSubmitInteraction) {

      // Check if the guild still has a security level.
      await interaction.deferUpdate();
      const originalMessage = await interaction.getOriginal();
      const dropdownComponent = originalMessage.components?.[0]?.components[0];
      const options = "options" in dropdownComponent ? dropdownComponent.options : undefined;
      const actorDID = options?.find((option) => option.default)?.value;
      const password = interaction.data.components.getTextInput("repost/now/password");
      if (!actorDID || !password) {

        return await error();

      }

      const guildData = await database.collection("guilds").findOne({guildID});
      let decryptionPassword;
      if (guildData && (guildData.encryptionLevel || 0) > 0) {

        // Check if the password is correct.
        if (!(await verify(guildData.hashedGroupPassword, password))) {

          const handlePairs = await getHandlePairs();

          await interaction.editOriginal({
            embeds: [
              originalMessage.embeds[0],
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
                    customID: "repost/now/accountSelector",
                    options: handlePairs.map(([handle, sub]) => ({
                      label: handle,
                      value: sub,
                      description: sub
                    }))
                  }
                ]
              }
            ]
          });

          return;

        }

        if (guildData.encryptionLevel > 1) {

          decryptionPassword = password;

        }

      }

      await confirmAction({interaction, guildID, decryptionPassword, actorDID});

    }

  }
});

export default repostNowSubCommand;