const {
  getDB,
} = require("../db");


const {
  createAuditLog,
  createStateTransitionAuditLog,
  createWebhookAuditLog,
  saveAuditLogs
} = require(
  "./auditService"
);


// ======================================================
// RECOVERY GUARDRAIL CONFIGURATION
// ======================================================

const MAX_AUTONOMOUS_RECOVERY_ATTEMPTS = 2;

const MAX_TOTAL_RECOVERY_ATTEMPTS = 3;


// ======================================================
// PROMISE-TO-PAY STATUS VALUES
// ======================================================

const PROMISE_STATUSES = {

  ACTIVE:
    "ACTIVE",

  DUE:
    "DUE",

  KEPT:
    "KEPT",

  BROKEN:
    "BROKEN",

  CANCELLED:
    "CANCELLED"
};


// ======================================================
// GET RECOVERY STATE
// ======================================================

async function getRecoveryState(
  paymentId
) {

  const db =
    getDB();


  return await db
    .collection(
      "recoveryStates"
    )
    .findOne({
      paymentId
    });
}


// ======================================================
// GET STATE USING RAZORPAY PAYMENT LINK
// ======================================================

async function getRecoveryStateByPaymentLinkId(
  paymentLinkId
) {

  const db =
    getDB();


  return await db
    .collection(
      "recoveryStates"
    )
    .findOne({
      paymentLinkId
    });
}


// ======================================================
// GET RECOVERY GUARDRAIL
// ======================================================

async function getRecoveryGuardrail(
  paymentId
) {

  const state =
    await getRecoveryState(
      paymentId
    );


  // ====================================================
  // NO PREVIOUS RECOVERY STATE
  // ====================================================

  if (!state) {

    return {

      allowed:
        true,

      forcedAction:
        null,

      recoveryAttempts:
        0,

      reason:
        "No previous recovery attempts."
    };
  }


  const recoveryAttempts =
    state.recoveryAttempts || 0;


  // ====================================================
  // OPEN PROMISE CHECK
  // ====================================================

  /*
    Only ACTIVE or DUE promises should pause
    additional autonomous recovery.

    KEPT
      Already resolves to RECOVERED.

    BROKEN
      Must be allowed to re-enter conversational
      recovery.

    CANCELLED
      May also re-enter the recovery router.
  */

  const hasOpenPromise =

    state.outcome ===
      "PROMISE_TO_PAY"

    &&

    (
      state.promise?.promiseStatus ===
        PROMISE_STATUSES.ACTIVE

      ||

      state.promise?.promiseStatus ===
        PROMISE_STATUSES.DUE
    );


  if (hasOpenPromise) {

    return {

      allowed:
        false,

      forcedAction:
        null,

      recoveryAttempts,

      reason:
        `Recovery is paused while the Promise-to-Pay is ${state.promise?.promiseStatus}.`
    };
  }


  // ====================================================
  // TERMINAL OR PAUSED STATES
  // ====================================================

  /*
    These states must never be automatically
    processed again.

    RECOVERED
      Payment has already been recovered.

    STOPPED
      Recovery lifecycle has ended.

    PENDING_PAYMENT
      Razorpay payment link is already waiting
      for the customer.

    HUMAN_REVIEW
      Autonomous processing has intentionally
      been paused and escalated.
  */

  const blockedOutcomes = [

    "RECOVERED",

    "STOPPED",

    "PENDING_PAYMENT",

    "HUMAN_REVIEW"
  ];


  if (
    blockedOutcomes.includes(
      state.outcome
    )
  ) {

    return {

      allowed:
        false,

      forcedAction:
        null,

      recoveryAttempts,

      reason:
        `Recovery cannot continue while the case is ${state.outcome}.`
    };
  }


  // ====================================================
  // DEFENSIVE HARD STOP
  // ====================================================

  if (
    recoveryAttempts >=
    MAX_TOTAL_RECOVERY_ATTEMPTS
  ) {

    return {

      allowed:
        true,

      forcedAction:
        "STOP_RECOVERY",

      recoveryAttempts,

      reason:
        "Maximum total recovery attempts reached."
    };
  }


  // ====================================================
  // AUTONOMOUS RECOVERY ATTEMPT LIMIT
  // ====================================================

  if (
    recoveryAttempts >=
      MAX_AUTONOMOUS_RECOVERY_ATTEMPTS

    &&

    state.outcome ===
      "RECOVERY_FAILED"
  ) {

    return {

      allowed:
        true,

      forcedAction:
        "HUMAN_REVIEW",

      recoveryAttempts,

      reason:
        "Two autonomous recovery attempts have already failed."
    };
  }


  // ====================================================
  // RECOVERY MAY CONTINUE
  // ====================================================

  return {

    allowed:
      true,

    forcedAction:
      null,

    recoveryAttempts,

    reason:
      "Recovery may continue."
  };
}


