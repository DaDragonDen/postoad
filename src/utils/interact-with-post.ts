import { ComponentInteraction, ModalSubmitInteraction } from "oceanic.js";
import blueskyClient from "./bluesky-client.js";
import { Agent } from "@atproto/api";
import { isThreadViewPost } from "@atproto/api/dist/client/types/app/bsky/feed/defs.js";

async function interactWithPost(source: {interaction?: ModalSubmitInteraction | ComponentInteraction, rkey?: string, postCreatorHandle?: string, actorDID?: string, guildID: string, decryptionKey?: string}, action: "deletePost" | "deleteLike" | "like" | "deleteRepost" | "repost") {

  let {interaction, rkey, postCreatorHandle, actorDID} = source;

  if (interaction) {

    // Get the rkey of the post.
    const originalMessage = await interaction.getOriginal();
    const originalEmbed = originalMessage.embeds[0];
    const postLink = originalEmbed?.footer?.text;
    const postSplit = postLink?.split("/");
    rkey = postSplit?.pop();
    if (!postSplit || !rkey) throw new Error();

    postCreatorHandle = postSplit[4];

  }

  if (!actorDID || !postCreatorHandle || !rkey) throw new Error();

  // Get the CID of the post.
  const session = await blueskyClient.restore(actorDID, "auto", {guildID: source.guildID, decryptionKey: source.decryptionKey});
  const agent = new Agent(session);
  const postCreatorDID = postCreatorHandle.includes("did:") ? postCreatorHandle : await blueskyClient.handleResolver.resolve(postCreatorHandle);
  if (!postCreatorDID) throw new Error();

  const { data: {cid} } = await agent.com.atproto.repo.getRecord({
    collection: "app.bsky.feed.post",
    repo: postCreatorDID,
    rkey
  });

  if (!cid) throw new Error();

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