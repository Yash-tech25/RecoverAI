const crypto = require("crypto");


function verifyRazorpayWebhook(
  rawBody,
  receivedSignature
) {

  const secret =
    process.env.RAZORPAY_WEBHOOK_SECRET;


  if (!secret) {
    throw new Error(
      "Razorpay webhook secret is missing"
    );
  }


  if (!receivedSignature) {
    return false;
  }


  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(rawBody)
      .digest("hex");


  const expectedBuffer =
    Buffer.from(expectedSignature);

  const receivedBuffer =
    Buffer.from(receivedSignature);


  // timingSafeEqual throws if lengths differ
  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    return false;
  }


  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );
}


module.exports = {
  verifyRazorpayWebhook
};