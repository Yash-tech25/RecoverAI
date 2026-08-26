// ======================================================
// LIVE STRATEGY PERFORMANCE
// ======================================================

function calculateStrategyPerformance(
  processedCases
) {

  const performance = {};


  processedCases.forEach(
    (payment) => {

      const action =
        payment.recoveryAction;

      const outcome =
        payment.outcome;


      // ----------------------------------------------
      // DO NOT COUNT UNPROCESSED CASES
      // ----------------------------------------------

      if (
        !outcome ||
        outcome ===
          "NOT_PROCESSED"
      ) {

        return;
      }


      // ----------------------------------------------
      // NOT EXECUTED RECOVERY STRATEGIES
      // ----------------------------------------------

      /*
        HUMAN_REVIEW was previously missing here.

        Human escalation is not an autonomous
        recovery strategy and must therefore not
        affect strategy success rates.
      */

      if (
        action ===
          "STOP_RECOVERY"

        ||

        action ===
          "REVIEW"

        ||

        action ===
          "HUMAN_REVIEW"

        ||

        action ===
          "NO_ACTION"
      ) {

        return;
      }


      if (
        !performance[action]
      ) {

        performance[action] = {

          attempted:
            0,

          recovered:
            0,

          recoveredAmount:
            0,

          pending:
            0,

          failed:
            0
        };
      }


      performance[
        action
      ].attempted++;


      if (
        outcome ===
        "RECOVERED"
      ) {

        performance[
          action
        ].recovered++;


        performance[
          action
        ].recoveredAmount +=
          payment.amount;
      }


      if (
        outcome ===
        "PENDING_PAYMENT"
      ) {

        performance[
          action
        ].pending++;
      }


      if (
        outcome ===
        "RECOVERY_FAILED"
      ) {

        performance[
          action
        ].failed++;
      }
    }
  );


  Object.keys(
    performance
  ).forEach(
    (action) => {

      const data =
        performance[
          action
        ];


      data.successRate =
        data.attempted === 0

          ? 0

          : Number(
              (
                (
                  data.recovered /
                  data.attempted
                ) *
                100
              ).toFixed(2)
            );
    }
  );


  return performance;
}


// ======================================================
// RECOVERY SOURCE BREAKDOWN
// ======================================================

function calculateRecoverySourceBreakdown(
  processedCases
) {

  let simulatedRecoveredRevenue =
    0;

  let simulatedRecoveredCases =
    0;


  let razorpayRecoveredRevenue =
    0;

  let razorpayRecoveredCases =
    0;


  let razorpayPendingRevenue =
    0;

  let razorpayPendingCases =
    0;


  processedCases.forEach(
    (payment) => {

      // ----------------------------------------------
      // RAZORPAY CONFIRMED TEST MODE RECOVERY
      // ----------------------------------------------

      if (
        payment.outcome ===
          "RECOVERED"

        &&

        payment.razorpayPaymentId
      ) {

        razorpayRecoveredRevenue +=
          payment.amount;

        razorpayRecoveredCases++;

        return;
      }


      // ----------------------------------------------
      // SIMULATED HISTORICAL RECOVERY
      // ----------------------------------------------

      if (
        payment.outcome ===
          "RECOVERED"

        &&

        !payment.razorpayPaymentId
      ) {

        simulatedRecoveredRevenue +=
          payment.amount;

        simulatedRecoveredCases++;

        return;
      }


      // ----------------------------------------------
      // RAZORPAY LINK CREATED, NOT PAID
      // ----------------------------------------------

      if (
        payment.outcome ===
          "PENDING_PAYMENT"

        &&

        payment.paymentLinkId
      ) {

        razorpayPendingRevenue +=
          payment.amount;

        razorpayPendingCases++;
      }
    }
  );


  return {

    razorpayConfirmed: {

      cases:
        razorpayRecoveredCases,

      revenue:
        razorpayRecoveredRevenue
    },


    simulated: {

      cases:
        simulatedRecoveredCases,

      revenue:
        simulatedRecoveredRevenue
    },


    razorpayPending: {

      cases:
        razorpayPendingCases,

      revenue:
        razorpayPendingRevenue
    }
  };
}


// ======================================================
// SAFE BATCH EVALUATION METRICS
// ======================================================

