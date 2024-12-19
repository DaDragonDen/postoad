import Command from "#utils/Command.js"
import { ButtonStyles, ChannelSelectMenu, ChannelTypes, CommandInteraction, ComponentInteraction, ComponentTypes, StringSelectMenu } from "oceanic.js";
import database from "#utils/mongodb-database.js";
import blueskyClient from "#utils/bluesky-client.js";

const repostAutoSubCommand = new Command({
  name: "auto",
  description: "Configure auto-repost settings for Bluesky.",
  customIDs: ["accountSelector"],
  async action(interaction) {

    const { guildID } = interaction;
    if (!guildID) {

      throw new Error("You must authorize Postoad to use a Bluesky account before you use this command.");

    }

    if (interaction instanceof CommandInteraction) {

      await interaction.defer();
      
      // Verify that the server encrypts using the system password.
      const guildData = await database.collection("guilds").findOne({guildID});
      if (guildData?.encryptionLevel === 2) {

        await interaction.createFollowup({
          content: "This server has requested for Postoad to encrypt your sessions using a group password. Postoad cannot automatically act on your behalf without your attention. To use this feature, please change your data encryption settings through the **/data encrypt** command."
        });

        return;

      }

      // Get the accounts that the server can access.
      const handlePairs = [];
      for (const sub of guildData?.subs ?? []) {

        const handle = await blueskyClient.didResolver.resolve(sub);
        handlePairs.push([handle.alsoKnownAs?.[0].replace("at://", "") ?? "Unknown handle", sub])

      }

      if (!handlePairs[0]) {

        throw new Error("You must authorize Postoad to use a Bluesky account before you use this command.")

      }

      // Ask the user which user they want to post as.
      await interaction.editOriginal({
        content: "Configure Postoad's auto-repost settings using the dropdowns. The first dropdown is for selecting an account. The second dropdown is for choosing the channels to listen to.",
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

      const collection = database.collection<{
        autoPairs: {
          [sub: string]: {
            channelID: string,
            isLiking?: boolean,
            isReposting?: boolean
          }
        }
      }>("guilds");

      switch (interaction.data.customID) {

        case "repost/auto/disable":
        case "repost/auto/enable": {

          // Verify that we have a DID and a channel ID.
          if (!selectedDID || !selectedChannelID) {

            await interaction.editOriginal({
              content: "Something bad happened. Please try again later."
            });

            return;

          }

          // Update the settings.
          const guildData = await collection.findOne({guildID});
          
          const isEnabling = interaction.data.customID === "repost/auto/enable";
          if (interaction.data.customID === "repost/auto/enable") {

            await collection.updateOne({guildID}, {
              $set: {
                autoPairs: {
                  [selectedDID]: {
                    channelID: selectedChannelID,
                    isReposting: true
                  }
                }
              }
            });

          } else if (guildData) {

            if (guildData.autoPairs?.[selectedDID]?.isLiking) {

              await collection.updateOne({guildID}, {
                $set: {
                  autoPairs: {
                    [selectedDID]: {
                      channelID: selectedChannelID,
                      isReposting: false
                    }
                  }
                }
              });

            } else {

              await collection.updateOne({guildID}, {
                $unset: {
                  [`autoPairs.${selectedDID}`]: 1
                }
              });

            }

          }

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
            let isAutoRepostingEnabled = false;
            if (selectedDID && selectedChannelID) {
    
              const guildData = await collection.findOne({guildID});
              if (guildData?.autoPairs) {
    
                isAutoRepostingEnabled = Boolean(guildData.autoPairs[selectedDID]);
    
              }
    
            }
    
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