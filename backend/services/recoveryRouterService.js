// ======================================================
// RECOVERY CHANNELS
// ======================================================

const RECOVERY_CHANNELS = {

  PAYMENT_RECOVERY:
    "PAYMENT_RECOVERY",

  CONVERSATIONAL_RECOVERY:
    "CONVERSATIONAL_RECOVERY",

  HUMAN_REVIEW:
    "HUMAN_REVIEW",

  STOP_RECOVERY:
    "STOP_RECOVERY"
};


// ======================================================
// ROUTING REASONS
// ======================================================

const ROUTING_REASONS = {

  PAYMENT_SUCCESSFUL:
    "Payment is already successful and does not require recovery.",

  TEMPORARY_FAILURE:
    "Temporary payment failure can be handled through direct payment recovery.",

  CHECKOUT_ABANDONED:
    "Checkout abandonment can be handled using a direct recovery intervention.",

  RETURNING_CHECKOUT_ABANDONED:
    "Returning customer abandoned checkout; direct recovery or a loyalty intervention is appropriate.",

  ISSUER_DECLINED:
    "Issuer-declined payments may be recovered using an alternative payment method.",

  BANK_RESTRICTION:
    "A bank restriction may be recoverable through an alternative payment method.",

  INSUFFICIENT_FUNDS:
    "Insufficient funds may benefit from a conversational recovery flow to understand when the customer can pay.",

  REPEATED_FAILURE:
    "Repeated recoverable payment failures may require customer context before another intervention.",

  MAX_ATTEMPTS:
    "Maximum payment attempts have already been reached.",

  UNKNOWN_FAILURE:
    "The failure does not have a deterministic recovery-channel rule.",

  LOW_CONFIDENCE:
    "The routing decision does not meet the autonomous confidence threshold."
};


// ======================================================
// ROUTE RECOVERY CASE
// ======================================================

