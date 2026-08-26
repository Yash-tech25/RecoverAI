const {
  decideRecoveryAction,
  explainRecoveryAction,
} = require("./recoveryEngine");

const {
  getAIRecommendation,
} = require("./aiRecoveryService");

const {
  validateRecoveryAction,
} = require("./policyEngine");

const {
  executeRecoveryAction,
} = require("./actionExecutor");

const {
  simulateRecoveryOutcome,
} = require("./recoverySimulator");

const {
  getRecoveryGuardrail,
} = require("./recoveryStateService");


// ======================================================
// AI CONFIDENCE THRESHOLD
// ======================================================

const AI_CONFIDENCE_THRESHOLD = 0.75;


// ======================================================
// PROCESS ONE RECOVERY CASE
// ======================================================

async function processSingleRecovery(
  payment
) {

  // ====================================================
  // BASE RULE DECISION
  // ====================================================

  let recoveryAction =
    decideRecoveryAction(
      payment
    );


  let explanation =
    explainRecoveryAction(
      payment
    );


  // ====================================================
  // RECOVERY ATTEMPT GUARDRAIL
  // ====================================================

  const recoveryGuardrail =
    await getRecoveryGuardrail(
      payment.paymentId
    );


  /*
    Original payment stopping rules take priority.

    For example:

    attemptCount >= 3
        ↓
    recoveryEngine already returns STOP_RECOVERY

    We should never replace that with HUMAN_REVIEW.
  */

  if (
    recoveryAction !==
    "STOP_RECOVERY"

    &&

    recoveryGuardrail
      .forcedAction
  ) {

    recoveryAction =
      recoveryGuardrail
        .forcedAction;


    if (
      recoveryAction ===
      "HUMAN_REVIEW"
    ) {

      explanation =
        `RecoverAI has already made ${recoveryGuardrail.recoveryAttempts} autonomous recovery attempts for this case. ` +
        `The previous attempts did not recover the payment. ` +
        `To prevent repeated automated intervention, the case has been escalated for human review.`;
    }


    if (
      recoveryAction ===
      "STOP_RECOVERY"
    ) {

      explanation =
        `The case has reached the maximum allowed recovery attempts. ` +
        `RecoverAI stopped further autonomous recovery activity.`;
    }
  }


  // ====================================================
  // AI ANALYSIS FOR UNCERTAIN CASES
  // ====================================================

  /*
    Gemini runs only when:

    1. deterministic rules returned REVIEW
    2. recovery-attempt guardrails did not already
       escalate or stop the case
  */

  if (
    recoveryAction ===
    "REVIEW"
  ) {

    const aiRecommendation =
      await getAIRecommendation(
        payment
      );


    const confidence =
      Number(
        aiRecommendation
          .confidence
      ) || 0;


    if (
      aiRecommendation
        .recommendedAction ===
        "REVIEW"

      ||

      confidence <
        AI_CONFIDENCE_THRESHOLD
    ) {

      recoveryAction =
        "HUMAN_REVIEW";


      explanation =
        `AI diagnosis: ${aiRecommendation.diagnosis} ` +
        `Reasoning: ${aiRecommendation.reasoning} ` +
        `Confidence: ${confidence}. ` +
        `The confidence did not meet the autonomous execution threshold of ${AI_CONFIDENCE_THRESHOLD}, so the case was escalated for human review.`;

    } else {

      recoveryAction =
        aiRecommendation
          .recommendedAction;


      explanation =
        `AI diagnosis: ${aiRecommendation.diagnosis} ` +
        `Reasoning: ${aiRecommendation.reasoning} ` +
        `Confidence: ${confidence}. ` +
        `The recommendation passed the autonomous execution confidence threshold.`;
    }
  }


  // ====================================================
  // POLICY VALIDATION
  // ====================================================

  const policyResult =
    validateRecoveryAction(
      payment,
      recoveryAction
    );


  if (
    !policyResult.allowed
  ) {

    return {

      recoveryAction,

      explanation,

      executionResult: {

        actionExecuted:
          false,

        actionType:
          "POLICY_BLOCKED",

        message:
          policyResult.reason
      },

      recoveryResult: {

        outcome:
          "POLICY_BLOCKED",

        recovered:
          false,

        recoveredAmount:
          0
      }
    };
  }


  // ====================================================
  // EXECUTION
  // ====================================================

  const executionResult =
    await executeRecoveryAction(
      payment,
      recoveryAction
    );


  // ====================================================
  // OUTCOME
  // ====================================================

  const recoveryResult =
    simulateRecoveryOutcome(
      payment,
      recoveryAction
    );


  return {

    recoveryAction,

    explanation,

    executionResult,

    recoveryResult
  };
}


module.exports = {
  processSingleRecovery
};