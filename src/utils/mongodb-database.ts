import { MongoClient } from "mongodb";

const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) throw new Error("Please define MONGODB_URI in the .env file.");

const mongoClient = new MongoClient(mongoURI, {
  tlsCertificateKeyFile: "/etc/secrets/mongodb.pem"
});
const database = mongoClient.db(process.env.MONGODB_DATABASE);

export default database;