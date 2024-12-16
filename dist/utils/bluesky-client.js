import { NodeOAuthClient } from "@atproto/oauth-client-node";
import { JoseKey } from "@atproto/jwk-jose";
// Need some keys? Use this for easy access: 
// console.log(JSON.stringify((await JoseKey.fromKeyLike((await JoseKey.generateKeyPair()).privateKey))))
// console.log(JSON.stringify((await JoseKey.fromKeyLike((await JoseKey.generateKeyPair()).privateKey))))
// console.log(JSON.stringify((await JoseKey.fromKeyLike((await JoseKey.generateKeyPair()).privateKey))))
if (!process.env.BLUESKY_PRIVATE_KEY_1)
    throw new Error("BLUESKY_PRIVATE_KEY_1 environment variable required.");
if (!process.env.BLUESKY_PRIVATE_KEY_2)
    throw new Error("BLUESKY_PRIVATE_KEY_2 environment variable required.");
if (!process.env.BLUESKY_PRIVATE_KEY_3)
    throw new Error("BLUESKY_PRIVATE_KEY_3 environment variable required.");
// Uncomment this to get the public keys of the private keys.
// console.log(JSON.stringify((await JoseKey.fromJWK(process.env.BLUESKY_PRIVATE_KEY_1)).publicJwk, null, 2));
// console.log(JSON.stringify((await JoseKey.fromJWK(process.env.BLUESKY_PRIVATE_KEY_2)).publicJwk, null, 2));
// console.log(JSON.stringify((await JoseKey.fromJWK(process.env.BLUESKY_PRIVATE_KEY_3)).publicJwk, null, 2));
const client = await NodeOAuthClient.fromClientId({
    clientId: "https://postoad.beastslash.com/client-metadata.json",
    keyset: await Promise.all([
        JoseKey.fromJWK(process.env.BLUESKY_PRIVATE_KEY_1, "BLUESKY_KEY_1"),
        JoseKey.fromJWK(process.env.BLUESKY_PRIVATE_KEY_2, "BLUESKY_KEY_2"),
        JoseKey.fromJWK(process.env.BLUESKY_PRIVATE_KEY_3, "BLUESKY_KEY_3"),
    ]),
    sessionStore: {
        get: async (key, options) => {
            return undefined;
        },
        set: async (key, options) => {
        },
        del: async (key) => {
        }
    },
    stateStore: {
        get: async (key, options) => {
            return undefined;
        },
        set: async (key, options) => {
        },
        del: async (key) => {
        }
    }
});
export default client;