function calculateBatchEvaluationMetrics(
  evaluatedCases
) {

  const recoveryCases =
    evaluatedCases.filter(
      (payment) =>
        payment.status !==
        "success"
    );


  // ====================================================
  // TOTAL REVENUE AT RISK
  // ====================================================

  const revenueAtRisk =
    recoveryCases.reduce(

      (total, payment) =>
        total +
        payment.amount,

      0
    );


  // ====================================================
  // PROJECTED SYNTHETIC RECOVERY
  // ====================================================

  const recoveredCases =
    recoveryCases.filter(
      (payment) =>
        payment.outcome ===
        "RECOVERED"
    );


  const projectedRecoveredRevenue =
    recoveredCases.reduce(

      (total, payment) =>
        total +
        payment.amount,

      0
    );


  // ====================================================
  // HUMAN REVIEW
  // ====================================================

  const humanReviewCases =
    recoveryCases.filter(
      (payment) =>
        payment.outcome ===
        "HUMAN_REVIEW"
    );


  const humanReviewAmount =
    humanReviewCases.reduce(

      (total, payment) =>
        total +
        payment.amount,

      0
    );


  // ====================================================
  // STOPPED
  // ====================================================

  const stoppedCases =
    recoveryCases.filter(
      (payment) =>
        payment.outcome ===
        "STOPPED"
    );


  const stoppedAmount =
    stoppedCases.reduce(

      (total, payment) =>
        total +
        payment.amount,

      0
    );


  // ====================================================
  // FAILED SIMULATED RECOVERY
  // ====================================================

  const failedCases =
    recoveryCases.filter(
      (payment) =>
        payment.outcome ===
        "RECOVERY_FAILED"
    );


  const failedAmount =
    failedCases.reduce(

      (total, payment) =>
        total +
        payment.amount,

      0
    );


  // ====================================================
  // RECOVERABLE CASES
  // ====================================================

  const recoverableCases =
    recoveryCases.filter(
      (payment) =>

        payment.recoveryAction !==
          "STOP_RECOVERY"

        &&

        payment.recoveryAction !==
          "HUMAN_REVIEW"
    );


  const recoverableAmount =
    recoverableCases.reduce(

      (total, payment) =>
        total +
        payment.amount,

      0
    );


  // ====================================================
  // PROJECTED RECOVERY RATE
  // ====================================================

  const projectedRecoveryRate =
    recoveryCases.length === 0

      ? 0

      : Number(
          (
            (
              recoveredCases.length /
              recoveryCases.length
            ) *
            100
          ).toFixed(2)
        );


  // ====================================================
  // ACTION DISTRIBUTION
  // ====================================================

  const actionDistribution = {};


  recoveryCases.forEach(
    (payment) => {

      const action =
        payment.recoveryAction;


      if (
        !actionDistribution[
          action
        ]
      ) {

        actionDistribution[
          action
        ] = {

          cases:
            0,

          amount:
            0
        };
      }


      actionDistribution[
        action
      ].cases++;


      actionDistribution[
        action
      ].amount +=
        payment.amount;
    }
  );


  // ====================================================
  // DECISION SOURCE DISTRIBUTION
  // ====================================================

  const decisionSources = {

    ruleEngine:
      0,

    aiEvaluationFixture:
      0
  };


  recoveryCases.forEach(
    (payment) => {

      if (
        payment.decisionSource ===
        "AI_EVALUATION_FIXTURE"
      ) {

        decisionSources
          .aiEvaluationFixture++;

      } else {

        decisionSources
          .ruleEngine++;
      }
    }
  );


  // ====================================================
  // STRATEGY PERFORMANCE
  // ====================================================

  const strategyPerformance =
    calculateStrategyPerformance(
      recoveryCases
    );


  // ====================================================
  // RESPONSE
  // ====================================================

  return {

    totalPayments:
      evaluatedCases.length,

    recoveryCases:
      recoveryCases.length,

    revenueAtRisk,

    recoverableCases:
      recoverableCases.length,

    recoverableAmount,

    projectedRecoveredCases:
      recoveredCases.length,

    projectedRecoveredRevenue,

    projectedRecoveryRate,

    failedCases:
      failedCases.length,

    failedAmount,

    humanReviewCases:
      humanReviewCases.length,

    humanReviewAmount,

    stoppedCases:
      stoppedCases.length,

    stoppedAmount,

    actionDistribution,

    decisionSources,

    strategyPerformance
  };
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  calculateStrategyPerformance,

  calculateRecoverySourceBreakdown,

  calculateBatchEvaluationMetrics
};