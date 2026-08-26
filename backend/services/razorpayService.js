async function createRecoveryPaymentLink(payment) {

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
          payment.amount * 100,

        currency:
          "INR",

        accept_partial:
          false,

        reference_id:
          `recoverai_${payment.paymentId}_${Date.now()}`,

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