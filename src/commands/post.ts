import Command from "#utils/Command.js"
import { Agent } from "@atproto/api";
import { ComponentTypes } from "oceanic.js";
import database from "#utils/mongodb-database";

const command = new Command({
  name: "post",
  description: "Post on behalf of a user on Bluesky.",
  async action(interaction) {

    // Get the accounts that the server can access.
    const { guildID } = interaction;
    if (!guildID) {

      throw new Error("You must authorize Postoad to use a Bluesky account before you use this command.");

    }

    const guildData = await database.collection("guilds").findOne({guildID});
    const handles = [];
    for (const sub of guildData.subs) {

      

    }

    if (!accountData[0]) {

      throw new Error("You must authorize Postoad to use a Bluesky account before you use this command.")

    }

    // Ask the user which user they want to post as.
    await interaction.createFollowup({
      content: "Which user do you want to post as?",
      components: [
        {
          type: ComponentTypes.ACTION_ROW,
          components: [
            {
              type: ComponentTypes.STRING_SELECT,
              customID: "accountSelector",
              options: handles.map((handle) => {

                return {
                  label: handle,
                  value: handle,
                  des
                }

              })
            }
          ]
        }
      ]
    });

  }
});

export default command;