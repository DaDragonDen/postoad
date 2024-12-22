import Command from "#utils/Command.js"
import { ButtonStyles, ChannelSelectMenu, ChannelTypes, CommandInteraction, ComponentInteraction, ComponentTypes, StringSelectMenu } from "oceanic.js";
import database from "#utils/mongodb-database.js";
import getGuildIDFromInteraction from "#utils/get-guild-id-from-interaction.js";
import NoAutoGroupDecryptionError from "#utils/errors/NoAutoGroupDecryptionError.js";
import getHandlePairs from "#utils/get-handle-pairs.js";

const repostAutoSubCommand = new Command({
  name: "auto",
  description: "Configure auto-repost settings for Bluesky.",
  async action(interaction) {

    const guildID = getGuildIDFromInteraction(interaction);

    if (interaction instanceof CommandInteraction) {

      await interaction.defer();
      
      // Get system encrypted sessions.
      const sessions = await database.collection("sessions").find({guildID}).toArray();
      const systemEncryptedSessions = sessions.filter((session) => session.keyID);
      let hiddenSessions = sessions.length - systemEncryptedSessions.length;
      if (systemEncryptedSessions.length === 0) {

        throw new NoAutoGroupDecryptionError();

      }

      // Ask the user which user they want to post as.
      const handlePairs = await getHandlePairs(guildID);

      await interaction.editOriginal({
        content: `Configure Postoad's auto-repost settings using the dropdowns.${hiddenSessions ? ` ${hiddenSessions} accounts were hidden because they are encrypted using a group password. In these cases, Postoad cannot automatically act on your behalf without your attention.` : ""}`,
        components: [
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.STRING_SELECT,
                customID: "repost/auto/accountSelector",
                options: handlePairs.map(([handle, sub]) => ({
                  label: handle,
                  value: sub,
                  description: sub
                }))
              }
            ]
          },
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.CHANNEL_SELECT,
                customID: "repost/auto/channelSelector",
                channelTypes: [ChannelTypes.GUILD_TEXT, ChannelTypes.GUILD_ANNOUNCEMENT, ChannelTypes.GUILD_FORUM],
                disabled: true
              }
            ]
          },
          {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.BUTTON,
                customID: "repost/auto/toggle",
                style: ButtonStyles.SUCCESS,
                label: "Enable auto-reposting",
                disabled: true
              }
            ]
          }
        ]
      });

    } else if (interaction instanceof ComponentInteraction) {

      await interaction.deferUpdate();

      const originalMessage = await interaction.getOriginal();
      const originalComponents = originalMessage.components;
      const channelSelectMenu = originalComponents[1]?.components?.[0] as ChannelSelectMenu;
      const stringSelectMenu = originalComponents[0]?.components?.[0] as StringSelectMenu;
      const selectedChannelID = "values" in interaction.data ? interaction.data.values.getChannels()[0]?.id : channelSelectMenu.defaultValues?.[0].id;
      let selectedDID = stringSelectMenu.options.find((option) => option.default)?.value;

      const sessionsCollection = database.collection("sessions");

      switch (interaction.data.customID) {

        case "repost/auto/disable":
        case "repost/auto/enable": {

          // Verify that we have a DID and a channel ID.
          if (!selectedDID || !selectedChannelID) throw new Error();

          // Update the settings.
          const isEnabling = interaction.data.customID === "repost/auto/enable";
          await sessionsCollection.updateOne({guildID, sub: selectedDID}, {
            [isEnabling ? "$addToSet" : "$pull"]: {
              repostChannelIDs: selectedChannelID,
            }
          });

          // Let the user know.
          const originalMessage = await interaction.getOriginal();
          const components = originalMessage.components;
          components[2] = {
            type: ComponentTypes.ACTION_ROW,
            components: [
              {
                type: ComponentTypes.BUTTON,
                customID: `repost/auto/${isEnabling ? "disable" : "enable"}`,
                style: isEnabling ? ButtonStyles.DANGER : ButtonStyles.SUCCESS,
                label: `${isEnabling ? "Disable" : "Enable"} auto-reposting`,
                disabled: false
              }
            ]
          }

          await interaction.editOriginal({components});

          break;

        }

        case "repost/auto/accountSelector":
        case "repost/auto/channelSelector": {

          if ("values" in interaction.data) {

            selectedDID = selectedChannelID ? selectedDID : interaction.data.values.getStrings()[0]; // For some reason, values.getStrings() returns for both string menus and channel menus.

            // Check if auto-reposting is enabled.
            const sessionData = await sessionsCollection.findOne({guildID, sub: selectedDID});
            const isAutoRepostingEnabled = Boolean(sessionData?.repostChannelIDs?.includes(selectedDID));
    
            await interaction.editOriginal({
              components: [
                {
                  type: ComponentTypes.ACTION_ROW,
                  components: [
                    {
                      type: ComponentTypes.STRING_SELECT,
                      customID: "repost/auto/accountSelector",
                      options: stringSelectMenu?.options.map((option) => ({
                        label: option.label,
                        value: option.value,
                        description: option.value,
                        default: option.value === selectedDID || option.default
                      }))
                    }
                  ]
                },
                {
                  type: ComponentTypes.ACTION_ROW,
                  components: [
                    {
                      type: ComponentTypes.CHANNEL_SELECT,
                      customID: "repost/auto/channelSelector",
                      channelTypes: [ChannelTypes.GUILD_TEXT, ChannelTypes.GUILD_ANNOUNCEMENT, ChannelTypes.GUILD_FORUM],
                      disabled: !selectedDID,
                      defaultValues: selectedChannelID ? [{
                        id: selectedChannelID,
                        type: "channel"
                      }] : undefined
                    }
                  ]
                },
                {
                  type: ComponentTypes.ACTION_ROW,
                  components: [
                    {
                      type: ComponentTypes.BUTTON,
                      customID: `repost/auto/${isAutoRepostingEnabled ? "disable" : "enable"}`,
                      style: isAutoRepostingEnabled ? ButtonStyles.DANGER : ButtonStyles.SUCCESS,
                      label: `${isAutoRepostingEnabled ? "Disable" : "Enable"} auto-reposting`,
                      disabled: !selectedChannelID && originalComponents[2]?.components[0].disabled
                    }
                  ]
                }
              ]
            });
    
          } 
          break;

        }

        default:
          break;

      }

    }

  }
});

export default repostAutoSubCommand;