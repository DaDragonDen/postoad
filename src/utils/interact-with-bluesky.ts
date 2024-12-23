import { ComponentInteraction, ModalSubmitInteraction } from "oceanic.js";
import blueskyClient from "./bluesky-client.js";
import { Agent } from "@atproto/api";
import { isThreadViewPost } from "@atproto/api/dist/client/types/app/bsky/feed/defs.js";

async function interactWithBluesky(source: {interaction?: ModalSubmitInteraction | ComponentInteraction, rkey?: string, targetHandle?: string, actorDID?: string, guildID: string, decryptionKey?: string}, action: "mute" | "deleteFollow" | "follow" | "deletePost" | "deleteLike" | "like" | "deleteRepost" | "repost") {

  let {interaction, rkey, targetHandle, actorDID} = source;

  const isTargetAccount = action === "deleteFollow" || action === "follow" || action === "mute";
  if (interaction && !targetHandle) {

    // Get the rkey of the post.
    const originalMessage = await interaction.getOriginal();
    const originalEmbed = originalMessage.embeds[0];
    const value = originalEmbed?.footer?.text;

    if (isTargetAccount) {

      targetHandle = value;

    } else {

      const postSplit = value?.split("/");
      rkey = postSplit?.pop();
      if (!postSplit || !rkey) throw new Error();

      targetHandle = postSplit[4];

    }

  }

  if (!targetHandle || !actorDID || (!isTargetAccount && !rkey)) throw new Error();

  // Get the CID of the post if necessary.
  const session = await blueskyClient.restore(actorDID, "auto", {guildID: source.guildID, decryptionKey: source.decryptionKey});
  const agent = new Agent(session);
  const targetDID = targetHandle.includes("did:") ? targetHandle : await blueskyClient.handleResolver.resolve(targetHandle);
  let cid;
  let uri;
  if (!targetDID) throw new Error();
  if (action === "deleteFollow") {

    const profileResponse = await agent.getProfile({actor: targetDID});
    uri = profileResponse.data.viewer?.following;
    if (!uri) return;
    
  } else if (!isTargetAccount) {

    if (!rkey) throw new Error();

    const recordResponse = await agent.com.atproto.repo.getRecord({
      collection: "app.bsky.feed.post",
      repo: targetDID,
      rkey
    });

    cid = recordResponse.data.cid;
  
    if (!cid) throw new Error();
    uri = `at://${targetDID}/app.bsky.feed.post/${rkey}`;

  }

  // Get the URI we need.
  if (action === "deleteLike" || action === "deleteRepost") {

    const response = await agent.getPostThread({uri: uri!});
    if (isThreadViewPost(response.data.thread)) {

      const possibleURI = response.data.thread.post.viewer?.[action === "deleteLike" ? "like" : "repost"];
      if (!possibleURI) return;
      uri = possibleURI;

    }

  }

  // Interact with Bluesky.
  await agent[action](uri ?? targetDID, cid as string);

}

export default interactWithBluesky;