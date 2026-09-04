const {
  GoogleGenAI
} = require("@google/genai");


const {
  RECOVERY_CHANNELS
} = require(
  "./recoveryRouterService"
);


const ai =
  new GoogleGenAI({
    apiKey:
      process.env.GEMINI_API_KEY
  });


// ======================================================
// AI ROUTING CHANNELS
// ======================================================

/*
  IMPORTANT:

  Gemini is intentionally NOT allowed to choose
  STOP_RECOVERY.

  Hard-stop decisions remain deterministic and are
  handled by recoveryRouterService.js.
*/

const AI_ROUTING_CHANNELS = [

  RECOVERY_CHANNELS.PAYMENT_RECOVERY,

  RECOVERY_CHANNELS.CONVERSATIONAL_RECOVERY,

  RECOVERY_CHANNELS.HUMAN_REVIEW
];


// ======================================================
// NORMALIZE CONFIDENCE
// ======================================================

function normalizeConfidence(
  confidence
) {

  return Math.max(
    0,
    Math.min(
      1,
      Number(confidence) || 0
    )
  );
}


// ======================================================
// AI RECOVERY CHANNEL ROUTING
// ======================================================

async function routeRecoveryWithAI(
  payment
) {

  if (!payment) {

    throw new Error(
      "Payment is required for AI recovery routing."
    );
  }


  const prompt = `
You are the recovery-channel routing layer of
RecoverAI, a bounded revenue recovery system.

Your job is ONLY to decide which recovery CHANNEL
is safest and most appropriate for an ambiguous
failed-payment case.

You are NOT allowed to execute payments.
You are NOT allowed to stop recovery permanently.
You are NOT allowed to invent payment facts.

Payment context:

Payment ID: ${payment.paymentId}
Customer ID: ${payment.customerId}
Amount: ${payment.amount}
Payment method: ${payment.method || "unknown"}
Failure reason: ${payment.failureReason || "unknown"}
Customer type: ${payment.customerType || "unknown"}
Previous payment attempts: ${payment.attemptCount || 0}
Payment status: ${payment.status || "unknown"}

Choose exactly ONE channel from:

PAYMENT_RECOVERY
CONVERSATIONAL_RECOVERY
HUMAN_REVIEW

Channel guidance:

PAYMENT_RECOVERY
Use when another direct payment intervention is
reasonably appropriate, such as retrying payment or
offering another payment method.

CONVERSATIONAL_RECOVERY
Use when customer context is needed before taking
another payment action, such as understanding when
the customer can pay or discussing recovery options.

HUMAN_REVIEW
Use when the available information is too ambiguous,
risky, contradictory, or insufficient for an
autonomous routing decision.

Safety rules:

1. Do not choose a channel merely to maximize recovery.
2. Prefer HUMAN_REVIEW when important information is
   missing or the case is unsafe to route autonomously.
3. Do not choose STOP_RECOVERY. That decision is
   controlled only by deterministic policy rules.
4. Confidence must reflect how certain you are that
   the chosen channel is appropriate.
5. Confidence must be between 0 and 1.
6. Give a short explanation of the routing decision.
`;


  try {

    const response =
      await ai.models.generateContent({

        model:
          "gemini-3.6-flash",

        contents:
          prompt,

        config: {

          responseMimeType:
            "application/json",

          responseSchema: {

            type:
              "object",

            properties: {

              channel: {

                type:
                  "string",

                enum:
                  AI_ROUTING_CHANNELS
              },

              confidence: {

                type:
                  "number"
              },

              reason: {

                type:
                  "string"
              }
            },

            required: [

              "channel",

              "confidence",

              "reason"
            ]
          }
        }
      });


    const result =
      JSON.parse(
        response.text
      );


    result.confidence =
      normalizeConfidence(
        result.confidence
      );


    /*
      Extra validation even though Gemini is already
      constrained through the response schema.
    */

    if (
      !AI_ROUTING_CHANNELS.includes(
        result.channel
      )
    ) {

      return {

        channel:
          RECOVERY_CHANNELS.HUMAN_REVIEW,

        confidence:
          0,

        source:
          "AI",

        reason:
          "AI returned an unsupported recovery channel."
      };
    }


    return {

      channel:
        result.channel,

      confidence:
        result.confidence,

      source:
        "AI",

      reason:
        result.reason
    };

  } catch (error) {

    console.error(
      "AI recovery routing failed:",
      error.message
    );


    /*
      Fail safely.

      A Gemini/API/parsing failure must never cause
      RecoverAI to guess a financial recovery channel.
    */

    return {

      channel:
        RECOVERY_CHANNELS.HUMAN_REVIEW,

      confidence:
        0,

      source:
        "AI_FALLBACK",

      reason:
        "AI recovery routing was unavailable. The case was escalated for human review."
    };
  }
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  AI_ROUTING_CHANNELS,

  routeRecoveryWithAI
};