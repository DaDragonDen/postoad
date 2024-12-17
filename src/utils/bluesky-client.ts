import { NodeOAuthClient, NodeSavedState } from "@atproto/oauth-client-node";
import { JoseKey } from "@atproto/jwk-jose";
import database from "./mongodb-database.js";
import { jwtDecrypt, EncryptJWT, importJWK } from "jose";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

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

const client = await NodeOAuthClient.fromClientId({
  clientId: "https://postoad.beastslash.com/client-metadata.json",
  keyset: await Promise.all([
    JoseKey.fromJWK(process.env.BLUESKY_PRIVATE_KEY_1, "BLUESKY_KEY_1"),
    JoseKey.fromJWK(process.env.BLUESKY_PRIVATE_KEY_2, "BLUESKY_KEY_2"),
    JoseKey.fromJWK(process.env.BLUESKY_PRIVATE_KEY_3, "BLUESKY_KEY_3"),
  ]),
  sessionStore: {
    get: async (sub) => {

      // Get the stored session.
      const collection = database.collection("sessions");
      const sessionData = await collection.findOne({sub});
      if (!sessionData) return undefined;

      // Decrypt the session.
      const key = process.env[`BLUESKY_PRIVATE_KEY_${sessionData.keyID}`];
      if (!key) return undefined;

      const keyHash = createHash("sha256").update(key).digest();
      const buffer = Buffer.from(sessionData.encryptedSession, "base64");
      const iv = buffer.subarray(0, 16);
      const encryptedText = buffer.subarray(16).toString("hex");
      const decipher = createDecipheriv("aes-256-cbc", keyHash, iv);
      let decryptedText = decipher.update(encryptedText, "hex", "utf-8");
      decryptedText += decipher.final("utf-8");

      // Turn the session back into an object.
      const session = JSON.parse(decryptedText);

      // Return the decrypted session.
      return session;

    },
    set: async (sub, session) => {
      
      // Turn the session info into a string.
      const sessionJSON = JSON.stringify(session);

      // Select a random key for encryption.
      let key;
      let keyID;
      while (!key) {

        keyID = Math.floor(Math.random() * 3) + 1;
        key = process.env[`BLUESKY_PRIVATE_KEY_${keyID}`];

      }
      
      // Encrypt the session using the key.
      const keyHash = createHash("sha256").update(key).digest();
      const iv = randomBytes(16);
      const cipher = createCipheriv("aes-256-cbc", keyHash, iv);
      let encryptedSession = cipher.update(sessionJSON, "utf-8", "hex");
      encryptedSession += cipher.final("hex");
      const encryptedSessionBase64 = Buffer.concat([iv, Buffer.from(encryptedSession, "hex")]).toString("base64");

      // Save the session to the database.
      await database.collection("sessions").updateOne({
        sub
      }, {
        $set: {
          encryptedSession: encryptedSessionBase64,
          keyID
        }
      });

    },
    del: async (sub) => {

      // Delete the session based on the sub.
      await database.collection("sessions").deleteOne({sub});

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

export default client;