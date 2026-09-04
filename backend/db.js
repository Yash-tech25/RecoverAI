const dns = require("dns");

const {
  MongoClient,
} = require("mongodb");


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

const mongoUri =
  process.env.MONGO_URI;


if (!mongoUri) {

  throw new Error(
    "MONGO_URI is not configured."
  );
}


const client =
  new MongoClient(
    mongoUri
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


  /*
    client.connect() can complete before the first real database
    operation exposes a network / replica-set problem.

    Ping the selected database before reporting a successful
    connection so startup logs reflect actual database usability.
  */

  await db.command({
    ping: 1
  });


  console.log(
    "MongoDB connected successfully"
  );


  return db;
}


// ======================================================
// GET DATABASE
// ======================================================

function getDB() {

  if (!db) {

    throw new Error(
      "MongoDB has not been initialized."
    );
  }


  return db;
}


// ======================================================
// CLOSE DATABASE
// ======================================================

async function closeDB() {

  await client.close();

  db = undefined;
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  connectDB,

  getDB,

  closeDB,
};