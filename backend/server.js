require("dotenv").config();

const express = require("express");
const cors = require("cors");

const {
  rateLimit,
} = require("express-rate-limit");

const payments = require("./data/payments.json");

const {
  decideRecoveryAction,
  explainRecoveryAction,
} = require("./services/recoveryEngine");

const {
  calculateStrategyPerformance,
  calculateRecoverySourceBreakdown,
} = require("./services/recoveryAnalytics");

const {
  evaluateRecoveryBatch,
} = require("./services/batchEvaluationService");

const {
  getAuditLogs,
} = require("./services/auditService");

const {
  seedPayments,
  getAllPayments,
  getPaymentById,
  createPayment,
} = require("./services/paymentService");

const {
  // canProcessRecovery,
  markAsProcessed,
  markRecoveryAsPaid,
  getRecoveryStateByPaymentLinkId,
  getRecoveryStates,
  createCallbackRequest,
  acquireRecoveryExecutionLock,
  releaseRecoveryExecutionLock,
  getRecoveryGuardrail,
} = require("./services/recoveryStateService");

const {
  orchestrateRecovery,
} = require("./services/recoveryOrchestratorService");

const {
  verifyRazorpayWebhook,
} = require("./services/webhookService");

const {
  connectDB,
  closeDB,
} = require("./db");

const {
  analyzeCustomerResponse
} = require("./services/conversationalRecoveryService");

const {
  createPromiseToPay,
  getPromises,
  getActivePromises,
  updatePromiseStatus
} = require("./services/recoveryStateService");

const {
  executeRecoveryAction
} = require(
  "./services/actionExecutor"
);

const {
  refreshPromiseStatuses,
  getPromiseSummary
} = require("./services/promiseLifecycleService");

const {
  logDatabaseError
} = require("./services/databaseErrorService");


const app = express();


// ======================================================
// PERSIST CONVERSATIONAL HUMAN REVIEW
// ======================================================

async function persistConversationalHumanReview(
  payment,
  {
    finalAction = "HUMAN_REVIEW",
    explanation,
    message
  }
) {

  const executionResult = {

    actionExecuted:
      false,

    actionType:
      finalAction,

    message
  };


  const recoveryResult = {

    outcome:
      "HUMAN_REVIEW"
  };


  /*
    Persist the recovery state.

    We intentionally store HUMAN_REVIEW as the
    recoveryAction even when the conversational
    finalAction is VERIFY_PAYMENT.

    This makes the recovery queue, analytics and
    guardrails consistently recognize the case as
    escalated to a human.
  */

  await markAsProcessed(

    payment,

    "HUMAN_REVIEW",

    "HUMAN_REVIEW",

    executionResult,

    explanation
  );


  // ----------------------------------------------------
  // AUDIT TRAIL
  // ----------------------------------------------------



  return {

    finalAction,

    outcome:
      "HUMAN_REVIEW",

    actionExecuted:
      false,

    message
  };
}


// ======================================================
// CORS CONFIGURATION
// ======================================================

const configuredFrontendOrigins =
  (
    process.env.FRONTEND_URL ||
    ""
  )
    .split(",")
    .map(
      (origin) =>
        origin.trim()
    )
    .filter(Boolean);


const allowedOrigins =
  new Set([

    "http://localhost:5173",

    "http://127.0.0.1:5173",

    ...configuredFrontendOrigins
  ]);


app.use(
  cors({

    origin: (
      origin,
      callback
    ) => {

      /*
        Requests without an Origin header are allowed.

        Examples:
        - Razorpay webhook
        - Postman
        - curl
        - server-to-server requests
      */

      if (!origin) {

        return callback(
          null,
          true
        );
      }


      if (
        allowedOrigins.has(
          origin
        )
      ) {

        return callback(
          null,
          true
        );
      }


      console.warn(
        `CORS blocked origin: ${origin}`
      );


      return callback(
        null,
        false
      );
    },


    methods: [
      "GET",
      "POST",
      "OPTIONS"
    ],


    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Razorpay-Signature"
    ]
  })
);


// ======================================================
// RATE LIMIT CONFIGURATION
// ======================================================

/*
  The frontend polls several GET endpoints every
  five seconds.

  Therefore the general API limit is intentionally
  generous enough for normal dashboard polling while
  still protecting the public API from obvious abuse.
*/

const generalApiLimiter =
  rateLimit({

    windowMs:
      15 * 60 * 1000,

    limit:
      2000,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    message: {

      message:
        "Too many API requests. Please try again later."
    }
  });


/*
  Recovery execution is much more sensitive because
  it can:

  - invoke Gemini
  - execute recovery workflows
  - create Razorpay Test Mode payment links
  - modify recovery state

  Therefore it receives a much stricter limit.
*/

const recoveryExecutionLimiter =
  rateLimit({

    windowMs:
      15 * 60 * 1000,

    limit:
      20,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    message: {

      message:
        "Too many recovery execution requests. Please try again later."
    }
  });


/*
  Creating test payment cases also modifies the
  database, so it gets its own reasonable limit.
*/

