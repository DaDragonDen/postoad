import blueskyClient from "./bluesky-client.js";
import database from "./mongodb-database.js";

async function getHandlePairs(guildID: string) {

  const sessions = await database.collection("sessions").find({guildID}).toArray();
  const handlePairs = [];
  for (const session of sessions) {

    const {sub} = session;
    const handle = await blueskyClient.didResolver.resolve(sub);
    handlePairs.push([handle.alsoKnownAs?.[0].replace("at://", "") ?? "Unknown handle", sub])

  }

  return handlePairs;

}

export default getHandlePairs;