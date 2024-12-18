import { ComponentInteraction } from "oceanic.js";
import blueskyClient from "./bluesky-client.js";
import { Agent } from "@atproto/api";

async function interactWithPost(interaction: ComponentInteraction, action: "like" | "repost") {

  await interaction.deferUpdate();

  // Get the rkey of the post.
  const originalMessage = await interaction.getOriginal();
  const originalEmbed = originalMessage.embeds[0];
  const postLink = originalEmbed?.footer?.text;
  const postSplit = postLink?.split("/");
  const rkey = postSplit?.pop();
  if (!postSplit || !rkey) {

    await interaction.editOriginal({
      content: "Something bad happened. Please try again later.",
      components: [],
      embeds: []
    });

    throw new Error();

  }


  // Restore the session.
  const actorDID = "values" in interaction.data ? interaction.data.values.getStrings()[0] : undefined;
  if (!actorDID) {

    await interaction.editOriginal({
      content: "Something bad happened. Please try again later.",
      components: [],
      embeds: []
    });

    throw new Error();

  }

  // Get the CID of the post.
  const session = await blueskyClient.restore(actorDID);
  const agent = new Agent(session);
  const postCreatorHandle = postSplit[4];
  const postCreatorDID = await blueskyClient.handleResolver.resolve(postCreatorHandle);
  if (!postCreatorDID) {

    await interaction.editOriginal({
      content: "Something bad happened. Please try again later.",
      components: [],
      embeds: []
    });

    throw new Error();

  }

  const { data: {cid} } = await agent.com.atproto.repo.getRecord({
    collection: "app.bsky.feed.post",
    repo: postCreatorDID,
    rkey
  });

  if (!cid) {

    await interaction.editOriginal({
      content: "Something bad happened. Please try again later.",
      components: [],
      embeds: []
    });

    throw new Error();

  }

  // Interact with the post.
  await agent[action](`at://${postCreatorDID}/app.bsky.feed.post/${rkey}`, cid);

}

export default interactWithPost;