const paymentCreationLimiter =
  rateLimit({

    windowMs:
      15 * 60 * 1000,

    limit:
      50,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    message: {

      message:
        "Too many payment creation requests. Please try again later."
    }
  });


// ======================================================
// RAZORPAY WEBHOOK
// MUST BE BEFORE express.json() AND API RATE LIMITER
// ======================================================

/*
  Razorpay webhook traffic is intentionally not passed
  through the browser-facing API rate limiter.

  Authenticity is instead enforced using Razorpay's
  webhook signature.
*/

app.post(
  "/api/webhooks/razorpay",

  express.raw({
    type: "application/json"
  }),

  async (req, res) => {

    try {

      const signature =
        req.headers[
          "x-razorpay-signature"
        ];


      const isValid =
        verifyRazorpayWebhook(
          req.body,
          signature
        );


      if (!isValid) {

        console.log(
          "Invalid Razorpay webhook signature"
        );


        return res
          .status(400)
          .json({

            message:
              "Invalid webhook signature"
          });
      }


      const event =
        JSON.parse(
          req.body.toString(
            "utf8"
          )
        );


      console.log(
        "Razorpay webhook received:",
        event.event
      );


      if (
        event.event ===
        "payment_link.paid"
      ) {

        const paymentLink =
          event
            ?.payload
            ?.payment_link
            ?.entity;


        const razorpayPayment =
          event
            ?.payload
            ?.payment
            ?.entity;


        if (
          !paymentLink ||
          !paymentLink.id
        ) {

          return res
            .status(400)
            .json({

              message:
                "Payment link data missing"
            });
        }


        const recoveryState =
          await getRecoveryStateByPaymentLinkId(
            paymentLink.id
          );


        if (!recoveryState) {

          console.log(
            "No RecoverAI case found for:",
            paymentLink.id
          );


          return res
            .status(200)
            .json({

              message:
                "Webhook received but no recovery case matched"
            });
        }


        // ==================================================
        // IDEMPOTENCY
        // ==================================================

        if (
          recoveryState.outcome ===
          "RECOVERED"
        ) {

          return res
            .status(200)
            .json({

              message:
                "Recovery already marked as recovered"
            });
        }


        const razorpayPaymentId =
          razorpayPayment?.id ||
          null;


        await markRecoveryAsPaid(
          paymentLink.id,
          razorpayPaymentId
        );



        console.log(
          `Revenue recovered for ${recoveryState.paymentId}`
        );


        return res
          .status(200)
          .json({

            message:
              "Recovery marked as successful",

            paymentId:
              recoveryState.paymentId,

            paymentLinkId:
              paymentLink.id,

            razorpayPaymentId,

            outcome:
              "RECOVERED"
          });
      }


      return res
        .status(200)
        .json({

          message:
            "Webhook received",

          event:
            event.event
        });

    } catch (error) {

      console.error(
        "Razorpay webhook failed:",
        error
      );


      return res
        .status(500)
        .json({

          message:
            "Webhook processing failed"
        });
    }
  }
);


// ======================================================
// NORMAL JSON MIDDLEWARE
// ======================================================

app.use(
  express.json()
);


// ======================================================
// GENERAL API RATE LIMIT
// ======================================================

app.use(
  "/api",
  generalApiLimiter
);


// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
  "/",

  (req, res) => {

    res.send(
      "RecoverAI backend is running"
    );
  }
);


// ======================================================
// CREATE TEST PAYMENT
// ======================================================

app.post(
  "/api/payments",

  paymentCreationLimiter,

  async (req, res) => {

    try {

      const payment =
        req.body;


      const requiredFields = [

        "paymentId",

        "customerId",

        "customerType",

        "amount",

        "status",

        "attemptCount"
      ];


      for (
        const field of
        requiredFields
      ) {

        if (
          payment[field] ===
          undefined
        ) {

          return res
            .status(400)
            .json({

              message:
                `Missing field: ${field}`
            });
        }
      }


      const createdPayment =
        await createPayment(
          payment
        );


      return res
        .status(201)
        .json({

          message:
            "Payment created successfully",

          payment:
            createdPayment
        });

    } catch (error) {

      return res
        .status(400)
        .json({

          message:
            error.message
        });
    }
  }
);


// ======================================================
// RECOVERY CASES
// SAFE GET — NO GEMINI
// ======================================================

app.get(
  "/api/recovery-cases",

  async (req, res) => {

    try {

      const databasePayments =
        await getAllPayments();


      const results =
        databasePayments.map(
          (payment) => {

            const recoveryAction =
              decideRecoveryAction(
                payment
              );


            return {

              ...payment,

              recoveryAction,

              explanation:
                explainRecoveryAction(
                  payment
                ),

              aiRequired:
                recoveryAction ===
                "REVIEW"
            };
          }
        );


      return res.json(
        results
      );

    } catch (error) {

      logDatabaseError(
  "GET /api/recovery-cases",
  error
);


      return res
        .status(500)
        .json({

          message:
            "Failed to load recovery cases"
        });
    }
  }
);


