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


function createStateTransitionAuditLog({
  payment = {},
  previousState = null,
  nextState = {},
  event,
  actionType = "STATE_TRANSITION",
  actionMessage,
  explanation,
  metadata = {}
}) {

  const paymentId =
    payment.paymentId ||
    nextState.paymentId ||
    previousState?.paymentId ||
    null;


  const customerId =
    payment.customerId ||
    nextState.customerId ||
    previousState?.customerId ||
    null;


  const amount =
    Number(
      payment.amount ??
      nextState.amount ??
      nextState.promise?.promisedAmount ??
      previousState?.amount ??
      previousState?.promise?.promisedAmount ??
      0
    );


  const log = {

    paymentId,

    customerId,

    amount,

    event,

    recoveryAction:
      nextState.recoveryAction ||
      null,

    explanation:
      explanation ||
      nextState.explanation ||
      "",

    actionExecuted:
      true,

    actionType,

    actionMessage,

    previousOutcome:
      previousState?.outcome ||
      null,

    previousRecoveryAction:
      previousState?.recoveryAction ||
      null,

    outcome:
      nextState.outcome ||
      previousState?.outcome ||
      null,

    recovered:
      nextState.outcome ===
      "RECOVERED",

    recoveredAmount:
      nextState.outcome ===
      "RECOVERED"
        ? amount
        : 0,

    metadata,

    timestamp:
      new Date()
  };


  if (
    nextState.promise
  ) {

    log.promise = {

      promisedAmount:
        nextState.promise.promisedAmount,

      promisedDate:
        nextState.promise.promisedDate,

      promiseStatus:
        nextState.promise.promiseStatus,

      language:
        nextState.promise.language,

      confidence:
        nextState.promise.confidence
    };
  }


  if (
    nextState.callback
  ) {

    log.callback = {
      ...nextState.callback
    };
  }


  if (
    nextState.paymentLinkId ||
    nextState.razorpayPaymentId
  ) {

    log.razorpay = {

      paymentLinkId:
        nextState.paymentLinkId ||
        null,

      razorpayPaymentId:
        nextState.razorpayPaymentId ||
        null
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

  createStateTransitionAuditLog,

  createWebhookAuditLog,

  saveAuditLogs,

  getAuditLogs
};