const {
  getDB,
} = require("../db");


// ======================================================
// VALIDATION CONFIGURATION
// ======================================================

const ALLOWED_CUSTOMER_TYPES = [
  "new",
  "returning"
];


const ALLOWED_STATUSES = [
  "failed",
  "abandoned",
  "success"
];


const ALLOWED_METHODS = [
  "card",
  "upi",
  null
];


const ALLOWED_FAILURE_REASONS = [
  "timeout",
  "insufficient_funds",
  "checkout_abandoned",
  "bank_restriction",
  "issuer_declined",
  "processor_response_unclear",
  null
];


// ======================================================
// VALIDATE PAYMENT INPUT
// ======================================================

function validatePayment(
  payment
) {

  if (
    !payment ||
    typeof payment !==
      "object"
  ) {

    throw new Error(
      "Invalid payment payload"
    );
  }


  if (
    typeof payment.paymentId !==
      "string"
    ||
    payment.paymentId.trim() ===
      ""
  ) {

    throw new Error(
      "Invalid paymentId"
    );
  }


  if (
    typeof payment.customerId !==
      "string"
    ||
    payment.customerId.trim() ===
      ""
  ) {

    throw new Error(
      "Invalid customerId"
    );
  }


  if (
    !ALLOWED_CUSTOMER_TYPES.includes(
      payment.customerType
    )
  ) {

    throw new Error(
      "Invalid customerType"
    );
  }


  if (
    typeof payment.amount !==
      "number"
    ||
    !Number.isFinite(
      payment.amount
    )
    ||
    payment.amount <= 0
  ) {

    throw new Error(
      "Amount must be a positive number"
    );
  }


  if (
    !ALLOWED_STATUSES.includes(
      payment.status
    )
  ) {

    throw new Error(
      "Invalid payment status"
    );
  }


  if (
    !ALLOWED_METHODS.includes(
      payment.method ?? null
    )
  ) {

    throw new Error(
      "Invalid payment method"
    );
  }


  if (
    !ALLOWED_FAILURE_REASONS.includes(
      payment.failureReason ?? null
    )
  ) {

    throw new Error(
      "Invalid failure reason"
    );
  }


  if (
    !Number.isInteger(
      payment.attemptCount
    )
    ||
    payment.attemptCount < 0
    ||
    payment.attemptCount > 20
  ) {

    throw new Error(
      "attemptCount must be an integer between 0 and 20"
    );
  }


  /*
    Successful payments should not carry a
    failure reason.

    Failed or abandoned payments must provide
    one so RecoverAI can determine how to route
    the recovery.
  */

  if (
    payment.status ===
      "success"
    &&
    payment.failureReason
  ) {

    throw new Error(
      "Successful payment cannot contain a failure reason"
    );
  }


  if (
    payment.status !==
      "success"
    &&
    !payment.failureReason
  ) {

    throw new Error(
      "Failed or abandoned payment requires a failure reason"
    );
  }


  /*
    checkout_abandoned may not have a payment
    method because the customer can leave before
    choosing one.

    Other failed payment types should normally
    identify the attempted method.
  */

  if (
    payment.failureReason !==
      "checkout_abandoned"
    &&
    payment.status !==
      "success"
    &&
    !payment.method
  ) {

    throw new Error(
      "Payment method is required for this failure type"
    );
  }
}


// ======================================================
// NORMALIZE PAYMENT
// ======================================================

function normalizePayment(
  payment
) {

  return {

    paymentId:
      payment.paymentId.trim(),

    customerId:
      payment.customerId.trim(),

    customerType:
      payment.customerType,

    amount:
      payment.amount,

    status:
      payment.status,

    method:
      payment.method ?? null,

    failureReason:
      payment.failureReason ?? null,

    attemptCount:
      payment.attemptCount
  };
}


// ======================================================
// SYNC SYNTHETIC SEED PAYMENTS
// ======================================================

async function seedPayments(
  payments
) {

  const db =
    getDB();


  const collection =
    db.collection(
      "payments"
    );


  let insertedCount =
    0;


  let existingCount =
    0;


  for (
    const payment of
    payments
  ) {

    /*
      The bundled synthetic dataset is treated
      as trusted application data.

      We preserve existing records so previous
      Razorpay demo cases and manually created
      payments are not overwritten.
    */

    const existingPayment =
      await collection.findOne({

        paymentId:
          payment.paymentId
      });


    if (
      existingPayment
    ) {

      existingCount++;

      continue;
    }


    await collection.insertOne(
      payment
    );


    insertedCount++;
  }


  console.log(
    `Payment seed sync completed: ${insertedCount} inserted, ${existingCount} already existed`
  );
}


// ======================================================
// GET ALL PAYMENTS
// ======================================================

async function getAllPayments() {

  const db =
    getDB();


  return await db
    .collection(
      "payments"
    )
    .find({})
    .sort({
      paymentId:
        1
    })
    .toArray();
}


// ======================================================
// GET ONE PAYMENT
// ======================================================

async function getPaymentById(
  paymentId
) {

  const db =
    getDB();


  return await db
    .collection(
      "payments"
    )
    .findOne({
      paymentId
    });
}


// ======================================================
// CREATE PAYMENT
// ======================================================

async function createPayment(
  payment
) {

  const db =
    getDB();


  validatePayment(
    payment
  );


  const normalizedPayment =
    normalizePayment(
      payment
    );


  const existingPayment =
    await db
      .collection(
        "payments"
      )
      .findOne({

        paymentId:
          normalizedPayment
            .paymentId
      });


  if (
    existingPayment
  ) {

    throw new Error(
      "Payment ID already exists"
    );
  }


  await db
    .collection(
      "payments"
    )
    .insertOne(
      normalizedPayment
    );


  return normalizedPayment;
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  seedPayments,

  getAllPayments,

  getPaymentById,

  createPayment,

  validatePayment
};