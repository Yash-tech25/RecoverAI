const {

  routeRecoveryCase,

  RECOVERY_CHANNELS,

  requiresAIRouting,

  isRoutingConfidenceSufficient

} = require(
  "./recoveryRouterService"
);


const {

  processSingleRecovery

} = require(
  "./singleRecoveryService"
);


const {

  routeRecoveryWithAI

} = require(
  "./aiRecoveryRouterService"
);


// ======================================================
// ROUTING CONFIGURATION
// ======================================================

const AI_ROUTING_CONFIDENCE_THRESHOLD =
  0.75;


// ======================================================
// BUILD HUMAN REVIEW RESULT
// ======================================================

function buildHumanReviewResult({

  routingDecision,

  explanation,

  message

}) {

  return {

    channel:
      RECOVERY_CHANNELS
        .HUMAN_REVIEW,

    routingDecision,

    recoveryAction:
      "HUMAN_REVIEW",

    explanation,

    executionResult: {

      actionExecuted:
        false,

      actionType:
        "HUMAN_REVIEW",

      message
    },

    recoveryResult: {

      outcome:
        "HUMAN_REVIEW",

      recovered:
        false,

      recoveredAmount:
        0
    }
  };
}


// ======================================================
// BUILD CONVERSATIONAL RECOVERY RESULT
// ======================================================

function buildConversationalResult({

  routingDecision,

  explanation,

  message

}) {

  return {

    channel:
      RECOVERY_CHANNELS
        .CONVERSATIONAL_RECOVERY,

    routingDecision,

    recoveryAction:
      "START_CONVERSATIONAL_RECOVERY",

    explanation,

    executionResult: {

      actionExecuted:
        false,

      actionType:
        "CONVERSATIONAL_RECOVERY_REQUIRED",

      message
    },

    recoveryResult: {

      outcome:
        "AWAITING_CONVERSATION",

      recovered:
        false,

      recoveredAmount:
        0
    }
  };
}


// ======================================================
// BUILD STOP RECOVERY RESULT
// ======================================================

function buildStopRecoveryResult(
  routingDecision
) {

  return {

    channel:
      RECOVERY_CHANNELS
        .STOP_RECOVERY,

    routingDecision,

    recoveryAction:
      "STOP_RECOVERY",

    explanation:
      routingDecision.reason,

    executionResult: {

      actionExecuted:
        false,

      actionType:
        "STOP_RECOVERY",

      message:
        routingDecision.reason
    },

    recoveryResult: {

      outcome:
        "STOPPED",

      recovered:
        false,

      recoveredAmount:
        0
    }
  };
}


// ======================================================
// PROCESS RECOVERY THROUGH CHANNEL ROUTER
// ======================================================