// ======================================================
// RECOVERY RESULT PREVIEW
// SAFE GET — NO GEMINI / NO RAZORPAY
// ======================================================

app.get(
  "/api/recovery-results",

  async (req, res) => {

    try {

      const databasePayments =
        await getAllPayments();


      const recoveryCases =
        databasePayments.filter(
          (payment) =>
            payment.status !==
            "success"
        );


      const results =
        recoveryCases.map(
          (payment) => {

            const recoveryAction =
              decideRecoveryAction(
                payment
              );


            return {

              paymentId:
                payment.paymentId,

              customerId:
                payment.customerId,

              amount:
                payment.amount,

              recoveryAction,

              explanation:
                explainRecoveryAction(
                  payment
                ),

              aiRequired:
                recoveryAction ===
                "REVIEW",

              previewOnly:
                true
            };
          }
        );


      return res.json(
        results
      );

    } catch (error) {

      logDatabaseError(
  "GET /api/recovery-results",
  error
);

      return res
        .status(500)
        .json({

          message:
            "Failed to generate recovery results"
        });
    }
  }
);


// ======================================================
// SAFE BATCH EVALUATION
// ======================================================

app.get(
  "/api/batch-evaluation",

  async (req, res) => {

    try {

      /*
        IMPORTANT:

        This evaluation uses only the fixed
        synthetic payments dataset.

        It performs:

        - 0 Gemini calls
        - 0 Razorpay link creation
        - 0 recovery-state mutation
        - 0 audit-log mutation
      */

      const evaluation =
        evaluateRecoveryBatch(
          payments
        );


      return res.json(
        evaluation
      );

    } catch (error) {

      console.error(
        "Batch evaluation failed:",
        error
      );


      return res
        .status(500)
        .json({

          message:
            "Failed to evaluate recovery batch"
        });
    }
  }
);


// ======================================================
// PROCESS ONE REAL RECOVERY CASE
// ======================================================

