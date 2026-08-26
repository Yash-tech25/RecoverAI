function simulateRecoveryOutcome(
  payment,
  action
) {

  // ====================================================
  // NO ACTION
  // ====================================================

  if (
    action ===
    "NO_ACTION"
  ) {

    return {

      recovered:
        false,

      recoveredAmount:
        0,

      outcome:
        "NOT_REQUIRED"
    };
  }


  // ====================================================
  // STOPPED
  // ====================================================

  if (
    action ===
    "STOP_RECOVERY"
  ) {

    return {

      recovered:
        false,

      recoveredAmount:
        0,

      outcome:
        "STOPPED"
    };
  }


  // ====================================================
  // HUMAN REVIEW
  // ====================================================

  if (
    action ===
    "HUMAN_REVIEW"
  ) {

    return {

      recovered:
        false,

      recoveredAmount:
        0,

      outcome:
        "HUMAN_REVIEW"
    };
  }


  // ====================================================
  // REAL RAZORPAY PAYMENT LINK
  // ====================================================

  /*
    Creating a payment link does NOT mean
    revenue has been recovered.

    We wait for the signed Razorpay webhook.
  */

  if (
    action ===
    "SEND_ALTERNATIVE_PAYMENT_METHOD"
  ) {

    return {

      recovered:
        false,

      recoveredAmount:
        0,

      outcome:
        "PENDING_PAYMENT"
    };
  }


  // ====================================================
  // SIMULATED RECOVERY OUTCOMES
  // ====================================================

  const successfulRecoveryCases = [

    "pay_001",

    "pay_004",

    "pay_007"
  ];


  if (
    successfulRecoveryCases.includes(
      payment.paymentId
    )
  ) {

    return {

      recovered:
        true,

      recoveredAmount:
        payment.amount,

      outcome:
        "RECOVERED"
    };
  }


  return {

    recovered:
      false,

    recoveredAmount:
      0,

    outcome:
      "RECOVERY_FAILED"
  };
}


module.exports = {
  simulateRecoveryOutcome
};