// ======================================================
// CHECK WHETHER AGENT MAY PROCESS CASE
// ======================================================

async function canProcessRecovery(
  paymentId
) {

  const guardrail =
    await getRecoveryGuardrail(
      paymentId
    );


  return guardrail.allowed;
}


// ======================================================
// DETERMINE WHETHER ACTION COUNTS AS AN ATTEMPT
// ======================================================

function shouldCountRecoveryAttempt(
  action,
  executionResult
) {

  /*
    recoveryAttempts represents genuine
    autonomous interventions performed by
    RecoverAI.

    Promise creation is a customer commitment,
    not another payment recovery attempt.
  */

  const autonomousActions = [

    "RETRY",

    "REMIND_LATER",

    "SEND_REMINDER",

    "SEND_ALTERNATIVE_PAYMENT_METHOD",

    "OFFER_LOYALTY_INCENTIVE"
  ];


  return (
    autonomousActions.includes(
      action
    )
    &&
    executionResult.actionExecuted ===
      true
  );
}


// ======================================================
// SAVE PROCESSED RECOVERY STATE
// ======================================================

async function markAsProcessed(
  payment,
  action,
  outcome,
  executionResult = {},
  explanation = "",
  routingDecision = null
) {

  const db =
    getDB();


  const existingState =
    await getRecoveryState(
      payment.paymentId
    );


  const previousAttempts =
    existingState
      ?.recoveryAttempts || 0;


  const attemptIncrement =
    shouldCountRecoveryAttempt(
      action,
      executionResult
    )
      ? 1
      : 0;


  const updateData = {

    paymentId:
      payment.paymentId,

    customerId:
      payment.customerId,

    recoveryAction:
      action,

    outcome,

    explanation,

    recoveryAttempts:
      previousAttempts +
      attemptIncrement,

    processedAt:
      new Date()
  };


  // ====================================================
  // ROUTING DECISION TRACE
  // ====================================================

  if (
    routingDecision &&
    typeof routingDecision === "object"
  ) {

    updateData.routingDecision = {

      channel:
        routingDecision.channel || null,

      source:
        routingDecision.source || null,

      confidence:
        routingDecision.confidence ?? null,

      reason:
        routingDecision.reason || ""
    };
  }


  // ====================================================
  // RAZORPAY PAYMENT LINK METADATA
  // ====================================================

  if (
    executionResult.paymentLinkId
  ) {

    updateData.paymentLinkId =
      executionResult.paymentLinkId;

    updateData.paymentLinkUrl =
      executionResult.paymentLinkUrl;

    updateData.paymentLinkStatus =
      executionResult.paymentLinkStatus;
  }


  const updateResult =
    await db
      .collection(
        "recoveryStates"
      )
      .updateOne(

        {
          paymentId:
            payment.paymentId
        },

        {
          $set:
            updateData
        },

        {
          upsert:
            true
        }
      );


  if (
    updateResult.acknowledged
  ) {

    const recoveryResult = {

      outcome,

      recovered:
        outcome ===
        "RECOVERED",

      recoveredAmount:
        outcome ===
        "RECOVERED"
          ? Number(
              payment.amount || 0
            )
          : 0
    };


    const auditLog =
      createAuditLog(

        payment,

        action,

        explanation,

        executionResult,

        recoveryResult
      );


    auditLog.previousOutcome =
      existingState?.outcome ||
      null;


    auditLog.previousRecoveryAction =
      existingState?.recoveryAction ||
      null;


    await saveAuditLogs([
      auditLog
    ]);
  }


  return await getRecoveryState(
    payment.paymentId
  );
}


// ======================================================
// CREATE PROMISE TO PAY
// ======================================================

