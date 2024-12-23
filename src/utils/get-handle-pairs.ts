import blueskyClient from "./bluesky-client.js";
import NoSessionsError from "./errors/NoSessionsError.js";
import database from "./mongodb-database.js";

async function getHandlePairs(guildID: string) {

  const sessions = await database.collection("sessions").find({guildID}).toArray();
  const handlePairs = [];
  for (const session of sessions) {

    const {sub} = session;
    const handle = await blueskyClient.didResolver.resolve(sub);
    handlePairs.push([handle.alsoKnownAs?.[0].replace("at://", "") ?? "Unknown handle", sub])

  }

  if (!handlePairs[0]) {

    throw new NoSessionsError();

  }

  return handlePairs;

}

export default getHandlePairs;