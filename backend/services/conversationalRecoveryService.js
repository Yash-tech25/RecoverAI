const {
  GoogleGenAI,
} = require("@google/genai");


const ai =
  new GoogleGenAI({
    apiKey:
      process.env.GEMINI_API_KEY
  });


// ======================================================
// SUPPORTED CONVERSATIONAL INTENTS
// ======================================================

const CONVERSATION_INTENTS = {

  PAY_NOW:
    "PAY_NOW",

  PROMISE_TO_PAY:
    "PROMISE_TO_PAY",

  NEED_ALTERNATIVE_METHOD:
    "NEED_ALTERNATIVE_METHOD",

  CALLBACK_REQUEST:
    "CALLBACK_REQUEST",

  PAYMENT_ALREADY_MADE:
    "PAYMENT_ALREADY_MADE",

  DISPUTE:
    "DISPUTE",

  UNKNOWN:
    "UNKNOWN"
};


// ======================================================
// SUPPORTED REQUESTED ACTIONS
// ======================================================

const CONVERSATION_ACTIONS = {

  CREATE_PAYMENT_LINK:
    "CREATE_PAYMENT_LINK",

  CREATE_PROMISE_TO_PAY:
    "CREATE_PROMISE_TO_PAY",

  SCHEDULE_CALLBACK:
    "SCHEDULE_CALLBACK",

  VERIFY_PAYMENT:
    "VERIFY_PAYMENT",

  HUMAN_REVIEW:
    "HUMAN_REVIEW",

  NO_ACTION:
    "NO_ACTION"
};


// ======================================================
// STRUCTURED GEMINI RESPONSE SCHEMA
// ======================================================

const CONVERSATION_RESPONSE_SCHEMA = {

  type:
    "object",

  properties: {

    intent: {

      type:
        "string",

      enum:
        Object.values(
          CONVERSATION_INTENTS
        )
    },

    confidence: {

      type:
        "number"
    },

    language: {

      type:
        "string",

      enum: [
        "english",
        "hindi",
        "hinglish",
        "other"
      ]
    },

    summary: {

      type:
        "string"
    },

    promisedDate: {

      type: [
        "string",
        "null"
      ]
    },

    requestedAction: {

      type:
        "string",

      enum:
        Object.values(
          CONVERSATION_ACTIONS
        )
    }
  },

  required: [

    "intent",

    "confidence",

    "language",

    "summary",

    "promisedDate",

    "requestedAction"
  ]
};


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
// TRANSIENT GEMINI ERROR CHECK
// ======================================================

function isTransientGeminiError(
  error
) {

  const status =
    Number(
      error?.status ||
      error?.code ||
      error?.response?.status ||
      0
    );


  const message =
    String(
      error?.message || ""
    )
      .toLowerCase();


  return (

    status === 429 ||

    status === 503 ||

    message.includes(
      "429"
    ) ||

    message.includes(
      "503"
    ) ||

    message.includes(
      "unavailable"
    ) ||

    message.includes(
      "high demand"
    ) ||

    message.includes(
      "resource exhausted"
    )
  );
}


// ======================================================
// GEMINI CONVERSATION ANALYSIS
// ======================================================

async function generateConversationAnalysis(
  prompt
) {

  /*
    The whole Gemini operation is bounded to 35 seconds.

    One retry is allowed only for transient provider-side
    congestion such as 429 / 503.

    The same AbortSignal is shared across both attempts,
    so a retry can never extend the total AI wait beyond
    approximately 35 seconds.
  */

  const overallAbortSignal =
    AbortSignal.timeout(
      35000
    );


  const MAX_ATTEMPTS =
    2;


  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt++
  ) {

    try {

      return await ai.models.generateContent({

        model:
          "gemini-3.6-flash",

        contents:
          prompt,

        config: {

          abortSignal:
            overallAbortSignal,

          responseMimeType:
            "application/json",

          responseSchema:
            CONVERSATION_RESPONSE_SCHEMA
        }
      });

    } catch (error) {

      const isLastAttempt =
        attempt ===
        MAX_ATTEMPTS;


      const requestTimedOut =
        overallAbortSignal.aborted;


      const shouldRetry =

        !isLastAttempt &&

        !requestTimedOut &&

        isTransientGeminiError(
          error
        );


      if (!shouldRetry) {

        throw error;
      }


      console.warn(
        `Transient Gemini error on conversational analysis attempt ${attempt}. Retrying once...`
      );


      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            1000
          )
      );
    }
  }


  throw new Error(
    "Conversational analysis did not complete."
  );
}