async function createPromiseToPay(
  payment,
  {
    promisedAmount,
    promisedDate,
    conversationSummary = "",
    language = "unknown",
    confidence = null
  }
) {

  // ====================================================
  // BASIC VALIDATION
  // ====================================================

  if (
    !payment ||
    !payment.paymentId ||
    !payment.customerId
  ) {

    throw new Error(
      "Valid payment details are required to create a Promise-to-Pay."
    );
  }


  const normalizedAmount =
    Number(
      promisedAmount
    );


  if (
    !Number.isFinite(
      normalizedAmount
    ) ||
    normalizedAmount <= 0
  ) {

    throw new Error(
      "Promised amount must be greater than 0."
    );
  }


  if (!promisedDate) {

    throw new Error(
      "Promised payment date is required."
    );
  }


  const promisedDateObject =
    new Date(
      promisedDate
    );


  if (
    Number.isNaN(
      promisedDateObject.getTime()
    )
  ) {

    throw new Error(
      "Promised payment date is invalid."
    );
  }


  /*
    A new promise should not already be expired.

    Compare calendar dates instead of exact times because
    a customer promising to pay "today" is still valid.
  */

  const promisedDateKey =
    promisedDateObject
      .toISOString()
      .slice(
        0,
        10
      );


  const todayKey =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      );


  if (
    promisedDateKey <
    todayKey
  ) {

    throw new Error(
      "Promised payment date cannot be in the past."
    );
  }


  const db =
    getDB();


  const existingState =
    await getRecoveryState(
      payment.paymentId
    );


  // ====================================================
  // OPEN PROMISE GUARDRAIL
  // ====================================================

  /*
    Do not silently overwrite a Promise-to-Pay that is
    still ACTIVE or DUE.

    A repeated identical request is treated as idempotent
    and simply returns the existing state.

    A different promise while another one is still open
    is rejected.
  */

  const existingPromiseStatus =
    existingState
      ?.promise
      ?.promiseStatus;


  const hasOpenPromise = [

    PROMISE_STATUSES.ACTIVE,

    PROMISE_STATUSES.DUE

  ].includes(
    existingPromiseStatus
  );


  if (
    hasOpenPromise
  ) {

    const existingAmount =
      Number(
        existingState
          .promise
          ?.promisedAmount || 0
      );


    const existingDate =
      existingState
        .promise
        ?.promisedDate

        ? new Date(
            existingState
              .promise
              .promisedDate
          )

        : null;


    const existingDateKey =
      existingDate &&
      !Number.isNaN(
        existingDate.getTime()
      )

        ? existingDate
            .toISOString()
            .slice(
              0,
              10
            )

        : null;


    const samePromise =
      existingAmount ===
        normalizedAmount

      &&

      existingDateKey ===
        promisedDateKey;


    if (
      samePromise
    ) {

      /*
        Duplicate request.

        Do not modify the state and do not create
        another audit event.
      */

      return existingState;
    }


    throw new Error(
      "An active Promise-to-Pay already exists for this payment."
    );
  }


  const recoveryAttempts =
    existingState
      ?.recoveryAttempts || 0;


  const createdAt =
    new Date();


  const promiseData = {

    paymentId:
      payment.paymentId,

    customerId:
      payment.customerId,

    recoveryAction:
      "CREATE_PROMISE_TO_PAY",

    outcome:
      "PROMISE_TO_PAY",

    recoveryAttempts,

    promise: {

      promisedAmount:
        normalizedAmount,

      promisedDate:
        promisedDateObject,

      promiseStatus:
        PROMISE_STATUSES.ACTIVE,

      conversationSummary,

      language,

      confidence,

      createdAt,

      followUpAt:
        promisedDateObject
    },

    processedAt:
      createdAt
  };


  const updateResult =
    await db
      .collection(
        "recoveryStates"
      )
      .updateOne(

        {
          paymentId:
            payment.paymentId
        },

        {
          $set:
            promiseData
        },

        {
          upsert:
            true
        }
      );


  if (
    updateResult.acknowledged
  ) {

    const auditLog =
      createStateTransitionAuditLog({

        payment,

        previousState:
          existingState,

        nextState:
          promiseData,

        event:
          "PROMISE_CREATED",

        actionType:
          "CONVERSATIONAL_RECOVERY",

        actionMessage:
          `Promise-to-Pay recorded for ₹${normalizedAmount.toLocaleString(
            "en-IN"
          )} on ${promisedDateObject.toLocaleDateString(
            "en-IN"
          )}.`,

        explanation:
          "Customer payment commitment captured during conversational recovery."
      });


    await saveAuditLogs([
      auditLog
    ]);
  }


  return promiseData;
}

// ======================================================
// UPDATE PROMISE STATUS
// ======================================================

