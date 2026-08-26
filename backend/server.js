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
  createAuditLog,
  createWebhookAuditLog,
  saveAuditLogs,
  getAuditLogs,
} = require("./services/auditService");

const {
  seedPayments,
  getAllPayments,
  getPaymentById,
  createPayment,
} = require("./services/paymentService");

const {
  canProcessRecovery,
  markAsProcessed,
  markRecoveryAsPaid,
  getRecoveryStateByPaymentLinkId,
  getRecoveryStates,
} = require("./services/recoveryStateService");

const {
  processSingleRecovery,
} = require("./services/singleRecoveryService");

const {
  verifyRazorpayWebhook,
} = require("./services/webhookService");

const {
  connectDB,
} = require("./db");


const app = express();


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


        const webhookLog =
          createWebhookAuditLog(
            recoveryState,
            razorpayPaymentId
          );


        await saveAuditLogs([
          webhookLog
        ]);


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

      console.error(
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

      console.error(
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

    try {

      const payment =
        await getPaymentById(
          req.params.paymentId
        );


      if (!payment) {

        return res
          .status(404)
          .json({

            message:
              "Payment not found"
          });
      }


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


      const allowedToProcess =
        await canProcessRecovery(
          payment.paymentId
        );


      if (
        !allowedToProcess
      ) {

        return res
          .status(409)
          .json({

            message:
              "Recovery case currently cannot be processed again"
          });
      }


      const result =
        await processSingleRecovery(
          payment
        );


      const log =
        createAuditLog(

          payment,

          result.recoveryAction,

          result.explanation,

          result.executionResult,

          result.recoveryResult
        );


      await saveAuditLogs([
        log
      ]);


      await markAsProcessed(

        payment,

        result.recoveryAction,

        result.recoveryResult
          .outcome,

        result.executionResult,

        result.explanation
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

      console.error(
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

      console.error(
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

      console.error(
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


// ======================================================
// START DATABASE + SERVER
// ======================================================

connectDB()

  .then(
    async () => {

      await seedPayments(
        payments
      );


      const PORT =
        process.env.PORT ||
        5000;


      app.listen(
        PORT,
        () => {

          console.log(
            `Server running on port ${PORT}`
          );
        }
      );
    }
  )

  .catch(
    (error) => {

      console.error(
        "MongoDB connection failed:",
        error
      );
    }
  );