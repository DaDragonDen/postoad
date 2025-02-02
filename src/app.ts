import Command from "#utils/Command.js";
import { ButtonStyles, Client, ComponentTypes, InteractionTypes } from "oceanic.js";
import "./express-server.js";
import database from "#utils/mongodb-database.js";
import interactWithPost from "#utils/interact-with-bluesky.js";
import { existsSync, mkdirSync, rmSync } from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

// Clear all request locks.
const requestLocksPath = path.join(dirname(fileURLToPath(import.meta.url)), "utils", "request-locks");
if (existsSync(requestLocksPath)) {

  rmSync(requestLocksPath, { recursive: true, force: true });

}

mkdirSync(requestLocksPath);
console.log("[Postoad] Emptied request-locks folder.");

// Sign into Discord.
const client = new Client({
  auth: `Bot ${process.env.DISCORD_TOKEN}`,
  gateway: {
    intents: ["GUILD_MESSAGES", "GUILD_MESSAGE_REACTIONS", "GUILDS", "MESSAGE_CONTENT"]
  }
});

client.on("ready", async () => {

  console.log(`[Discord] Signed in as ${client.user.tag} (${client.user.id}).`);

  // Update the commands that are different from Discord's server.
  await Command.updateCommands(client);

});

client.on("messageCreate", async (message) => {

  // Check if the author is adding media to their post.
  const {referencedMessage} = message; 
  if (referencedMessage && referencedMessage.author.id === client.user.id && referencedMessage.content.includes("Check this out")) {

    const mainEmbed = referencedMessage.embeds[0];
    const attachments = message.attachments.filter(() => true);
    let errorMessage: string | null = null;
    if (attachments.length === 0) {
      
      errorMessage = "No attachments found. Select another source.";
      
    } else if (attachments.length > 4) {

      errorMessage = "Bluesky limits you to [four images](https://docs.bsky.app/docs/tutorials/creating-a-post#images-embeds:~:text=Each%20post%20contains%20up%20to%20four%20images)."

    } else {

      let allowedUploads = true;
      let didUploadVideo = false;
      let didUploadPhoto = false;
      for (const attachment of attachments) {
      
        if (!attachment.filename.includes(".")) {

          allowedUploads = false;
          break;

        }    

        const fileNameSplits = attachment.filename.split(".").filter((name) => name.trim());
        if (fileNameSplits.length <= 1) {

          allowedUploads = false;
          break;

        }

        const imageExtensions = ["jpe", "jpg", "jpeg", "gif", "png", "bmp", "ico", "svg", "svgz", "tif", "tiff", "ai", "drw", "pct", "psp", "xcf", "psd", "raw", "webp", "heic"];
        const videoExtensions = ["mp4", "m4a", "m4b", "mpeg", "webm", "mov"];
        const fileExtension = fileNameSplits[fileNameSplits.length - 1].toLowerCase();
        if (imageExtensions.includes(fileExtension)) {

          didUploadPhoto = true;

        } else if (videoExtensions.includes(fileExtension)) {

          didUploadVideo = true;

        } else {

          allowedUploads = false;
          break;

        }

      }

      if (!allowedUploads) {

        errorMessage = "One of the attachments are unsupported."

      } else if (didUploadPhoto && didUploadVideo) {

        errorMessage = "You cannot upload a video and a photo in the same post."

      }
      
    }

    const originalComponent = referencedMessage.components?.[0];
    if (!originalComponent) return;

    await referencedMessage.edit({
      embeds: [
        {
          ...mainEmbed,
          fields: [
            {
              name: "Attachment source",
              value: errorMessage ? `~~${message.jumpLink}~~\n-# ${errorMessage}` : message.jumpLink
            }
          ]
        }
      ],
      components: [
        {
          ...originalComponent,
          components: originalComponent.components.map((component, index) => index === 0 ? {
            type: ComponentTypes.BUTTON,
            customID: "post/submitPost",
            style: ButtonStyles.PRIMARY,
            label: "Submit post",
            disabled: Boolean(errorMessage && !mainEmbed.description)
          } : component)
        }
      ]
    })
  }

  // Check if auto-reposting is enabled in this channel.
  const channel = await client.rest.channels.get(message.channelID);
  const guildID = "guildID" in channel ? channel.guildID : undefined;
  if (!guildID) return;

  const sessionDataList = await database.collection("sessions").find({
    guildID, 
    repostChannelIDs: "parentID" in channel ? channel.parentID : channel.id
  }).toArray();

  for (const sessionData of sessionDataList) {

    // Check if the user added a Bluesky post.
    const matchingRegex = /https?:\/\/bsky.app\/profile\/(?<targetHandle>\S+)\/post\/(?<rkey>\S+)/gm;
    const matches = [...message.content.matchAll(matchingRegex)];
    for (const match of matches) {

      if (match.groups) {

        const {rkey, targetHandle} = match.groups;
        await interactWithPost({rkey, targetHandle, actorDID: sessionData.sub, guildID}, "repost");
        await message.createReaction("♻️");

      }

    }

  }

});

client.on("messageReactionRemove", async (uncachedMessage, reactor, reaction) => {

  try {

    if (reactor.id === client.user.id && reaction.emoji.name === "♻️") {

      // Check if auto-reposting is enabled in this channel.
      const message = await client.rest.channels.getMessage(uncachedMessage.channelID, uncachedMessage.id);
      const channel = await client.rest.channels.get(message.channelID);
      const guildID = "guildID" in channel ? channel.guildID : undefined;
      if (!guildID) return;

      const sessionDataList = await database.collection("sessions").find({
        guildID, 
        repostChannelIDs: "parentID" in channel ? channel.parentID : channel.id
      }).toArray();
    
      for (const sessionData of sessionDataList) {
    
        // Check if the user added a Bluesky post.
        const matchingRegex = /https?:\/\/bsky.app\/profile\/(?<targetHandle>\S+)\/post\/(?<rkey>\S+)/gm;
        const matches = [...message.content.matchAll(matchingRegex)];
        for (const match of matches) {
    
          if (match.groups) {
    
            const {rkey, targetHandle} = match.groups;
            await interactWithPost({rkey, targetHandle, actorDID: sessionData.sub, guildID}, "deleteRepost");
    
          }
    
        }
    
      }

    }

  } catch (error) {

    console.error(error);

  }

})

client.on("interactionCreate", async (interaction) => {

  switch (interaction.type) {

    case InteractionTypes.APPLICATION_COMMAND:

      try {

        // Check if the command exists.
        const command = await Command.getFromCommandInteraction(interaction);
        await command.execute(interaction);

      } catch (error: unknown) {

      }

      break;

    case InteractionTypes.MODAL_SUBMIT:
    case InteractionTypes.MESSAGE_COMPONENT:
      
      try {

        // Check if the command exists.
        const command = await Command.getFromComponentInteraction(interaction);
        await command.execute(interaction);

      } catch (error: unknown) {



      }

      break;

    default:
      break;

  }
  
});

client.on("error", (error) => {

  console.error(error);

});

client.connect();