async function updatePromiseStatus(
  paymentId,
  promiseStatus
) {

  const allowedStatuses =
    Object.values(
      PROMISE_STATUSES
    );


  if (
    !allowedStatuses.includes(
      promiseStatus
    )
  ) {

    throw new Error(
      `Invalid promise status: ${promiseStatus}`
    );
  }


  const db =
    getDB();


  const existingState =
    await getRecoveryState(
      paymentId
    );


  if (!existingState) {

    return null;
  }


    if (!existingState.promise) {

    return null;
  }


  // ====================================================
  // IDEMPOTENT STATUS UPDATE
  // ====================================================

  /*
    If the promise already has the requested status,
    there is nothing to change.

    Previously this still updated "updatedAt" and
    generated another audit event.

    Example:

      KEPT → KEPT → KEPT

    could produce several PROMISE_KEPT entries even
    though only one lifecycle transition happened.
  */

  if (
    existingState
      .promise
      .promiseStatus ===
    promiseStatus
  ) {

    return existingState;
  }


  // ====================================================
// VALID PROMISE STATE TRANSITIONS
// ====================================================

const currentPromiseStatus =
  existingState
    .promise
    .promiseStatus;


const allowedTransitions = {

  [PROMISE_STATUSES.ACTIVE]: [

    PROMISE_STATUSES.DUE,

    PROMISE_STATUSES.CANCELLED,

    PROMISE_STATUSES.KEPT
  ],


  [PROMISE_STATUSES.DUE]: [

    PROMISE_STATUSES.KEPT,

    PROMISE_STATUSES.BROKEN,

    PROMISE_STATUSES.CANCELLED
  ],


  [PROMISE_STATUSES.BROKEN]: [

    PROMISE_STATUSES.ACTIVE
  ],


  [PROMISE_STATUSES.KEPT]: [],


  [PROMISE_STATUSES.CANCELLED]: [

    PROMISE_STATUSES.ACTIVE
  ]
};


const allowedNextStatuses =
  allowedTransitions[
    currentPromiseStatus
  ] || [];


if (
  !allowedNextStatuses.includes(
    promiseStatus
  )
) {

  throw new Error(
    `Invalid Promise-to-Pay transition: ${currentPromiseStatus} -> ${promiseStatus}`
  );
}


  const now =
    new Date();


  const updateData = {

    "promise.promiseStatus":
      promiseStatus,

    "promise.updatedAt":
      now
  };


  // ====================================================
  // PROMISE KEPT
  // ====================================================

  if (
    promiseStatus ===
    PROMISE_STATUSES.KEPT
  ) {

    updateData.outcome =
      "RECOVERED";

    updateData.recoveryAction =
      "PROMISE_KEPT";

    updateData.explanation =
      "The customer fulfilled the Promise-to-Pay commitment.";

    updateData.recoveredAt =
      now;
  }


  // ====================================================
  // PROMISE BROKEN
  // ====================================================

  else if (
    promiseStatus ===
    PROMISE_STATUSES.BROKEN
  ) {

    updateData.outcome =
      "AWAITING_CONVERSATION";

    updateData.recoveryAction =
      "START_CONVERSATIONAL_RECOVERY";

    updateData.explanation =
      "The Promise-to-Pay was not fulfilled. RecoverAI is re-engaging the customer through conversational recovery.";

    updateData["promise.brokenAt"] =
      now;
  }


  // ====================================================
  // PROMISE CANCELLED
  // ====================================================

  else if (
    promiseStatus ===
    PROMISE_STATUSES.CANCELLED
  ) {

    updateData.outcome =
      "RECOVERY_FAILED";

    updateData.recoveryAction =
      "PROMISE_CANCELLED";

    updateData.explanation =
      "The Promise-to-Pay was cancelled and may return to the recovery router.";

    updateData["promise.cancelledAt"] =
      now;
  }


  // ====================================================
  // PROMISE ACTIVE
  // ====================================================

  else if (
    promiseStatus ===
    PROMISE_STATUSES.ACTIVE
  ) {

    updateData.outcome =
      "PROMISE_TO_PAY";

    updateData.recoveryAction =
      "CREATE_PROMISE_TO_PAY";
  }


  // ====================================================
  // PROMISE DUE
  // ====================================================

  else if (
    promiseStatus ===
    PROMISE_STATUSES.DUE
  ) {

    updateData.outcome =
      "PROMISE_TO_PAY";

    updateData.recoveryAction =
      "CREATE_PROMISE_TO_PAY";

    updateData["promise.dueAt"] =
      existingState.promise?.dueAt || now;
  }


  const result =
  await db
    .collection(
      "recoveryStates"
    )
    .updateOne(

      {
        paymentId,

        /*
          Optimistic concurrency guard.

          Only apply this transition if the promise
          still has the status that we originally read.

          This prevents two simultaneous lifecycle
          actions from overwriting each other.
        */

        "promise.promiseStatus":
          currentPromiseStatus
      },

      {
        $set:
          updateData
      }
    );


  /*
    Return the updated document rather than only
    MongoDB's update acknowledgement.

    This makes the API response more useful for
    the frontend and future orchestration logic.
  */

  if (
  result.matchedCount === 0
) {

  /*
    The payment still exists, but its promise status
    changed between our read and our update.

    Another request won the race.

    Return the latest state rather than overwriting it
    or producing an incorrect audit event.
  */

  return await getRecoveryState(
    paymentId
  );
}


const updatedState =
  await getRecoveryState(
    paymentId
  );


if (
  result.modifiedCount >
  0
) {

  const statusEventMap = {

    ACTIVE:
      "PROMISE_REACTIVATED",

    DUE:
      "PROMISE_BECAME_DUE",

    KEPT:
      "PROMISE_KEPT",

    BROKEN:
      "PROMISE_BROKEN",

    CANCELLED:
      "PROMISE_CANCELLED"
  };


  const statusMessageMap = {

    ACTIVE:
      "Promise-to-Pay was marked active.",

    DUE:
      "Promise-to-Pay reached its due date.",

    KEPT:
      "Customer fulfilled the Promise-to-Pay commitment.",

    BROKEN:
      "Promise-to-Pay was not fulfilled and conversational recovery was reopened.",

    CANCELLED:
      "Promise-to-Pay was cancelled."
  };


  const auditLog =
    createStateTransitionAuditLog({

      payment: {

        paymentId:
          updatedState.paymentId,

        customerId:
          updatedState.customerId,

        amount:
          updatedState.promise
            ?.promisedAmount || 0
      },

      previousState:
        existingState,

      nextState:
        updatedState,

      event:
        statusEventMap[
          promiseStatus
        ] ||
        "PROMISE_STATUS_CHANGED",

      actionType:
        "PROMISE_LIFECYCLE",

      actionMessage:
        statusMessageMap[
          promiseStatus
        ] ||
        `Promise status changed to ${promiseStatus}.`,

      explanation:
        updatedState.explanation ||
        `Promise status changed to ${promiseStatus}.`,

      metadata: {

        previousPromiseStatus:
          existingState.promise
            ?.promiseStatus ||
          null,

        promiseStatus
      }
    });


  await saveAuditLogs([
    auditLog
  ]);
}


return updatedState;
}


