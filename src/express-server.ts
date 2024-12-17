import express from "express";
import blueskyClient from "#utils/bluesky-client.js";

const app = express();

app.post("/callback", async (request, response) => {

  // Ensure that there's a code.
  const {code, state} = request.query;
  if (typeof(code) !== "string") {

    response.status(400).json({
      message: "An authorization code is required."
    });

    return;

  }

  // Ensure that there's a state.
  if (typeof(state) !== "string") {

    response.status(400).json({
      message: "A valid state is required."
    });
    
    return;

  }

  // Verify that Postoad has access to the account.
  const urlSearchParams = new URLSearchParams();
  urlSearchParams.set("code", code);
  urlSearchParams.set("state", state as string);

  // Pair the session with the server.
  const callbackResult = await blueskyClient.callback(urlSearchParams);
  console.log(callbackResult);
  
  // Add the session data to the database.
  response.status(201).json({});

});

app.listen(process.env.PORT, () => {

  console.log(`[Express] Server listening on ${process.env.PORT}`);

});

export default {};