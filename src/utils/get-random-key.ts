function getRandomKey() {

  let keyID;
  let key = "";
  while (!keyID) {

    keyID = Math.floor(Math.random() * 3) + 1;
    key = process.env[`BLUESKY_PRIVATE_KEY_${keyID}`] as string;
    if (!key) {

      keyID = undefined;

    }

  }

  return {key, keyID};

}

export default getRandomKey;