// ======================================================
// GET ACTIVE PROMISES
// ======================================================

async function getActivePromises() {

  const db =
    getDB();


  return await db
    .collection(
      "recoveryStates"
    )
    .find({

      outcome:
        "PROMISE_TO_PAY",

      "promise.promiseStatus":
        PROMISE_STATUSES.ACTIVE
    })
    .toArray();
}


// ======================================================
// GET ALL PROMISES
// ======================================================

async function getPromises() {

  const db =
    getDB();


  return await db
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
}


// ======================================================
// RAZORPAY PAYMENT CONFIRMED
// ======================================================

async function markRecoveryAsPaid(
  paymentLinkId,
  razorpayPaymentId
) {

  const db =
    getDB();


  const collection =
    db.collection(
      "recoveryStates"
    );


  const existingState =
    await collection.findOne({
      paymentLinkId
    });


  if (!existingState) {

    return null;
  }


  if (
    existingState.outcome ===
    "RECOVERED"
  ) {

    return existingState;
  }


  const recoveredAt =
    new Date();


  const updateResult =
    await collection.updateOne(

      {
        paymentLinkId,

        outcome: {
          $ne:
            "RECOVERED"
        }
      },

      {
        $set: {

          outcome:
            "RECOVERED",

          paymentLinkStatus:
            "paid",

          razorpayPaymentId,

          recoveredAt
        }
      }
    );


  if (
    updateResult.modifiedCount >
    0
  ) {

    const webhookLog =
      createWebhookAuditLog(
        existingState,
        razorpayPaymentId
      );


    webhookLog.previousOutcome =
      existingState.outcome ||
      null;


    webhookLog.previousRecoveryAction =
      existingState.recoveryAction ||
      null;


    await saveAuditLogs([
      webhookLog
    ]);
  }


  return await collection.findOne({
    paymentLinkId
  });
}


