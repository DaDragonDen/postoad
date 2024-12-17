import { NodeOAuthClient, NodeSavedState } from "@atproto/oauth-client-node";
import { JoseKey } from "@atproto/jwk-jose";
import database from "./mongodb-database.js";
import { jwtDecrypt, EncryptJWT, importJWK } from "jose";

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
    get: async (sub, session) => {
      
      // Get the stored session.
      const collection = database.collection("sessions");
      const storedSession = await collection.findOne({sub});
      if (!storedSession) return undefined;

      // Decrypt the access and refresh token.
      

      // Return the decrypted session.

    },
    set: async (sub, session) => {
      
      const encrypted = await new EncryptJWT({
        scope: session.tokenSet.scope,
        refresh_token: session.tokenSet.refresh_token,
        access_token: session.tokenSet.access_token,
        token_type: session.tokenSet.token_type,
        expires_at: session.tokenSet.expires_at
      })
        .setProtectedHeader({ alg: 'dir', enc: 'A128CBC-HS256' })
        .setAudience(session.tokenSet.aud)
        .setSubject(session.tokenSet.sub)
        .setIssuer(session.tokenSet.iss)
        .encrypt(await importJWK(session.dpopJwk));

      console.log(encrypted);

    },
    del: async (sub) => {
      console.log(sub)
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
      
    }
  }
});

export default client;