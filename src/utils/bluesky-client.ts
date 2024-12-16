import { JoseKey } from "@atproto/jwk-jose";
import { NodeOAuthClient } from "@atproto/oauth-client-node";

const client = new NodeOAuthClient({
  clientMetadata: {
    client_id: "https://postoad.beastslash.com/client-metadata.json",
    client_name: "Postoad",
    client_uri: "https://postoad.beastslash.com",
    redirect_uris: ["https://postoad.beastslash.com/callback"],
    grant_types: ["authorization_code", "refresh_token"],
    tos_uri: "https://postoad.beastslash.com/terms",
    policy_uri: "https://postoad.beastslash.com/privacy",
    response_types: ["code"],
    application_type: "native",
    scope: "atproto",
    token_endpoint_auth_method: "none"
  },
  // keyset: await Promise.all([
  //   JoseKey.fromImportable(process.env.PRIVATE_KEY_1),
  //   JoseKey.fromImportable(process.env.PRIVATE_KEY_2),
  //   JoseKey.fromImportable(process.env.PRIVATE_KEY_3),
  // ]),
  sessionStore: {
    get: async (key, options) => {
      return undefined
    },
    set: async (key, options) => {
      
    },
    del: async (key) => {

    }
  },
  stateStore: {
    get: async (key, options) => {
      return undefined
    },
    set: async (key, options) => {
      
    },
    del: async (key) => {
      
    }
  }
})

export default client;