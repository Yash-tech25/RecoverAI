const {
  getDB
} = require("../db");


const {
  PROMISE_STATUSES
} = require(
  "./recoveryStateService"
);

const {
  createStateTransitionAuditLog,
  saveAuditLogs
} = require(
  "./auditService"
);


const PROMISE_GRACE_PERIOD_HOURS = 24;


// ======================================================
// NORMALIZE DATE TO UTC CALENDAR DAY
// ======================================================

function startOfUTCDay(
  value
) {

  const date =
    new Date(value);


  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );
}


// ======================================================
// REFRESH PROMISE LIFECYCLE STATES
// ======================================================

async function refreshPromiseStatuses() {

  const db =
    getDB();


  const collection =
    db.collection(
      "recoveryStates"
    );


  const now =
    new Date();


  const today =
    startOfUTCDay(
      now
    );


  // ----------------------------------------------------
  // STEP 1 — ACTIVE → DUE
  // ----------------------------------------------------

  const activePromises =
    await collection
      .find({
        outcome:
          "PROMISE_TO_PAY",

        "promise.promiseStatus":
          PROMISE_STATUSES.ACTIVE
      })
      .toArray();


  let markedDue =
    0;


  for (
    const state
    of activePromises
  ) {

    const promisedDate =
      state.promise
        ?.promisedDate;


    if (!promisedDate) {
      continue;
    }


    const dueDate =
      startOfUTCDay(
        promisedDate
      );


    if (
      dueDate <= today
    ) {

      const dueAt =
        new Date();


     const updateResult =
  await collection.updateOne(

    {
      paymentId:
        state.paymentId,

      "promise.promiseStatus":
        PROMISE_STATUSES.ACTIVE
    },

    {
      $set: {

        "promise.promiseStatus":
          PROMISE_STATUSES.DUE,

        "promise.updatedAt":
          dueAt,

        "promise.dueAt":
          dueAt
      }
    }
  );


if (
  updateResult.modifiedCount >
  0
) {

  const nextState = {

    ...state,

    promise: {

      ...state.promise,

      promiseStatus:
        PROMISE_STATUSES.DUE,

      updatedAt:
        dueAt,

      dueAt
    }
  };


  const auditLog =
    createStateTransitionAuditLog({

      payment: {

        paymentId:
          state.paymentId,

        customerId:
          state.customerId,

        amount:
          state.promise
            ?.promisedAmount || 0
      },

      previousState:
        state,

      nextState,

      event:
        "PROMISE_BECAME_DUE",

      actionType:
        "PROMISE_LIFECYCLE",

      actionMessage:
        "Promise-to-Pay reached its due date.",

      explanation:
        "The promised payment date has arrived. The commitment remains open during the configured grace period.",

      metadata: {

        previousPromiseStatus:
          PROMISE_STATUSES.ACTIVE,

        promiseStatus:
          PROMISE_STATUSES.DUE
      }
    });


  await saveAuditLogs([
    auditLog
  ]);


  markedDue++;
}
    }
  }


  // ----------------------------------------------------
  // STEP 2 — DUE → BROKEN
  // AFTER GRACE PERIOD EXPIRES
  // ----------------------------------------------------

  const duePromises =
    await collection
      .find({
        outcome:
          "PROMISE_TO_PAY",

        "promise.promiseStatus":
          PROMISE_STATUSES.DUE
      })
      .toArray();


  let markedBroken =
    0;


  for (
    const state
    of duePromises
  ) {

    const dueAt =
      state.promise
        ?.dueAt;


    if (!dueAt) {
      continue;
    }


    const dueAtDate =
      new Date(
        dueAt
      );


    const gracePeriodEnd =
      new Date(
        dueAtDate.getTime() +
        PROMISE_GRACE_PERIOD_HOURS *
          60 *
          60 *
          1000
      );


    if (
      now >=
      gracePeriodEnd
    ) {

      const brokenAt =
        new Date();


      const updateResult =
        await collection.updateOne(

          {
            paymentId:
              state.paymentId,

            "promise.promiseStatus":
              PROMISE_STATUSES.DUE
          },

          {
            $set: {

              "promise.promiseStatus":
                PROMISE_STATUSES.BROKEN,

              "promise.updatedAt":
                brokenAt,

              "promise.brokenAt":
                brokenAt,

              outcome:
                "AWAITING_CONVERSATION",

              recoveryAction:
                "START_CONVERSATIONAL_RECOVERY",

              explanation:
                "The Promise-to-Pay grace period expired without payment. RecoverAI is re-engaging the customer through conversational recovery.",

              processedAt:
                brokenAt
            }
          }
        );


      if (
  updateResult.modifiedCount >
  0
) {

  const nextState = {

    ...state,

    recoveryAction:
      "START_CONVERSATIONAL_RECOVERY",

    outcome:
      "AWAITING_CONVERSATION",

    explanation:
      "The Promise-to-Pay grace period expired without payment. RecoverAI is re-engaging the customer through conversational recovery.",

    processedAt:
      brokenAt,

    promise: {

      ...state.promise,

      promiseStatus:
        PROMISE_STATUSES.BROKEN,

      updatedAt:
        brokenAt,

      brokenAt
    }
  };


  const auditLog =
    createStateTransitionAuditLog({

      payment: {

        paymentId:
          state.paymentId,

        customerId:
          state.customerId,

        amount:
          state.promise
            ?.promisedAmount || 0
      },

      previousState:
        state,

      nextState,

      event:
        "PROMISE_BROKEN",

      actionType:
        "PROMISE_LIFECYCLE",

      actionMessage:
        "Promise-to-Pay grace period expired without payment; conversational recovery was reopened.",

      explanation:
        nextState.explanation,

      metadata: {

        previousPromiseStatus:
          PROMISE_STATUSES.DUE,

        promiseStatus:
          PROMISE_STATUSES.BROKEN
      }
    });


  await saveAuditLogs([
    auditLog
  ]);


  markedBroken++;
}
    }
  }


  return {

    checkedActive:
      activePromises.length,

    checkedDue:
      duePromises.length,

    markedDue,

    markedBroken
  };
}


