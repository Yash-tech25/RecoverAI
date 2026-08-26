const {
  createRecoveryPaymentLink,
} = require("./razorpayService");


// ======================================================
// EXECUTE RECOVERY ACTION
// ======================================================

async function executeRecoveryAction(
  payment,
  action
) {

  switch (action) {

    // ==================================================
    // RETRY
    // SIMULATED WORKFLOW
    // ==================================================

    case "RETRY":

      return {

        actionExecuted:
          true,

        actionType:
          "SIMULATED_PAYMENT_RETRY",

        message:
          "Simulated payment retry workflow executed."
      };


    // ==================================================
    // REMIND LATER
    // SIMULATED WORKFLOW
    // ==================================================

    case "REMIND_LATER":

      return {

        actionExecuted:
          true,

        actionType:
          "SIMULATED_SCHEDULE_REMINDER",

        message:
          "Simulated reminder scheduling workflow executed."
      };


    // ==================================================
    // SEND REMINDER
    // SIMULATED WORKFLOW
    // ==================================================

    case "SEND_REMINDER":

      return {

        actionExecuted:
          true,

        actionType:
          "SIMULATED_CUSTOMER_REMINDER",

        message:
          "Simulated checkout recovery reminder workflow executed."
      };


    // ==================================================
    // ALTERNATIVE PAYMENT METHOD
    // REAL RAZORPAY TEST MODE PAYMENT LINK
    // ==================================================

    case "SEND_ALTERNATIVE_PAYMENT_METHOD": {

      const paymentLink =
        await createRecoveryPaymentLink(
          payment
        );


      return {

        actionExecuted:
          true,

        actionType:
          "RAZORPAY_PAYMENT_LINK",

        message:
          "Razorpay Test Mode recovery payment link created.",

        paymentLinkId:
          paymentLink.paymentLinkId,

        paymentLinkUrl:
          paymentLink.shortUrl,

        paymentLinkStatus:
          paymentLink.status
      };
    }


    // ==================================================
    // LOYALTY INCENTIVE
    // SIMULATED WORKFLOW
    // ==================================================

    case "OFFER_LOYALTY_INCENTIVE":

      return {

        actionExecuted:
          true,

        actionType:
          "SIMULATED_LOYALTY_OFFER",

        message:
          "Simulated loyalty recovery incentive workflow executed."
      };


    // ==================================================
    // STOP RECOVERY
    // ==================================================

    case "STOP_RECOVERY":

      return {

        actionExecuted:
          false,

        actionType:
          "RECOVERY_STOPPED",

        message:
          "No further recovery action will be taken."
      };


    // ==================================================
    // HUMAN ESCALATION
    // ==================================================

    case "HUMAN_REVIEW":

      return {

        actionExecuted:
          false,

        actionType:
          "HUMAN_REVIEW",

        message:
          "Autonomous execution stopped. Case escalated for human review."
      };


    // ==================================================
    // UNKNOWN
    // ==================================================

    default:

      return {

        actionExecuted:
          false,

        actionType:
          "UNKNOWN",

        message:
          "Recovery action could not be executed."
      };
  }
}


module.exports = {
  executeRecoveryAction
};