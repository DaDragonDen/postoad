import { ComponentInteraction } from "oceanic.js";
import blueskyClient from "./bluesky-client.js";
import { Agent } from "@atproto/api";
import { isThreadViewPost } from "@atproto/api/dist/client/types/app/bsky/feed/defs.js";

async function interactWithPost(source: {interaction?: ComponentInteraction, rkey?: string, postCreatorHandle?: string, actorDID?: string}, action: "deletePost" | "deleteLike" | "like" | "deleteRepost" | "repost") {

  let {interaction, rkey, postCreatorHandle, actorDID} = source;

  if (interaction) {

    await interaction.deferUpdate();

    // Get the rkey of the post.
    const originalMessage = await interaction.getOriginal();
    const originalEmbed = originalMessage.embeds[0];
    const postLink = originalEmbed?.footer?.text;
    const postSplit = postLink?.split("/");
    rkey = postSplit?.pop();
    if (!postSplit || !rkey) {

      await interaction.editOriginal({
        content: "Something bad happened. Please try again later.",
        components: [],
        embeds: []
      });

      throw new Error();

    }

    postCreatorHandle = postSplit[4];

    // Restore the session.
    actorDID = "values" in interaction.data ? interaction.data.values.getStrings()[0] : undefined;

  }

  if (!actorDID || !postCreatorHandle || !rkey) {

    if (interaction) {

      await interaction.editOriginal({
        content: "Something bad happened. Please try again later.",
        components: [],
        embeds: []
      });

      throw new Error();

    }

    return;

  }

  // Get the CID of the post.
  const session = await blueskyClient.restore(actorDID);
  const agent = new Agent(session);
  const postCreatorDID = await blueskyClient.handleResolver.resolve(postCreatorHandle);
  if (!postCreatorDID) {

    if (interaction) {

      await interaction.editOriginal({
        content: "Something bad happened. Please try again later.",
        components: [],
        embeds: []
      });

      throw new Error();

    }

    return;

  }

  const { data: {cid} } = await agent.com.atproto.repo.getRecord({
    collection: "app.bsky.feed.post",
    repo: postCreatorDID,
    rkey
  });

  if (!cid) {

    if (interaction) {

      await interaction.editOriginal({
        content: "Something bad happened. Please try again later.",
        components: [],
        embeds: []
      });

      throw new Error();

    }

    return;

  }

  // Get the URI we need.
  let uri = `at://${postCreatorDID}/app.bsky.feed.post/${rkey}`;
  if (action === "deleteLike" || action === "deleteRepost") {

    const response = await agent.getPostThread({uri});
    if (isThreadViewPost(response.data.thread)) {

      const possibleURI = response.data.thread.post.viewer?.[action === "deleteLike" ? "like" : "repost"];
      if (!possibleURI) return;
      uri = possibleURI;

    }

  }

  // Interact with the post.
  await agent[action](uri, cid as string);

}

export default interactWithPost;