// ======================================================
// ANALYZE CUSTOMER RESPONSE
// ======================================================

async function analyzeCustomerResponse(
  payment,
  customerMessage
) {

  if (!payment) {

    throw new Error(
      "Payment is required."
    );
  }


  if (
    !customerMessage ||
    !customerMessage.trim()
  ) {

    throw new Error(
      "Customer message is required."
    );
  }


  const today =
    new Date()
      .toISOString()
      .split("T")[0];


  /*
    Keep the task focused.

    Gemini classifies the customer's recovery intent,
    extracts a Promise-to-Pay date when relevant,
    and returns the existing structured contract used
    by the rest of RecoverAI.
  */

  const prompt = `
Classify this customer's payment-recovery response.

Today: ${today}

Payment:
- ID: ${payment.paymentId}
- Amount: ${payment.amount}
- Method: ${payment.method}
- Failure: ${payment.failureReason}
- Customer type: ${payment.customerType}
- Previous attempts: ${payment.attemptCount}

Customer message:
"${customerMessage}"

The message may be English, Hindi, or Hinglish.

Choose exactly one intent:

PAY_NOW
PROMISE_TO_PAY
NEED_ALTERNATIVE_METHOD
CALLBACK_REQUEST
PAYMENT_ALREADY_MADE
DISPUTE
UNKNOWN

Map intent to requestedAction exactly as follows:

PAY_NOW -> CREATE_PAYMENT_LINK
PROMISE_TO_PAY -> CREATE_PROMISE_TO_PAY
NEED_ALTERNATIVE_METHOD -> CREATE_PAYMENT_LINK
CALLBACK_REQUEST -> SCHEDULE_CALLBACK
PAYMENT_ALREADY_MADE -> VERIFY_PAYMENT
DISPUTE -> HUMAN_REVIEW
UNKNOWN -> HUMAN_REVIEW

If the customer promises to pay later, extract the promised
date as YYYY-MM-DD using today's date as reference.

If the promise date cannot be determined safely, use null.

Language must be exactly one of:
english, hindi, hinglish, other.

Return:
- intent
- confidence from 0 to 1
- language
- short neutral summary
- promisedDate
- requestedAction

Do not invent information.
`;


  try {

    const response =
      await generateConversationAnalysis(
        prompt
      );


    if (
      !response?.text
    ) {

      throw new Error(
        "Gemini returned an empty conversational analysis."
      );
    }


    const result =
      JSON.parse(
        response.text
      );


    result.confidence =
      normalizeConfidence(
        result.confidence
      );


    return result;

  } catch (error) {

    console.error(
      "Conversational recovery analysis failed:",
      error.message
    );


    /*
      Safe financial fallback:
      when AI analysis is unavailable or uncertain because
      of a provider failure, RecoverAI does not autonomously
      collect money. The case is escalated for human review.
    */

    return {

      intent:
        CONVERSATION_INTENTS.UNKNOWN,

      confidence:
        0,

      language:
        "other",

      summary:
        "Conversation analysis was unavailable.",

      promisedDate:
        null,

      requestedAction:
        CONVERSATION_ACTIONS.HUMAN_REVIEW
    };
  }
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  CONVERSATION_INTENTS,

  CONVERSATION_ACTIONS,

  analyzeCustomerResponse
};
