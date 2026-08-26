const {
  GoogleGenAI,
} = require("@google/genai");


const ai =
  new GoogleGenAI({
    apiKey:
      process.env.GEMINI_API_KEY
  });





// ======================================================
// GET AI RECOMMENDATION
// ======================================================

async function getAIRecommendation(
  payment
) {

  

  // ====================================================
  // GEMINI PROMPT
  // ====================================================

  const prompt = `
You are an AI revenue recovery assistant for a payment system.

Analyze this failed payment:

Payment ID: ${payment.paymentId}
Amount: ${payment.amount}
Payment method: ${payment.method}
Failure reason: ${payment.failureReason}
Customer type: ${payment.customerType}
Previous recovery attempts: ${payment.attemptCount}

Choose exactly ONE recovery action from:

SEND_ALTERNATIVE_PAYMENT_METHOD
REMIND_LATER
RETRY
SEND_REMINDER
REVIEW

Do not recommend discounts.

Return a concise diagnosis, recommended action,
confidence between 0 and 1, and reasoning.
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

              diagnosis: {
                type:
                  "string"
              },

              recommendedAction: {

                type:
                  "string",

                enum: [

                  "SEND_ALTERNATIVE_PAYMENT_METHOD",

                  "REMIND_LATER",

                  "RETRY",

                  "SEND_REMINDER",

                  "REVIEW"
                ]
              },

              confidence: {
                type:
                  "number"
              },

              reasoning: {
                type:
                  "string"
              }
            },


            required: [

              "diagnosis",

              "recommendedAction",

              "confidence",

              "reasoning"
            ]
          }
        }
      });


    const recommendation =
      JSON.parse(
        response.text
      );


    // ==================================================
    // NORMALIZE CONFIDENCE
    // ==================================================

    /*
      Defensive validation.

      Gemini should return 0–1 because of our
      prompt/schema, but we still clamp the
      value before the rest of the agent uses it.
    */

    recommendation.confidence =
      Math.max(
        0,
        Math.min(
          1,
          Number(
            recommendation.confidence
          ) || 0
        )
      );


    return recommendation;

  } catch (error) {

    console.error(
      "AI recommendation failed:",
      error.message
    );


    /*
      Safe failure behavior:

      AI failure must never cause an
      autonomous financial action.
    */

    return {

      diagnosis:
        "AI analysis unavailable.",

      recommendedAction:
        "REVIEW",

      confidence:
        0,

      reasoning:
        "Fallback to human review because the AI service failed."
    };
  }
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  getAIRecommendation
};