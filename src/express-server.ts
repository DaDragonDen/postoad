import express from "express";
import blueskyClient from "#utils/bluesky-client.js";
import database from "#utils/mongodb-database.js";
import cors from "cors";

const app = express();

app.use(cors());


app.get("/", (_request, response) => {

  response.redirect("https://github.com/DaDragonDen/postoad");

})

app.post("/callback", async (request, response) => {

  try {

    // Ensure that there's a code.
    const {code, state, iss} = request.query;
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
    
    if (typeof(iss) !== "string") {

      response.status(400).json({
        message: "A valid issuer is required."
      });
      
      return;

    }

    // Verify that Postoad has access to the account.
    const urlSearchParams = new URLSearchParams();
    urlSearchParams.set("iss", iss);
    urlSearchParams.set("code", code);
    urlSearchParams.set("state", state as string);

    // Pair the session with the guild.
    await blueskyClient.callback(urlSearchParams);

    // Add the session data to the database.
    response.status(201).json({});

  } catch (error) {

    console.error(error);
    response.status(500).json({
      message: "Internal server error. Please try again later."
    });

  }

});

app.listen(process.env.PORT, () => {

  console.log(`[Express] Server listening on ${process.env.PORT}`);

});

export default {};
