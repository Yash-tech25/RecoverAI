// ======================================================
// DATABASE ERROR LOGGING
// ======================================================

let lastDatabaseErrorSignature = null;
let lastDatabaseErrorTime = 0;

const ERROR_LOG_COOLDOWN_MS =
  30 * 1000;


// ======================================================
// DETECT TRANSIENT DATABASE / DNS ERRORS
// ======================================================

function isTransientDatabaseError(
  error
) {

  const message =
    error?.message || "";

  return (
    message.includes(
      "MongoServerSelectionError"
    )
    ||
    message.includes(
      "ENOTFOUND"
    )
    ||
    message.includes(
      "ECONNRESET"
    )
    ||
    message.includes(
      "ETIMEDOUT"
    )
  );
}


// ======================================================
// LOG DATABASE ERROR WITHOUT FLOODING TERMINAL
// ======================================================

function logDatabaseError(
  context,
  error
) {

  const now =
    Date.now();

  const signature =
    `${error?.name || "Error"}:${error?.message || "Unknown database error"}`;


  const sameRecentError =

    signature ===
      lastDatabaseErrorSignature

    &&

    now -
      lastDatabaseErrorTime <
      ERROR_LOG_COOLDOWN_MS;


  if (
    sameRecentError
  ) {

    return;
  }


  lastDatabaseErrorSignature =
    signature;

  lastDatabaseErrorTime =
    now;


  if (
    isTransientDatabaseError(
      error
    )
  ) {

    console.warn(
      `[Database temporarily unavailable] ${context}: ${error.message}`
    );

    return;
  }


  console.error(
    `[Database error] ${context}:`,
    error
  );
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  isTransientDatabaseError,

  logDatabaseError
};