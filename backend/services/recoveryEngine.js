function decideRecoveryAction(payment) {

  // Successful payments need no recovery
  if (payment.status === "success") {
    return "NO_ACTION";
  }


  // Safety rule:
  // never keep attempting recovery indefinitely
  if (payment.attemptCount >= 3) {
    return "STOP_RECOVERY";
  }


  // Temporary technical failure
  if (payment.failureReason === "timeout") {
    return "RETRY";
  }


  // Customer may need time before paying again
  if (payment.failureReason === "insufficient_funds") {
    return "REMIND_LATER";
  }


  // Checkout abandonment strategy
  if (payment.failureReason === "checkout_abandoned") {

    if (payment.customerType === "returning") {
      return "OFFER_LOYALTY_INCENTIVE";
    }

    return "SEND_REMINDER";
  }


  // Unknown situations should not be handled blindly
  return "REVIEW";
}


function explainRecoveryAction(payment) {

  const action = decideRecoveryAction(payment);


  switch (action) {

    case "NO_ACTION":
      return "Payment was already successful.";

    case "STOP_RECOVERY":
      return "Maximum recovery attempts have been reached.";

    case "RETRY":
      return "Temporary payment failure detected. Another payment attempt may succeed.";

    case "REMIND_LATER":
      return "Customer may currently have insufficient funds. A later reminder is more appropriate.";

    case "SEND_REMINDER":
      return "A new customer abandoned checkout before completing payment.";

    case "OFFER_LOYALTY_INCENTIVE":
      return "A returning customer abandoned checkout. A small loyalty incentive may help recover the sale.";

    case "REVIEW":
      return "The failure reason is not currently recognized and requires review.";

    default:
      return "No explanation available.";
  }
}


module.exports = {
  decideRecoveryAction,
  explainRecoveryAction,
};