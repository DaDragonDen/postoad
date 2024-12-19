import atproto, { assertAtprotoDid, AtprotoHandleResolverNode, InternalStateData, NodeOAuthClient, NodeOAuthClientFromMetadataOptions, NodeOAuthClientOptions, NodeSavedSession, NodeSavedSessionStore, NodeSavedState, OAuthClient, OAuthServerFactory, OAuthSession, Session, SessionGetter, SessionStore } from "@atproto/oauth-client-node";
import { JoseKey } from "@atproto/jwk-jose";
import database from "./mongodb-database.js";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import SimpleStore from "@atproto-labs/simple-store";
import JWK from "@atproto/jwk";

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

interface PotentiallyProtectedSimpleStore<K extends SimpleStore.Key = string, V extends SimpleStore.Value = SimpleStore.Value> extends Omit<SimpleStore.SimpleStore<K, V>, "get"> {
  get: (key: K, options?: SimpleStore.GetOptions & {decryptionPassword?: string}) => SimpleStore.Awaitable<undefined | V>
};

type PotentiallyProtectedSessionStore = PotentiallyProtectedSimpleStore<string, Session>;
type PotentiallyProtectedNodeSavedSessionStore = PotentiallyProtectedSimpleStore<string, NodeSavedSession>;

class PotentiallyProtectedSessionGetter extends SessionGetter {

  constructor(sessionStore: PotentiallyProtectedSessionStore, serverFactory: ConstructorParameters<typeof SessionGetter>[1], runtime: ConstructorParameters<typeof SessionGetter>[2]) {

    super(sessionStore, serverFactory, runtime)

  }

  async get(sub: atproto.AtprotoDid, options?: atproto.GetCachedOptions & {decryptionPassword?: string}): Promise<atproto.Session> {
    
    console.log("getting");
    if (options?.decryptionPassword) {



    }

    return await super.get(sub);

  }

  async getSession(sub: atproto.AtprotoDid, refresh?: boolean, decryptionPassword?: string): Promise<atproto.Session> {
      
    return this.get(sub, {
      noCache: refresh === true,
      allowStale: refresh === false,
      decryptionPassword
    })

  }

}

type ToDpopJwkValue<V> = Omit<V, 'dpopKey'> & {
  dpopJwk: JWK.Jwk
}

function toDpopKeyStore<K extends string, V extends InternalStateData>(
  store: SimpleStore.SimpleStore<K, ToDpopJwkValue<InternalStateData>>,
): SimpleStore.SimpleStore<K, V>;
function toDpopKeyStore<K extends string, V extends Session>(
  store: PotentiallyProtectedSimpleStore<K, ToDpopJwkValue<Session>>,
): PotentiallyProtectedSimpleStore<K, V>;
function toDpopKeyStore<K extends string, V extends Session | InternalStateData>(
  store: SimpleStore.SimpleStore<K, ToDpopJwkValue<InternalStateData>> | PotentiallyProtectedSimpleStore<K, ToDpopJwkValue<Session>>,
): SimpleStore.SimpleStore<K, V> | PotentiallyProtectedSimpleStore<K, V> {
  return {
    async set(sub: K, { dpopKey, ...data }: V) {
      const dpopJwk = dpopKey.privateJwk
      if (!dpopJwk) throw new Error('Private DPoP JWK is missing.')

      await store.set(sub, { ...data, dpopJwk } as any)
    },

    async get(sub: K, ...props: any) {
      const result = await store.get(sub, ...props);
      if (!result) return undefined

      const { dpopJwk, ...data } = result
      const dpopKey = await JoseKey.fromJWK(dpopJwk);
      return { ...data, dpopKey } as unknown as V
    },

    del: store.del.bind(store),
    clear: store.clear?.bind(store),
  }
}

class PotentiallyProtectedOAuthClient extends OAuthClient {

  sessionGetter: PotentiallyProtectedSessionGetter;

  constructor(options: Omit<NodeOAuthClientOptions, "sessionStore"> & {sessionStore: PotentiallyProtectedNodeSavedSessionStore}) {

    const sessionStore = toDpopKeyStore(options.sessionStore);
    const stateStore = toDpopKeyStore(options.stateStore);
    super({
      ...options, 
      sessionStore,
      handleResolver: new AtprotoHandleResolverNode({
        fetch: options.fetch,
        fallbackNameservers: options.fallbackNameservers,
      }),
      stateStore,
      responseMode: options.responseMode ?? "query",
      runtimeImplementation: {
        requestLock: options.requestLock,
        createKey: (algs) => JoseKey.generate(algs),
        getRandomValues: randomBytes,
        digest: (bytes, algorithm) =>
          createHash(algorithm.name).update(bytes).digest(),
      }
    });
    this.sessionGetter = new PotentiallyProtectedSessionGetter(
      sessionStore,
      this.serverFactory,
      this.runtime,
    )

  }

  static async fromClientId(options: Omit<NodeOAuthClientFromMetadataOptions, "sessionStore"> & {sessionStore: PotentiallyProtectedNodeSavedSessionStore}): Promise<PotentiallyProtectedOAuthClient> {

    const clientMetadata = await OAuthClient.fetchMetadata(options)
    return new PotentiallyProtectedOAuthClient({ ...options, clientMetadata })

  }

  async restore(sub: string, refresh?: boolean | "auto", decryptionPassword?: string): Promise<OAuthSession> {
      
    assertAtprotoDid(sub)

    const { dpopKey, tokenSet } = await this.sessionGetter.get(sub, {
      noCache: refresh === true,
      allowStale: refresh === false,
      decryptionPassword
    })

    const server = await this.serverFactory.fromIssuer(tokenSet.iss, dpopKey, {
      noCache: refresh === true,
      allowStale: refresh === false,
    })

    return this.createSession(server, sub);

  }

}

const blueskyClient = await PotentiallyProtectedOAuthClient.fromClientId({
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