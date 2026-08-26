const dns = require("dns");

const {
  MongoClient,
} = require("mongodb");

require("dotenv").config();


// ======================================================
// DNS CONFIGURATION
// ======================================================

/*
  Some Windows / ISP DNS configurations resolve
  MongoDB Atlas SRV records inconsistently in Node.js.

  Public DNS servers are used here so Node can
  reliably resolve mongodb+srv connection strings.

  This does not expose credentials and does not
  change the MongoDB connection security model.
*/

dns.setServers([
  "8.8.8.8",
  "1.1.1.1",
]);


// ======================================================
// MONGODB CLIENT
// ======================================================

const client =
  new MongoClient(
    process.env.MONGO_URI
  );


let db;


// ======================================================
// CONNECT DATABASE
// ======================================================

async function connectDB() {

  await client.connect();


  db =
    client.db(
      "recoverai"
    );


  console.log(
    "MongoDB connected successfully"
  );


  return db;
}


// ======================================================
// GET DATABASE
// ======================================================

function getDB() {

  return db;
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  connectDB,

  getDB,
};