// ======================================================
// GET PROMISE SUMMARY
// ======================================================

async function getPromiseSummary() {

  const db =
    getDB();


  const promises =
    await db
      .collection(
        "recoveryStates"
      )
      .find({
        promise: {
          $exists:
            true
        }
      })
      .toArray();


  const summary = {

    totalPromises:
      promises.length,

    active:
      0,

    due:
      0,

    kept:
      0,

    broken:
      0,

    cancelled:
      0,

    activeAmount:
      0,

    dueAmount:
      0,

    keptAmount:
      0,

    brokenAmount:
      0
  };


  for (
    const state
    of promises
  ) {

    const status =
      state.promise
        ?.promiseStatus;


    const amount =
      Number(
        state.promise
          ?.promisedAmount || 0
      );


    if (
      status ===
      PROMISE_STATUSES.ACTIVE
    ) {

      summary.active++;

      summary.activeAmount +=
        amount;
    }


    else if (
      status ===
      PROMISE_STATUSES.DUE
    ) {

      summary.due++;

      summary.dueAmount +=
        amount;
    }


    else if (
      status ===
      PROMISE_STATUSES.KEPT
    ) {

      summary.kept++;

      summary.keptAmount +=
        amount;
    }


    else if (
      status ===
      PROMISE_STATUSES.BROKEN
    ) {

      summary.broken++;

      summary.brokenAmount +=
        amount;
    }


    else if (
      status ===
      PROMISE_STATUSES.CANCELLED
    ) {

      summary.cancelled++;
    }
  }


  return summary;
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  refreshPromiseStatuses,

  getPromiseSummary
};