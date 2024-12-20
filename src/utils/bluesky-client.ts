import { NodeSavedState } from "@atproto/oauth-client-node";
import { JoseKey } from "@atproto/jwk-jose";
import database from "./mongodb-database.js";
import decryptSession from "./decrypt-session.js";
import encryptSession from "./encrypt-session.js";
import { NodeOAuthClient } from "./atproto-custom-deps/node-oauth-client.js";
import getRandomKey from "./get-random-key.js";

// Need some keys? Use this for easy access: 
// console.log(JSON.stringify((await JoseKey.fromKeyLike((await JoseKey.generateKeyPair()).privateKey))))
// console.log(JSON.stringify((await JoseKey.fromKeyLike((await JoseKey.generateKeyPair()).privateKey))))
// console.log(JSON.stringify((await JoseKey.fromKeyLike((await JoseKey.generateKeyPair()).privateKey))))
if (!process.env.BLUESKY_PRIVATE_KEY_1) throw new Error("BLUESKY_PRIVATE_KEY_1 environment variable required.");
if (!process.env.BLUESKY_PRIVATE_KEY_2) throw new Error("BLUESKY_PRIVATE_KEY_2 environment variable required.");
if (!process.env.BLUESKY_PRIVATE_KEY_3) throw new Error("BLUESKY_PRIVATE_KEY_3 environment variable required.");

// Uncomment this to get the public keys of the private keys.
// console.log(JSON.stringify((await JoseKey.fromJWK(process.env.BLUESKY_PRIVATE_KEY_1)).publicJwk, null, 2));
// console.log(JSON.stringify((await JoseKey.fromJWK(process.env.BLUESKY_PRIVATE_KEY_2)).publicJwk, null, 2));
// console.log(JSON.stringify((await JoseKey.fromJWK(process.env.BLUESKY_PRIVATE_KEY_3)).publicJwk, null, 2));

const stateStore: {[key: string]: NodeSavedState} = {};

const blueskyClient = await NodeOAuthClient.fromClientId({
  clientId: "https://postoad.beastslash.com/client-metadata.json",
  keyset: await Promise.all([
    JoseKey.fromJWK(process.env.BLUESKY_PRIVATE_KEY_1, "BLUESKY_KEY_1"),
    JoseKey.fromJWK(process.env.BLUESKY_PRIVATE_KEY_2, "BLUESKY_KEY_2"),
    JoseKey.fromJWK(process.env.BLUESKY_PRIVATE_KEY_3, "BLUESKY_KEY_3"),
  ]),
  sessionStore: {
    get: async (sub, options) => {

      // Get the stored session.
      const collection = database.collection("sessions");
      const sessionData = await collection.findOne({sub, guildID: options?.guildID});
      if (!sessionData) return undefined;

      // Decrypt the session.
      const key = options?.decryptionPassword && typeof(options.decryptionPassword) === "string" ? options.decryptionPassword : process.env[`BLUESKY_PRIVATE_KEY_${sessionData.keyID}`];
      if (!key) return undefined;

      // Return the decrypted session.
      return await decryptSession(sessionData.encryptedSession, key);

    },
    set: async (sub, session, options) => {
      
      // Turn the session info into a string.
      const sessionJSON = JSON.stringify(session);

      // Check the type of security the system should use.
      const guildID = options?.guildID ?? options?.stateData;
      if (!guildID) throw new Error("Guild ID missing."); 
      const guildData = await database.collection("guilds").findOne({guildID});
      let keyID;
      let encryptedSession;
      if (guildData && guildData.encryptionLevel === 2) {

        if (typeof(options?.encryptionKey) !== "string") {

          throw new Error("Encryption key is missing.");

        }

        encryptedSession = await encryptSession(sessionJSON, options.encryptionKey);

      } else {

        // Select a random key for encryption.
        const keyData = getRandomKey();
        encryptedSession = await encryptSession(sessionJSON, keyData.key);
        keyID = keyData.keyID;
        
      }

      // Save the session to the database.
      await database.collection("sessions").updateOne({
        sub
      }, {
        $set: {
          encryptedSession,
          keyID,
          guildID
        }
      }, {
        upsert: true
      });

    },
    del: async (sub) => {

      // Delete the session based on the sub.
      await database.collection("sessions").deleteOne({sub});
      await database.collection<{
        subs: string[]
      }>("guilds").updateMany({
        subs: {
          $in: [sub]
        }
      }, {
        $pull: {
          subs: {
            $in: [sub]
          }
        }
      });
    }
    
  },
  stateStore: {
    get: async (key) => {
      return stateStore[key];
    },
    set: async (key, state) => {
      stateStore[key] = state;
    },
    del: async (key) => {
      delete stateStore[key];
    }
  }
});

export default blueskyClient;