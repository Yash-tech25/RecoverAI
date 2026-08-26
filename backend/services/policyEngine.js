function validateRecoveryAction(
  payment,
  action
) {

  // ====================================================
  // ORIGINAL PAYMENT ATTEMPT LIMIT
  // ====================================================

  /*
    If the payment itself has already failed three
    or more times, RecoverAI must stop recovery.

    This is independent of the separate
    recoveryAttempts counter.
  */

  if (
    payment.attemptCount >= 3

    &&

    action !==
      "STOP_RECOVERY"
  ) {

    return {

      allowed:
        false,

      reason:
        "Maximum original payment attempts have been reached. Only STOP_RECOVERY is allowed."
    };
  }


  // ====================================================
  // LOYALTY POLICY
  // ====================================================

  if (
    action ===
      "OFFER_LOYALTY_INCENTIVE"

    &&

    payment.customerType !==
      "returning"
  ) {

    return {

      allowed:
        false,

      reason:
        "Loyalty incentives are only allowed for returning customers."
    };
  }


  // ====================================================
  // ALLOWED RECOVERY ACTIONS
  // ====================================================

  const allowedActions = [

    "NO_ACTION",

    "RETRY",

    "REMIND_LATER",

    "SEND_REMINDER",

    "SEND_ALTERNATIVE_PAYMENT_METHOD",

    "OFFER_LOYALTY_INCENTIVE",

    "STOP_RECOVERY",

    "HUMAN_REVIEW"
  ];


  if (
    !allowedActions.includes(
      action
    )
  ) {

    return {

      allowed:
        false,

      reason:
        "Unknown recovery action."
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

      allowed:
        true,

      reason:
        "Case approved for human escalation. No autonomous recovery action will be executed."
    };
  }


  // ====================================================
  // STOP RECOVERY
  // ====================================================

  if (
    action ===
    "STOP_RECOVERY"
  ) {

    return {

      allowed:
        true,

      reason:
        "Stopping rule approved. No further recovery action will be executed."
    };
  }


  // ====================================================
  // STANDARD APPROVAL
  // ====================================================

  return {

    allowed:
      true,

    reason:
      "Action approved by policy engine."
  };
}


module.exports = {
  validateRecoveryAction
};