function routeRecoveryCase(
  payment
) {

  if (!payment) {

    throw new Error(
      "Payment is required for recovery routing."
    );
  }


  const {

    failureReason,

    attemptCount = 0,

    status,

    customerType

  } = payment;


  // ====================================================
  // SUCCESSFUL PAYMENT
  // ====================================================

  /*
    Successful payments never enter recovery.

    This is a deterministic hard stop and Gemini
    is never involved.
  */

  if (
    status ===
    "success"
  ) {

    return {

      channel:
        RECOVERY_CHANNELS.STOP_RECOVERY,

      confidence:
        1,

      source:
        "RULE",

      reason:
        ROUTING_REASONS.PAYMENT_SUCCESSFUL
    };
  }


  // ====================================================
  // MAXIMUM PAYMENT ATTEMPTS
  // ====================================================

  /*
    Permanent stopping decisions remain deterministic.

    The AI router is intentionally not allowed to make
    STOP_RECOVERY decisions.
  */

  if (
    attemptCount >= 3
  ) {

    return {

      channel:
        RECOVERY_CHANNELS.STOP_RECOVERY,

      confidence:
        1,

      source:
        "RULE",

      reason:
        ROUTING_REASONS.MAX_ATTEMPTS
    };
  }


  // ====================================================
  // TEMPORARY PAYMENT FAILURE
  // ====================================================

  if (
    failureReason ===
    "timeout"
  ) {

    return {

      channel:
        RECOVERY_CHANNELS.PAYMENT_RECOVERY,

      confidence:
        1,

      source:
        "RULE",

      reason:
        ROUTING_REASONS.TEMPORARY_FAILURE
    };
  }


  // ====================================================
  // CHECKOUT ABANDONMENT
  // ====================================================

  if (
    failureReason ===
    "checkout_abandoned"
  ) {

    return {

      channel:
        RECOVERY_CHANNELS.PAYMENT_RECOVERY,

      confidence:
        1,

      source:
        "RULE",

      reason:

        customerType ===
        "returning"

          ? ROUTING_REASONS
              .RETURNING_CHECKOUT_ABANDONED

          : ROUTING_REASONS
              .CHECKOUT_ABANDONED
    };
  }


  // ====================================================
  // INSUFFICIENT FUNDS
  // ====================================================

  /*
    Insufficient funds benefits from customer context.

    Instead of immediately trying another payment,
    RecoverAI starts a conversation.

    That conversation may later result in:

    - Promise-to-Pay
    - payment now
    - alternative payment method
    - human review
  */

  if (
    failureReason ===
    "insufficient_funds"
  ) {

    return {

      channel:
        RECOVERY_CHANNELS
          .CONVERSATIONAL_RECOVERY,

      confidence:
        1,

      source:
        "RULE",

      reason:
        ROUTING_REASONS
          .INSUFFICIENT_FUNDS
    };
  }


  // ====================================================
  // ISSUER DECLINED
  // ====================================================

  if (
    failureReason ===
    "issuer_declined"
  ) {

    return {

      channel:
        RECOVERY_CHANNELS
          .PAYMENT_RECOVERY,

      confidence:
        0.9,

      source:
        "RULE",

      reason:
        ROUTING_REASONS
          .ISSUER_DECLINED
    };
  }


  // ====================================================
  // BANK RESTRICTION
  // ====================================================

  if (
    failureReason ===
    "bank_restriction"
  ) {

    return {

      channel:
        RECOVERY_CHANNELS
          .PAYMENT_RECOVERY,

      confidence:
        0.9,

      source:
        "RULE",

      reason:
        ROUTING_REASONS
          .BANK_RESTRICTION
    };
  }


  // ====================================================
  // REPEATED BUT STILL RECOVERABLE FAILURE
  // ====================================================

  /*
    This rule is evaluated only after known
    failure-specific rules.

    For example:

    timeout + attemptCount 2
    still uses PAYMENT_RECOVERY.

    An unknown failure with attemptCount 2
    uses CONVERSATIONAL_RECOVERY.

    This preserves the more specific rule first.
  */

  if (
    attemptCount === 2
  ) {

    return {

      channel:
        RECOVERY_CHANNELS
          .CONVERSATIONAL_RECOVERY,

      confidence:
        0.85,

      source:
        "RULE",

      reason:
        ROUTING_REASONS
          .REPEATED_FAILURE
    };
  }


  // ====================================================
  // UNKNOWN / AMBIGUOUS FAILURE
  // ====================================================

  /*
    No deterministic rule confidently explains
    which recovery channel should be used.

    Do not guess here.

    The orchestrator will recognize AI_REQUIRED
    and invoke the bounded AI routing layer.

    Gemini may select only:

    PAYMENT_RECOVERY
    CONVERSATIONAL_RECOVERY
    HUMAN_REVIEW

    Gemini cannot select STOP_RECOVERY.
  */

  return {

    channel:
      null,

    confidence:
      0,

    source:
      "AI_REQUIRED",

    reason:
      ROUTING_REASONS
        .UNKNOWN_FAILURE
  };
}


// ======================================================
// CHECK WHETHER ROUTING NEEDS AI
// ======================================================

function requiresAIRouting(
  routingDecision
) {

  return (

    routingDecision
      ?.source ===
    "AI_REQUIRED"

  );
}


// ======================================================
// CHECK AUTONOMOUS ROUTING CONFIDENCE
// ======================================================

function isRoutingConfidenceSufficient(

  confidence,

  threshold = 0.75

) {

  const normalizedConfidence =
    Number(
      confidence
    );


  if (
    !Number.isFinite(
      normalizedConfidence
    )
  ) {

    return false;
  }


  return (

    normalizedConfidence >=
    threshold

  );
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  RECOVERY_CHANNELS,

  ROUTING_REASONS,

  routeRecoveryCase,

  requiresAIRouting,

  isRoutingConfidenceSufficient
};