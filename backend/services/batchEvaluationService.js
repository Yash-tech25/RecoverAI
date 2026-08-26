const {
  decideRecoveryAction,
  explainRecoveryAction,
} = require("./recoveryEngine");

const {
  calculateBatchEvaluationMetrics,
} = require("./recoveryAnalytics");


// ======================================================
// SYNTHETIC SUCCESS ASSUMPTIONS
// ======================================================

/*
  IMPORTANT:

  These probabilities are used ONLY for synthetic
  offline evaluation.

  They do NOT represent real merchant performance
  and are NOT used by the live recovery agent.

  The evaluator is deterministic so the same dataset
  always produces the same result.
*/

const SIMULATED_SUCCESS_PROBABILITY = {

  RETRY:
    0.55,

  REMIND_LATER:
    0.35,

  SEND_REMINDER:
    0.45,

  OFFER_LOYALTY_INCENTIVE:
    0.55,

  SEND_ALTERNATIVE_PAYMENT_METHOD:
    0.50
};


// ======================================================
// SAFE AI EVALUATION FIXTURE
// ======================================================

/*
  In the live agent, REVIEW cases are sent to Gemini.

  During batch evaluation we deliberately DO NOT call
  Gemini because evaluating 50+ records should not burn
  API quota.

  Instead we use deterministic representative routing.

  This is clearly labelled as an evaluation fixture,
  never as a real Gemini decision.
*/

function getSafeAIEvaluationDecision(
  payment
) {

  if (
    payment.failureReason ===
      "bank_restriction"

    ||

    payment.failureReason ===
      "issuer_declined"
  ) {

    return {

      action:
        "SEND_ALTERNATIVE_PAYMENT_METHOD",

      explanation:
        "Offline evaluation fixture routed this uncertain payment failure to an alternative payment method.",

      confidence:
        0.85
    };
  }


  return {

    action:
      "HUMAN_REVIEW",

    explanation:
      "Offline evaluation fixture could not safely determine an autonomous recovery action, so the case was escalated for human review.",

    confidence:
      0.50
  };
}


// ======================================================
// DETERMINISTIC SCORE
// ======================================================

/*
  Produces a number from 0 to <1 based on the
  payment ID and recovery action.

  Unlike Math.random(), results stay identical
  across repeated evaluations.
*/

function deterministicScore(
  paymentId,
  action
) {

  const input =
    `${paymentId}:${action}`;


  let hash = 0;


  for (
    let index = 0;
    index < input.length;
    index++
  ) {

    hash =
      (
        hash * 31 +
        input.charCodeAt(index)
      ) %
      10000;
  }


  return hash / 10000;
}


// ======================================================
// SIMULATE SAFE OFFLINE OUTCOME
// ======================================================

function evaluateOutcome(
  payment,
  action
) {

  // ----------------------------------------------------
  // NO RECOVERY REQUIRED
  // ----------------------------------------------------

  if (
    action ===
    "NO_ACTION"
  ) {

    return {

      outcome:
        "NOT_REQUIRED",

      recovered:
        false,

      recoveredAmount:
        0
    };
  }


  // ----------------------------------------------------
  // STOPPED
  // ----------------------------------------------------

  if (
    action ===
    "STOP_RECOVERY"
  ) {

    return {

      outcome:
        "STOPPED",

      recovered:
        false,

      recoveredAmount:
        0
    };
  }


  // ----------------------------------------------------
  // HUMAN REVIEW
  // ----------------------------------------------------

  if (
    action ===
    "HUMAN_REVIEW"
  ) {

    return {

      outcome:
        "HUMAN_REVIEW",

      recovered:
        false,

      recoveredAmount:
        0
    };
  }


  // ----------------------------------------------------
  // SYNTHETIC RECOVERY
  // ----------------------------------------------------

  const successProbability =
    SIMULATED_SUCCESS_PROBABILITY[
      action
    ] || 0;


  const score =
    deterministicScore(
      payment.paymentId,
      action
    );


  const recovered =
    score <
    successProbability;


  return {

    outcome:
      recovered
        ? "RECOVERED"
        : "RECOVERY_FAILED",

    recovered,

    recoveredAmount:
      recovered
        ? payment.amount
        : 0,

    simulationProbability:
      successProbability,

    deterministicScore:
      Number(
        score.toFixed(4)
      )
  };
}


// ======================================================
// EVALUATE ONE PAYMENT
// ======================================================

function evaluatePaymentSafely(
  payment
) {

  let recoveryAction =
    decideRecoveryAction(
      payment
    );


  let explanation =
    explainRecoveryAction(
      payment
    );


  let decisionSource =
    "RULE_ENGINE";


  let evaluationConfidence =
    null;


  // ====================================================
  // SAFE OFFLINE AI SUBSTITUTE
  // ====================================================

  if (
    recoveryAction ===
    "REVIEW"
  ) {

    const aiFixture =
      getSafeAIEvaluationDecision(
        payment
      );


    recoveryAction =
      aiFixture.action;


    explanation =
      aiFixture.explanation;


    evaluationConfidence =
      aiFixture.confidence;


    decisionSource =
      "AI_EVALUATION_FIXTURE";
  }


  // ====================================================
  // SIMULATED OUTCOME
  // ====================================================

  const result =
    evaluateOutcome(
      payment,
      recoveryAction
    );


  return {

    paymentId:
      payment.paymentId,

    customerId:
      payment.customerId,

    customerType:
      payment.customerType,

    amount:
      payment.amount,

    status:
      payment.status,

    method:
      payment.method,

    failureReason:
      payment.failureReason,

    attemptCount:
      payment.attemptCount,

    recoveryAction,

    explanation,

    decisionSource,

    evaluationConfidence,

    ...result
  };
}


// ======================================================
// EVALUATE COMPLETE PAYMENT BATCH
// ======================================================

function evaluateRecoveryBatch(
  payments
) {

  const evaluatedCases =
    payments.map(
      (payment) =>
        evaluatePaymentSafely(
          payment
        )
    );


  const metrics =
    calculateBatchEvaluationMetrics(
      evaluatedCases
    );


  return {

    evaluationMode:
      "SAFE_SYNTHETIC_BATCH",

    sideEffects: {

      geminiCalls:
        0,

      razorpayLinksCreated:
        0,

      databaseStatesModified:
        0
    },


    disclaimer:
      "Batch results are deterministic synthetic evaluation results. They are separate from real Razorpay Test Mode recovery evidence.",


    metrics,


    cases:
      evaluatedCases
  };
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  evaluatePaymentSafely,

  evaluateRecoveryBatch
};