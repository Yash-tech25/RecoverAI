const { getDB } = require("../db");


function createAuditLog(
  payment,
  recoveryAction,
  explanation,
  executionResult,
  recoveryResult
) {

  const log = {

    paymentId: payment.paymentId,
    customerId: payment.customerId,
    amount: payment.amount,

    event: "RECOVERY_PROCESSED",

    recoveryAction,

    explanation,

    actionExecuted:
      executionResult.actionExecuted,

    actionType:
      executionResult.actionType,

    actionMessage:
      executionResult.message,

    outcome:
      recoveryResult.outcome,

    recovered:
      recoveryResult.recovered,

    recoveredAmount:
      recoveryResult.recoveredAmount,

    timestamp:
      new Date()
  };


  if (executionResult.paymentLinkId) {

    log.razorpay = {

      paymentLinkId:
        executionResult.paymentLinkId,

      paymentLinkUrl:
        executionResult.paymentLinkUrl,

      paymentLinkStatus:
        executionResult.paymentLinkStatus
    };
  }


  return log;
}


function createWebhookAuditLog(
  recoveryState,
  razorpayPaymentId
) {

  return {

    paymentId:
      recoveryState.paymentId,

    customerId:
      recoveryState.customerId,

    event:
      "RAZORPAY_PAYMENT_CONFIRMED",

    recoveryAction:
      recoveryState.recoveryAction,

    actionExecuted:
      true,

    actionType:
      "RAZORPAY_WEBHOOK",

    actionMessage:
      "Razorpay confirmed payment through recovery link.",

    outcome:
      "RECOVERED",

    recovered:
      true,

    razorpay: {

      paymentLinkId:
        recoveryState.paymentLinkId,

      razorpayPaymentId
    },

    timestamp:
      new Date()
  };
}


async function saveAuditLogs(logs) {

  const db = getDB();

  const collection =
    db.collection("auditLogs");


  if (logs.length === 0) {
    return;
  }


  await collection.insertMany(logs);
}


async function getAuditLogs() {

  const db = getDB();


  return await db
    .collection("auditLogs")
    .find({})
    .sort({
      timestamp: 1
    })
    .toArray();
}


module.exports = {

  createAuditLog,

  createWebhookAuditLog,

  saveAuditLogs,

  getAuditLogs
};