async function orchestrateRecovery(
  payment
) {

  if (!payment) {

    throw new Error(
      "Payment is required for recovery orchestration."
    );
  }


  // ====================================================
  // STEP 1 — DETERMINISTIC CHANNEL ROUTING
  // ====================================================

  /*
    Rules are always evaluated before Gemini.

    Gemini is invoked only if this decision returns
    source = AI_REQUIRED.
  */

  const routingDecision =
    routeRecoveryCase(
      payment
    );


  // ====================================================
  // STEP 2 — DETERMINISTIC STOP
  // ====================================================

  if (
    routingDecision.channel ===
    RECOVERY_CHANNELS
      .STOP_RECOVERY
  ) {

    return buildStopRecoveryResult(
      routingDecision
    );
  }


  // ====================================================
  // STEP 3 — DETERMINISTIC CONVERSATIONAL RECOVERY
  // ====================================================

  if (
    routingDecision.channel ===
    RECOVERY_CHANNELS
      .CONVERSATIONAL_RECOVERY
  ) {

    return buildConversationalResult({

      routingDecision,

      explanation:
        routingDecision.reason,

      message:
        "RecoverAI selected conversational recovery. Customer interaction is required before the next recovery action."
    });
  }


  // ====================================================
  // STEP 4 — DETERMINISTIC PAYMENT RECOVERY
  // ====================================================

  if (
    routingDecision.channel ===
    RECOVERY_CHANNELS
      .PAYMENT_RECOVERY
  ) {

    const result =
      await processSingleRecovery(
        payment
      );


    return {

      channel:
        RECOVERY_CHANNELS
          .PAYMENT_RECOVERY,

      routingDecision,

      ...result
    };
  }


  // ====================================================
  // STEP 5 — CHECK WHETHER AI ROUTING IS REQUIRED
  // ====================================================

  if (
    requiresAIRouting(
      routingDecision
    )
  ) {

    const aiRoutingDecision =
      await routeRecoveryWithAI(
        payment
      );


    // ==================================================
    // STEP 5A — AI CONFIDENCE GUARDRAIL
    // ==================================================

    /*
      Even if Gemini selects a valid channel,
      RecoverAI will not act autonomously when
      confidence is below the threshold.

      This also safely catches AI/API fallback results
      because those return confidence 0.
    */

    if (
      !isRoutingConfidenceSufficient(

        aiRoutingDecision
          .confidence,

        AI_ROUTING_CONFIDENCE_THRESHOLD
      )
    ) {

      return buildHumanReviewResult({

        routingDecision:
          aiRoutingDecision,

        explanation:
          `AI recovery-channel routing confidence (${aiRoutingDecision.confidence}) was below the autonomous routing threshold (${AI_ROUTING_CONFIDENCE_THRESHOLD}). ${aiRoutingDecision.reason}`,

        message:
          "AI recovery-channel confidence was insufficient for autonomous routing."
      });
    }


    // ==================================================
    // STEP 5B — AI SELECTED HUMAN REVIEW
    // ==================================================

    if (
      aiRoutingDecision.channel ===
      RECOVERY_CHANNELS
        .HUMAN_REVIEW
    ) {

      return buildHumanReviewResult({

        routingDecision:
          aiRoutingDecision,

        explanation:
          `AI recovery-channel routing selected human review. ${aiRoutingDecision.reason}`,

        message:
          "AI determined that the ambiguous recovery case requires human review."
      });
    }


    // ==================================================
    // STEP 5C — AI SELECTED CONVERSATIONAL RECOVERY
    // ==================================================

    if (
      aiRoutingDecision.channel ===
      RECOVERY_CHANNELS
        .CONVERSATIONAL_RECOVERY
    ) {

      return buildConversationalResult({

        routingDecision:
          aiRoutingDecision,

        explanation:
          `AI channel routing: ${aiRoutingDecision.reason} Confidence: ${aiRoutingDecision.confidence}.`,

        message:
          "RecoverAI's AI router selected conversational recovery. Customer interaction is required before the next recovery action."
      });
    }


    // ==================================================
    // STEP 5D — AI SELECTED PAYMENT RECOVERY
    // ==================================================

    if (
      aiRoutingDecision.channel ===
      RECOVERY_CHANNELS
        .PAYMENT_RECOVERY
    ) {

      /*
        The channel router decides only which recovery
        path should be used.

        The existing singleRecoveryService remains
        responsible for selecting and executing the
        actual payment-recovery action.

        This preserves separation of responsibilities.
      */

      const result =
        await processSingleRecovery(
          payment
        );


      return {

        channel:
          RECOVERY_CHANNELS
            .PAYMENT_RECOVERY,

        routingDecision:
          aiRoutingDecision,

        ...result,

        explanation:
          `AI channel routing: ${aiRoutingDecision.reason} Confidence: ${aiRoutingDecision.confidence}. ${result.explanation || ""}`
      };
    }


    // ==================================================
    // STEP 5E — UNSUPPORTED AI RESULT FAIL-SAFE
    // ==================================================

    /*
      This should normally never execute because the
      AI service uses a structured response schema.

      It remains here as defense in depth.
    */

    return buildHumanReviewResult({

      routingDecision:
        aiRoutingDecision,

      explanation:
        "The AI router returned a recovery channel that RecoverAI could not safely execute. The case was escalated for human review.",

      message:
        "Unsupported AI recovery-channel decision requires human review."
    });
  }


  // ====================================================
  // STEP 6 — FINAL ROUTING FAIL-SAFE
  // ====================================================

  /*
    A routing result should always match either:

    - deterministic STOP
    - deterministic CONVERSATIONAL
    - deterministic PAYMENT
    - AI_REQUIRED

    If something unexpected reaches this point,
    RecoverAI fails safely.
  */

  return buildHumanReviewResult({

    routingDecision,

    explanation:
      "RecoverAI could not determine a supported recovery channel. The case was escalated for human review.",

    message:
      "Recovery-channel decision requires human review."
  });
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  orchestrateRecovery
};