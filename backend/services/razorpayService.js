async function createRecoveryPaymentLink(payment) {


    // ====================================================
  // VALIDATE PAYMENT AMOUNT
  // ====================================================

  const numericAmount =
    Number(
      payment?.amount
    );


  if (
    !Number.isFinite(
      numericAmount
    ) ||
    numericAmount <= 0
  ) {

    throw new Error(
      "A valid positive payment amount is required."
    );
  }


  /*
    Razorpay expects INR amounts in paise.

    Math.round protects the API request from
    JavaScript floating-point representation issues.
  */

  const amountInPaise =
    Math.round(
      numericAmount * 100
    );


  if (
    !Number.isSafeInteger(
      amountInPaise
    ) ||
    amountInPaise <= 0
  ) {

    throw new Error(
      "Payment amount could not be converted safely to paise."
    );
  }


  const keyId =
    process.env.RAZORPAY_KEY_ID;

  const keySecret =
    process.env.RAZORPAY_KEY_SECRET;


  if (!keyId || !keySecret) {

    throw new Error(
      "Razorpay API credentials are missing"
    );
  }


  const credentials =
    Buffer
      .from(`${keyId}:${keySecret}`)
      .toString("base64");


  const response = await fetch(
    "https://api.razorpay.com/v1/payment_links",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        Authorization:
          `Basic ${credentials}`
      },

      body: JSON.stringify({

        amount:
  amountInPaise,

        currency:
          "INR",

        accept_partial:
          false,

        reference_id:
  `rai_${payment.paymentId.slice(-15)}_${Date.now().toString().slice(-8)}`,

        description:
          `RecoverAI recovery payment for ${payment.paymentId}`,

        notes: {
          paymentId:
            payment.paymentId,

          customerId:
            payment.customerId,

          source:
            "RecoverAI"
        }
      })
    }
  );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data?.error?.description ||
      "Razorpay Payment Link creation failed"
    );
  }


  return {
    paymentLinkId:
      data.id,

    shortUrl:
      data.short_url,

    status:
      data.status
  };
}


module.exports = {
  createRecoveryPaymentLink
};