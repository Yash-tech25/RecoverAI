const { MongoClient } = require("mongodb");
require("dotenv").config();

const client = new MongoClient(process.env.MONGO_URI);

let db;

async function connectDB() {
  await client.connect();

  db = client.db("recoverai");

  console.log("MongoDB connected successfully");

  return db;
}

function getDB() {
  return db;
}

module.exports = {
  connectDB,
  getDB,
};