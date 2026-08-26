const {
  getDB,
} = require("../db");


// ======================================================
// RECOVERY GUARDRAIL CONFIGURATION
// ======================================================

const MAX_AUTONOMOUS_RECOVERY_ATTEMPTS = 2;

const MAX_TOTAL_RECOVERY_ATTEMPTS = 3;


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

  /*
    A case should normally be escalated after
    two failed autonomous recovery attempts.

    This hard-stop condition protects older,
    manually modified, or unexpected states
    that somehow reach three recovery attempts.
  */

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

  /*
    RecoverAI allows at most two failed
    autonomous interventions.

    After two failed interventions:

      RECOVERY_FAILED
            ↓
      HUMAN_REVIEW

    Escalation itself does NOT count as
    another recovery attempt.
  */

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

    HUMAN_REVIEW and STOP_RECOVERY are
    decisions / guardrail outcomes, not
    recovery interventions, so they must
    not increase the counter.
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
  explanation = ""
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

    // Persist the explanation generated
    // during this recovery decision.
    explanation,

    /*
      Increment only when RecoverAI actually
      executes an autonomous intervention.

      Examples that count:
        RETRY
        REMIND_LATER
        SEND_REMINDER
        SEND_ALTERNATIVE_PAYMENT_METHOD
        OFFER_LOYALTY_INCENTIVE

      Examples that do not count:
        HUMAN_REVIEW
        STOP_RECOVERY
    */

    recoveryAttempts:
      previousAttempts +
      attemptIncrement,

    processedAt:
      new Date()
  };


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


  return await db
    .collection(
      "recoveryStates"
    )
    .updateOne(

      {
        paymentLinkId
      },

      {
        $set: {

          outcome:
            "RECOVERED",

          paymentLinkStatus:
            "paid",

          razorpayPaymentId,

          recoveredAt:
            new Date()
        }
      }
    );
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


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  getRecoveryState,

  getRecoveryStateByPaymentLinkId,

  getRecoveryGuardrail,

  canProcessRecovery,

  markAsProcessed,

  markRecoveryAsPaid,

  getRecoveryStates
};