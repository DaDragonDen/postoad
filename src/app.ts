import { Client } from "oceanic.js";


const client = new Client({
  auth: `Bot ${process.env.DISCORD_TOKEN}`
});

client.on("ready", async () => {

  console.log(`[Discord] Signed in as ${client.user.tag} (${client.user.id}).`);

});

client.connect();