app.post(
  "/api/recovery/:paymentId",

  recoveryExecutionLimiter,

  async (req, res) => {

    const paymentId =
      req.params.paymentId;


    let lockAcquired =
      false;


    try {

      // ==================================================
      // PREVENT DUPLICATE CONCURRENT EXECUTION
      // ==================================================

      lockAcquired =
        await acquireRecoveryExecutionLock(
          paymentId
        );


      if (!lockAcquired) {

        return res
          .status(409)
          .json({

            message:
              "Recovery for this payment is already being processed."
          });
      }


      // ==================================================
      // LOAD PAYMENT
      // ==================================================

      const payment =
        await getPaymentById(
          paymentId
        );


      if (!payment) {

        return res
          .status(404)
          .json({

            message:
              "Payment not found"
          });
      }


      // ==================================================
      // SUCCESSFUL PAYMENT GUARDRAIL
      // ==================================================

      if (
        payment.status ===
        "success"
      ) {

        return res
          .status(400)
          .json({

            message:
              "Successful payment does not require recovery"
          });
      }


      // ==================================================
// CURRENT RECOVERY STATE GUARDRAIL
// ==================================================

const recoveryGuardrail =
  await getRecoveryGuardrail(
    payment.paymentId
  );


if (
  !recoveryGuardrail.allowed
) {

  return res
    .status(409)
    .json({

      message:
        recoveryGuardrail.reason
    });
}


// ==================================================
// ENFORCE FORCED RECOVERY DECISIONS
// ==================================================

let result;


/*
  forcedAction is different from allowed.

  allowed = false
    means the case is currently paused or terminal.

  forcedAction
    means processing may continue, but only through
    the safety action selected by the guardrail.

  This check must happen BEFORE channel routing so
  PAYMENT_RECOVERY and CONVERSATIONAL_RECOVERY are
  governed by the same safety policy.
*/

if (
  recoveryGuardrail.forcedAction ===
  "HUMAN_REVIEW"
) {

  result = {

    channel:
      "HUMAN_REVIEW",

    routingDecision: {

      channel:
        "HUMAN_REVIEW",

      source:
        "RECOVERY_GUARDRAIL",

      confidence:
        1,

      reason:
        recoveryGuardrail.reason
    },

    recoveryAction:
      "HUMAN_REVIEW",

    explanation:
      recoveryGuardrail.reason,

    executionResult: {

      actionExecuted:
        false,

      actionType:
        "HUMAN_REVIEW",

      message:
        recoveryGuardrail.reason
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


else if (
  recoveryGuardrail.forcedAction ===
  "STOP_RECOVERY"
) {

  result = {

    channel:
      "STOP_RECOVERY",

    routingDecision: {

      channel:
        "STOP_RECOVERY",

      source:
        "RECOVERY_GUARDRAIL",

      confidence:
        1,

      reason:
        recoveryGuardrail.reason
    },

    recoveryAction:
      "STOP_RECOVERY",

    explanation:
      recoveryGuardrail.reason,

    executionResult: {

      actionExecuted:
        false,

      actionType:
        "STOP_RECOVERY",

      message:
        recoveryGuardrail.reason
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


// ==================================================
// NORMAL CHANNEL ROUTING
// ==================================================

else {

  result =
    await orchestrateRecovery(
      payment
    );
}


      // ==================================================
      // PERSIST FINAL STATE
      // ==================================================

      await markAsProcessed(

        payment,

        result.recoveryAction,

        result.recoveryResult
          .outcome,

        result.executionResult,

        result.explanation,

        result.routingDecision
      );


      return res.json({

        message:
          "Recovery processed successfully",

        paymentId:
          payment.paymentId,

        ...result
      });

    } catch (error) {

      console.error(
        "Single recovery processing failed:",
        error
      );


      return res
        .status(500)
        .json({

          message:
            "Failed to process recovery case"
        });

    } finally {

      /*
        Always release the lock.

        This includes:
        - normal success
        - validation rejection
        - Gemini failure
        - Razorpay failure
        - database failure
        - thrown exceptions
      */

      if (
        lockAcquired
      ) {

        try {

          await releaseRecoveryExecutionLock(
            paymentId
          );

        } catch (lockError) {

          console.error(
            "Recovery execution lock release failed:",
            lockError
          );
        }
      }
    }
  }
);

// ======================================================
// UNSAFE BULK LIVE EXECUTION DISABLED
// ======================================================

app.post(
  "/api/process-recovery",

  (req, res) => {

    return res
      .status(403)
      .json({

        message:
          "Bulk live recovery execution is disabled for safety.",

        safeAlternative:
          "GET /api/batch-evaluation"
      });
  }
);


// ======================================================
// RECOVERY SUMMARY
// ======================================================

app.get(
  "/api/recovery-summary",

  async (req, res) => {

    try {

      const databasePayments =
        await getAllPayments();


      const recoveryCases =
        databasePayments.filter(
          (payment) =>
            payment.status !==
            "success"
        );


      const recoveryStates =
        await getRecoveryStates();


      const stateMap =
        new Map();


      recoveryStates.forEach(
        (state) => {

          stateMap.set(
            state.paymentId,
            state
          );
        }
      );


      const processedCases =
        recoveryCases.map(
          (payment) => {

            const state =
              stateMap.get(
                payment.paymentId
              );


            return {

              ...payment,

              recoveryAction:
                state?.recoveryAction ||

                decideRecoveryAction(
                  payment
                ),

              outcome:
                state?.outcome ||
                "NOT_PROCESSED",

              explanation:
                state?.explanation ||

                explainRecoveryAction(
                  payment
                ),

              recovered:
                state?.outcome ===
                "RECOVERED",

              recoveredAmount:

                state?.outcome ===
                "RECOVERED"

                  ? payment.amount

                  : 0,

              paymentLinkId:
                state?.paymentLinkId ||
                null,

              paymentLinkUrl:
                state?.paymentLinkUrl ||
                null,

              paymentLinkStatus:
                state?.paymentLinkStatus ||
                null,

              razorpayPaymentId:
                state?.razorpayPaymentId ||
                null,

              recoveryAttempts:
                state?.recoveryAttempts ||
                0,

              recoveredAt:
                state?.recoveredAt ||
                null
            };
          }
        );


      const revenueAtRisk =
        recoveryCases.reduce(

          (total, payment) =>
            total +
            payment.amount,

          0
        );


      const recoveredRevenue =
        processedCases.reduce(

          (total, payment) =>
            total +
            payment.recoveredAmount,

          0
        );


      const recoveredCases =
        processedCases.filter(
          (payment) =>
            payment.recovered ===
            true
        ).length;


      const recoveryRate =

        recoveryCases.length === 0

          ? 0

          : Number(
              (
                (
                  recoveredCases /
                  recoveryCases.length
                ) *
                100
              ).toFixed(2)
            );


      const pendingPaymentAmount =
        processedCases

          .filter(
            (payment) =>
              payment.outcome ===
              "PENDING_PAYMENT"
          )

          .reduce(

            (total, payment) =>
              total +
              payment.amount,

            0
          );


      const stoppedAmount =
        processedCases

          .filter(
            (payment) =>
              payment.outcome ===
              "STOPPED"
          )

          .reduce(

            (total, payment) =>
              total +
              payment.amount,

            0
          );


      const humanReviewAmount =
        processedCases

          .filter(
            (payment) =>
              payment.outcome ===
              "HUMAN_REVIEW"
          )

          .reduce(

            (total, payment) =>
              total +
              payment.amount,

            0
          );


      const humanReviewCases =
        processedCases.filter(
          (payment) =>
            payment.outcome ===
            "HUMAN_REVIEW"
        ).length;


      const countAction =
        (actionName) => {

          return processedCases.filter(
            (payment) =>
              payment.recoveryAction ===
              actionName
          ).length;
        };


      const processedCount =
        processedCases.filter(
          (payment) =>
            payment.outcome !==
            "NOT_PROCESSED"
        ).length;


      const unprocessedCount =
        processedCases.filter(
          (payment) =>
            payment.outcome ===
            "NOT_PROCESSED"
        ).length;


      const strategyPerformance =
        calculateStrategyPerformance(
          processedCases
        );


      const recoverySources =
        calculateRecoverySourceBreakdown(
          processedCases
        );


      return res.json({

        totalPayments:
          databasePayments.length,

        recoveryCases:
          recoveryCases.length,

        processedCases:
          processedCount,

        unprocessedCases:
          unprocessedCount,

        humanReviewCases,

        revenueAtRisk,

        recoveredRevenue,

        recoveredCases,

        recoveryRate,

        pendingPaymentAmount,

        stoppedAmount,

        humanReviewAmount,


        actions: {

          retry:
            countAction(
              "RETRY"
            ),

          remindLater:
            countAction(
              "REMIND_LATER"
            ),

          sendReminder:
            countAction(
              "SEND_REMINDER"
            ),

          alternativePaymentMethod:
            countAction(
              "SEND_ALTERNATIVE_PAYMENT_METHOD"
            ),

          loyaltyIncentive:
            countAction(
              "OFFER_LOYALTY_INCENTIVE"
            ),

          humanReview:
            countAction(
              "HUMAN_REVIEW"
            ),

          review:
            countAction(
              "REVIEW"
            ),

          stopRecovery:
            countAction(
              "STOP_RECOVERY"
            )
        },


        strategyPerformance,


        recoverySources
      });

    } catch (error) {

      logDatabaseError(
  "GET /api/recovery-summary",
  error
);


      return res
        .status(500)
        .json({

          message:
            "Failed to generate recovery summary"
        });
    }
  }
);


// ======================================================
// AUDIT LOGS
// ======================================================

app.get(
  "/api/audit-logs",

  async (req, res) => {

    try {

      const logs =
        await getAuditLogs();


      return res.json(
        logs
      );

    } catch (error) {

      logDatabaseError(
  "GET /api/audit-logs",
  error
);


      return res
        .status(500)
        .json({

          message:
            "Failed to load audit logs"
        });
    }
  }
);


// ======================================================
// RECOVERY STATES
// ======================================================

app.get(
  "/api/recovery-states",

  async (req, res) => {

    try {

      const states =
        await getRecoveryStates();


      return res.json(
        states
      );

    } catch (error) {

     logDatabaseError(
  "GET /api/recovery-states",
  error
);


      return res
        .status(500)
        .json({

          message:
            "Failed to load recovery states"
        });
    }
  }
);

app.post(
  "/api/conversation/analyze",

  recoveryExecutionLimiter,

  async (req, res) => {

    try {

      const {
        payment,
        customerMessage
      } = req.body;


      const result =
        await analyzeCustomerResponse(
          payment,
          customerMessage
        );


      res.json({
        success: true,
        result
      });

    } catch (error) {

      console.error(
        "Conversation analysis error:",
        error.message
      );


      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);



app.get(
  "/api/promises",
  async (req, res) => {

    try {

      await refreshPromiseStatuses();

      const promises =
        await getPromises();


      res.json({
        success: true,
        count:
          promises.length,
        promises
      });

    } catch (error) {

      logDatabaseError(
  "GET /api/promises",
  error
);


      res.status(500).json({
        success: false,
        message:
          "Unable to fetch Promise-to-Pay records."
      });
    }
  }
);


app.get(
  "/api/promises/active",
  async (req, res) => {

    try {

      const promises =
        await getActivePromises();


      res.json({
        success: true,
        count:
          promises.length,
        promises
      });

    } catch (error) {

      logDatabaseError(
  "GET active promises",
  error
);


      res.status(500).json({
        success: false,
        message:
          "Unable to fetch active Promise-to-Pay records."
      });
    }
  }
);

app.post(
  "/api/conversation/recover",

  recoveryExecutionLimiter,

  async (req, res) => {

  let lockAcquired =
    false;


  let canonicalPaymentId =
    null;


  try {

    let {
      payment,
      customerMessage
    } = req.body;


    // ====================================================
    // BASIC PAYMENT IDENTIFICATION
    // ====================================================

    if (
      !payment ||
      !payment.paymentId
    ) {

      throw new Error(
        "Payment ID is required."
      );
    }


    canonicalPaymentId =
      payment.paymentId;


    // ====================================================
    // RECOVERY EXECUTION LOCK
    // ====================================================

    lockAcquired =
      await acquireRecoveryExecutionLock(
        canonicalPaymentId
      );


    if (!lockAcquired) {

      return res
        .status(409)
        .json({

          success:
            false,

          message:
            "Recovery for this payment is already being processed."
        });
    }


    // ====================================================
    // LOAD TRUSTED PAYMENT FROM DATABASE
    // ====================================================

    const storedPayment =
      await getPaymentById(
        canonicalPaymentId
      );


    if (!storedPayment) {

      return res
        .status(404)
        .json({

          success:
            false,

          message:
            "Payment not found."
        });
    }


    /*
      From this point onward the backend uses only the
      MongoDB payment record.

      The frontend is allowed to identify the case,
      but it cannot control financial fields such as:

      - amount
      - customer ID
      - failure reason
      - attempt count
      - payment method
    */

    payment =
      storedPayment;

    
    
    // ====================================================
// SUCCESSFUL PAYMENT HARD STOP
// ====================================================

if (
  payment.status ===
  "success"
) {

  return res
    .status(409)
    .json({

      success:
        false,

      message:
        "Successful payment does not require recovery."
    });
}



// ====================================================
// ORIGINAL PAYMENT ATTEMPT HARD STOP
// ====================================================

if (
  Number(
    payment.attemptCount || 0
  ) >= 3
) {

  return res
    .status(409)
    .json({

      success:
        false,

      message:
        "Maximum original payment attempts have been reached. Conversational recovery is not allowed."
    });
}

    


    // ====================================================
    // CURRENT RECOVERY GUARDRAIL
    // ====================================================

    const recoveryGuardrail =
      await getRecoveryGuardrail(
        payment.paymentId
      );


    if (
      !recoveryGuardrail.allowed
    ) {

      return res
        .status(409)
        .json({

          success:
            false,

          message:
            recoveryGuardrail.reason
        });
    }


    /*
      A forced guardrail decision means autonomous
      conversational execution must not continue.

      Examples:

      - maximum total recovery attempts reached
      - repeated failed autonomous recovery requiring
        human review
    */

    if (
      recoveryGuardrail.forcedAction
    ) {

      if (
        recoveryGuardrail.forcedAction ===
        "HUMAN_REVIEW"
      ) {

        const escalation =
          await persistConversationalHumanReview(
            payment,
            {

              finalAction:
                "HUMAN_REVIEW",

              explanation:
                recoveryGuardrail.reason,

              message:
                "Recovery guardrails require human review before further autonomous action."
            }
          );


        return res.json({

          success:
            true,

          channel:
            "CONVERSATIONAL_RECOVERY",

          ...escalation
        });
      }


      if (
        recoveryGuardrail.forcedAction ===
        "STOP_RECOVERY"
      ) {

        const executionResult = {

          actionExecuted:
            false,

          actionType:
            "RECOVERY_STOPPED",

          message:
            recoveryGuardrail.reason
        };


        await markAsProcessed(

          payment,

          "STOP_RECOVERY",

          "STOPPED",

          executionResult,

          recoveryGuardrail.reason
        );


        return res.json({

          success:
            true,

          channel:
            "STOP_RECOVERY",

          finalAction:
            "STOP_RECOVERY",

          outcome:
            "STOPPED",

          actionExecuted:
            false,

          message:
            recoveryGuardrail.reason
        });
      }
    }


      // ====================================================
      // BASIC VALIDATION
      // ====================================================



      if (
        !customerMessage ||
        !customerMessage.trim()
      ) {
        throw new Error(
          "Customer message is required."
        );
      }


      // ====================================================
      // STEP 1 — ANALYZE CUSTOMER RESPONSE
      // ====================================================

      const analysis =
        await analyzeCustomerResponse(
          payment,
          customerMessage
        );


      // ====================================================
      // STEP 2 — CONFIDENCE GUARDRAIL
      // ====================================================

      const MIN_CONFIDENCE =
        0.75;


      if (
  analysis.confidence <
  MIN_CONFIDENCE
) {

  const escalation =
    await persistConversationalHumanReview(
      payment,
      {

        finalAction:
          "HUMAN_REVIEW",

        explanation:
          `Conversational recovery was escalated because Gemini confidence (${analysis.confidence}) was below the autonomous execution threshold (${MIN_CONFIDENCE}).`,

        message:
          "Conversation intent confidence was below the autonomous execution threshold."
      }
    );


  return res.json({

    success:
      true,

    channel:
      "CONVERSATIONAL_RECOVERY",

    analysis,

    ...escalation
  });
}


      // ====================================================
      // STEP 3 — INTENT ROUTING
      // ====================================================


      // ----------------------------------------------------
      // PROMISE TO PAY
      // ----------------------------------------------------

      if (
        analysis.intent ===
        "PROMISE_TO_PAY"
      ) {

        if (
  !analysis.promisedDate
) {

  const escalation =
    await persistConversationalHumanReview(
      payment,
      {

        finalAction:
          "HUMAN_REVIEW",

        explanation:
          "The customer expressed a Promise-to-Pay intent, but RecoverAI could not reliably determine the promised payment date. Autonomous commitment creation was stopped.",

        message:
          "A Promise-to-Pay intent was detected, but no reliable promised date could be extracted."
      }
    );


  return res.json({

    success:
      true,

    channel:
      "CONVERSATIONAL_RECOVERY",

    analysis,

    ...escalation
  });
}


        const promise =
          await createPromiseToPay(
            payment,
            {

              promisedAmount:
                payment.amount,

              promisedDate:
                analysis.promisedDate,

              conversationSummary:
                analysis.summary,

              language:
                analysis.language,

              confidence:
                analysis.confidence
            }
          );


        return res.json({

          success:
            true,

          channel:
            "CONVERSATIONAL_RECOVERY",

          analysis,

          finalAction:
            "CREATE_PROMISE_TO_PAY",

          outcome:
            "PROMISE_TO_PAY",

          actionExecuted:
            true,

          promise,

          message:
            "Promise-to-Pay created successfully."
        });
      }


      // ----------------------------------------------------
// PAY NOW
// ----------------------------------------------------

if (
  analysis.intent ===
  "PAY_NOW"
) {

  const recoveryAction =
    "SEND_ALTERNATIVE_PAYMENT_METHOD";


  const executionResult =
    await executeRecoveryAction(
      payment,
      recoveryAction
    );


  const outcome =
    executionResult.paymentLinkId
      ? "PENDING_PAYMENT"
      : "RECOVERY_FAILED";


  const explanation =
    "Customer indicated they are ready to pay now during conversational recovery. RecoverAI created a Razorpay Test Mode payment link after the conversation passed the confidence threshold.";


  await markAsProcessed(
    payment,
    recoveryAction,
    outcome,
    executionResult,
    explanation
  );


  return res.json({

    success:
      true,

    channel:
      "CONVERSATIONAL_RECOVERY",

    analysis,

    finalAction:
      "CREATE_PAYMENT_LINK",

    recoveryAction,

    outcome,

    actionExecuted:
      executionResult.actionExecuted,

    executionResult,

    message:
      executionResult.message
  });
}


      // ----------------------------------------------------
// ALTERNATIVE PAYMENT METHOD
// ----------------------------------------------------

if (
  analysis.intent ===
  "NEED_ALTERNATIVE_METHOD"
) {

  const recoveryAction =
    "SEND_ALTERNATIVE_PAYMENT_METHOD";


  const executionResult =
    await executeRecoveryAction(
      payment,
      recoveryAction
    );


  const outcome =
    executionResult.paymentLinkId
      ? "PENDING_PAYMENT"
      : "RECOVERY_FAILED";


  const explanation =
    "Customer requested a different payment method during conversational recovery. RecoverAI created a Razorpay Test Mode payment link after the request passed the confidence threshold.";


  await markAsProcessed(
    payment,
    recoveryAction,
    outcome,
    executionResult,
    explanation
  );


  return res.json({

    success:
      true,

    channel:
      "CONVERSATIONAL_RECOVERY",

    analysis,

    finalAction:
      "CREATE_PAYMENT_LINK",

    recoveryAction,

    outcome,

    actionExecuted:
      executionResult.actionExecuted,

    executionResult,

    message:
      executionResult.message
  });
}


      // ----------------------------------------------------
      // CALLBACK REQUEST
      // ----------------------------------------------------

      if (
        analysis.intent ===
        "CALLBACK_REQUEST"
      ) {

        const callback =
  await createCallbackRequest(
    payment,
    {
      ...analysis,
      customerMessage
    }
  );


return res.json({

  success:
    true,

  channel:
    "CONVERSATIONAL_RECOVERY",

  analysis,

  finalAction:
    "SCHEDULE_CALLBACK",

  outcome:
    "CALLBACK_REQUESTED",

  actionExecuted:
    true,

  callback,

  message:
    "Customer callback request was recorded successfully."
});
      }


      // ----------------------------------------------------
      // PAYMENT ALREADY MADE
      // ----------------------------------------------------

      if (
  analysis.intent ===
  "PAYMENT_ALREADY_MADE"
) {

  const escalation =
    await persistConversationalHumanReview(
      payment,
      {

        finalAction:
          "VERIFY_PAYMENT",

        explanation:
          "The customer stated that payment has already been completed. RecoverAI stopped autonomous recovery because requesting another payment without verification could create a duplicate-charge risk.",

        message:
          "Customer claims the payment is already complete. RecoverAI will not request another payment without verification."
      }
    );


  return res.json({

    success:
      true,

    channel:
      "CONVERSATIONAL_RECOVERY",

    analysis,

    ...escalation
  });
}


      // ----------------------------------------------------
      // DISPUTE
      // ----------------------------------------------------

      if (
  analysis.intent ===
  "DISPUTE"
) {

  const escalation =
    await persistConversationalHumanReview(
      payment,
      {

        finalAction:
          "HUMAN_REVIEW",

        explanation:
          "The customer disputed the payment. RecoverAI stopped autonomous recovery because disputes require human investigation rather than further automated collection attempts.",

        message:
          "Customer disputed the payment. Autonomous recovery has been stopped and the case requires human review."
      }
    );


  return res.json({

    success:
      true,

    channel:
      "CONVERSATIONAL_RECOVERY",

    analysis,

    ...escalation
  });
}


      // ----------------------------------------------------
      // UNKNOWN
      // ----------------------------------------------------

     const escalation =
  await persistConversationalHumanReview(
    payment,
    {

      finalAction:
        "HUMAN_REVIEW",

      explanation:
        "RecoverAI could not determine a safe conversational recovery action from the customer's response. The case was escalated rather than allowing an uncertain autonomous action.",

      message:
        "Customer intent could not be determined safely."
    }
  );


return res.json({

  success:
    true,

  channel:
    "CONVERSATIONAL_RECOVERY",

  analysis,

  ...escalation
});


   } catch (error) {

  console.error(
    "Conversational recovery orchestration error:",
    error.message
  );


  return res
    .status(400)
    .json({

      success:
        false,

      message:
        error.message
    });

} finally {

  // ====================================================
  // RELEASE EXECUTION LOCK
  // ====================================================

  if (
    lockAcquired &&
    canonicalPaymentId
  ) {

    try {

      await releaseRecoveryExecutionLock(
        canonicalPaymentId
      );

    } catch (lockError) {

      console.error(
        "Conversational recovery lock release failed:",
        lockError
      );
    }
  }
}
  }
);


app.post(
  "/api/promises/refresh",
  async (req, res) => {

    try {

      const result =
        await refreshPromiseStatuses();


      res.json({
        success: true,
        ...result
      });

    } catch (error) {

      logDatabaseError(
  "POST /api/promises/refresh",
  error
);


      res.status(500).json({
        success: false,
        message:
          "Unable to refresh Promise-to-Pay states."
      });
    }
  }
);


app.get(
  "/api/promises/summary",
  async (req, res) => {

    try {

      const summary =
        await getPromiseSummary();


      res.json({
        success: true,
        summary
      });

    } catch (error) {

     logDatabaseError(
  "GET promise summary",
  error
);


      res.status(500).json({
        success: false,
        message:
          "Unable to fetch Promise-to-Pay summary."
      });
    }
  }
);


// app.post(
//   "/api/promises/:paymentId/kept",
//   async (req, res) => {

//     try {

//       const { paymentId } =
//         req.params;


//       const updatedState =
//         await updatePromiseStatus(
//           paymentId,
//           "KEPT"
//         );


//       if (!updatedState) {

//         return res.status(404).json({
//           success: false,
//           message:
//             "Promise-to-Pay record not found."
//         });
//       }


//       res.json({
//         success: true,
//         message:
//           "Promise marked as kept.",
//         recoveryState:
//           updatedState
//       });

//     } catch (error) {

//       logDatabaseError(
//   "POST /api/promises/:paymentId/kept",
//   error
// );


//       res.status(500).json({
//         success: false,
//         message:
//           "Unable to mark promise as kept."
//       });
//     }
//   }
// );


// app.post(
//   "/api/promises/:paymentId/broken",
//   async (req, res) => {

//     try {

//       const { paymentId } =
//         req.params;


//       const updatedState =
//         await updatePromiseStatus(
//           paymentId,
//           "BROKEN"
//         );


//       if (!updatedState) {

//         return res.status(404).json({
//           success: false,
//           message:
//             "Promise-to-Pay record not found."
//         });
//       }


//       res.json({
//         success: true,
//         message:
//           "Promise marked as broken.",
//         recoveryState:
//           updatedState
//       });

//     } catch (error) {

//       logDatabaseError(
//   "POST /api/promises/:paymentId/broken",
//   error
// );


//       res.status(500).json({
//         success: false,
//         message:
//           "Unable to mark promise as broken."
//       });
//     }
//   }
// );


// ======================================================
// START DATABASE + SERVER
// ======================================================

let httpServer;


async function startServer() {

  try {

    await connectDB();


    await seedPayments(
      payments
    );


    const PORT =
      process.env.PORT ||
      5000;


    httpServer =
      app.listen(
        PORT,
        () => {

          console.log(
            `Server running on port ${PORT}`
          );
        }
      );

  } catch (error) {

    console.error(
      "RecoverAI backend startup failed:",
      error
    );


    process.exitCode =
      1;
  }
}


let shuttingDown =
  false;


// ======================================================
// GRACEFUL SHUTDOWN
// ======================================================

async function shutdown(
  signal
) {

  if (shuttingDown) {

    return;
  }


  shuttingDown =
    true;


  console.log(
    `${signal} received. Shutting down RecoverAI backend...`
  );


  try {

    /*
      Stop accepting new HTTP requests first.
    */

    if (httpServer) {

      await new Promise(
        (resolve, reject) => {

          httpServer.close(
            (error) => {

              if (error) {

                reject(
                  error
                );

                return;
              }


              resolve();
            }
          );
        }
      );
    }


    /*
      Then close MongoDB cleanly.
    */

    await closeDB();


    console.log(
      "RecoverAI backend shut down cleanly"
    );

  } catch (error) {

    console.error(
      "Backend shutdown failed:",
      error
    );


    process.exitCode =
      1;

  } finally {

    process.exit();
  }
}


// ======================================================
// PROCESS SIGNALS
// ======================================================

process.on(
  "SIGINT",
  () =>
    shutdown(
      "SIGINT"
    )
);


process.on(
  "SIGTERM",
  () =>
    shutdown(
      "SIGTERM"
    )
);


// ======================================================
// START APPLICATION
// ======================================================

startServer();