// ======================================================
// GET ALL RECOVERY STATES
// ======================================================

async function getRecoveryStates() {

  const db =
    getDB();


  return await db
    .collection(
      "recoveryStates"
    )
    .find({})
    .toArray();
}




async function createCallbackRequest(
  payment,
  analysis = {}
) {

  const db =
    getDB();

    const existingState =
  await getRecoveryState(
    payment.paymentId
  );

  const callbackData = {

    requestedAt:
      new Date(),

    status:
      "REQUESTED",

    customerMessage:
      analysis.customerMessage || "",

    language:
      analysis.language || null,

    confidence:
      analysis.confidence ?? null,

    intent:
      analysis.intent || "CALLBACK_REQUEST"
  };


  const processedAt =
  new Date();


const nextState = {

  paymentId:
    payment.paymentId,

  customerId:
    payment.customerId,

  recoveryAction:
    "SCHEDULE_CALLBACK",

  outcome:
    "CALLBACK_REQUESTED",

  callback:
    callbackData,

  processedAt
};


const updateResult =
  await db
    .collection(
      "recoveryStates"
    )
    .updateOne(
      {
        paymentId:
          payment.paymentId
      },
      {
        $set:
          nextState
      },
      {
        upsert: true
      }
    );


if (
  updateResult.acknowledged
) {

  const auditLog =
    createStateTransitionAuditLog({

      payment,

      previousState:
        existingState,

      nextState,

      event:
        "CALLBACK_REQUESTED",

      actionType:
        "CONVERSATIONAL_RECOVERY",

      actionMessage:
        "Customer callback request was recorded.",

      explanation:
        "Customer requested a callback during conversational recovery.",

      metadata: {

        language:
          callbackData.language,

        confidence:
          callbackData.confidence,

        intent:
          callbackData.intent
      }
    });


  await saveAuditLogs([
    auditLog
  ]);
}


return callbackData;
}



// ======================================================
// RECOVERY EXECUTION LOCK
// ======================================================

const RECOVERY_LOCK_TIMEOUT_MS =
  5 * 60 * 1000;


// ======================================================
// ACQUIRE RECOVERY EXECUTION LOCK
// ======================================================

async function acquireRecoveryExecutionLock(
  paymentId
) {

  if (!paymentId) {

    throw new Error(
      "Payment ID is required to acquire a recovery lock."
    );
  }


  const db =
    getDB();


  const collection =
    db.collection(
      "recoveryExecutionLocks"
    );


  const now =
    new Date();


  /*
    If a previous Node process crashed while holding
    a lock, that lock could otherwise remain forever.

    A lock older than five minutes is considered stale.
  */

  const staleBefore =
    new Date(
      now.getTime() -
      RECOVERY_LOCK_TIMEOUT_MS
    );


  await collection.deleteOne({

    _id:
      paymentId,

    createdAt: {
      $lt:
        staleBefore
    }
  });


  try {

    /*
      MongoDB's _id field is unique automatically.

      Therefore two simultaneous requests attempting
      to lock the same payment cannot both succeed.
    */

    await collection.insertOne({

      _id:
        paymentId,

      createdAt:
        now
    });


    return true;

  } catch (error) {

    /*
      MongoDB duplicate-key error.

      Another request currently owns this payment's
      recovery execution lock.
    */

    if (
      error?.code ===
      11000
    ) {

      return false;
    }


    throw error;
  }
}


// ======================================================
// RELEASE RECOVERY EXECUTION LOCK
// ======================================================

async function releaseRecoveryExecutionLock(
  paymentId
) {

  if (!paymentId) {

    return;
  }


  const db =
    getDB();


  await db
    .collection(
      "recoveryExecutionLocks"
    )
    .deleteOne({

      _id:
        paymentId
    });
}




// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  PROMISE_STATUSES,

  getRecoveryState,

  getRecoveryStateByPaymentLinkId,

  getRecoveryGuardrail,

  canProcessRecovery,

  markAsProcessed,

  createPromiseToPay,

  updatePromiseStatus,

  getActivePromises,

  getPromises,

  markRecoveryAsPaid,

  getRecoveryStates,

  createCallbackRequest,

  acquireRecoveryExecutionLock,

  releaseRecoveryExecutionLock
};