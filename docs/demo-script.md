# RecoverAI Demo Script

## 1. Introduction

RecoverAI is an AI-assisted revenue recovery agent built for the Razorpay AI Buildathon Revenue Recovery track.

The core idea is simple: instead of treating every failed payment the same way, RecoverAI analyzes the failure context and chooses the most suitable recovery strategy.

It combines deterministic business rules, Gemini-based reasoning, policy guardrails, Razorpay Test Mode payment recovery, MongoDB state tracking, and live analytics.

In this demo, I will show the complete flow from a failed payment to an autonomous recovery decision and finally a Razorpay-confirmed recovered payment.

---

## 2. Dashboard Overview

Start on the RecoverAI dashboard.

Explain that the dashboard gives a high-level view of the current revenue recovery situation.

Show:

- total payments
- recovery cases
- revenue at risk
- recovered revenue
- pending recovery payments
- recovery rate
- strategy performance
- recent recovery activity

Mention that RecoverAI clearly separates Razorpay-confirmed Test Mode recoveries from simulated recovery outcomes so the dashboard does not present projected or simulated results as real recovered revenue.

---

## 3. Create a Recovery Case

Open the Recovery Cases page and create a new failed payment case.

Use a case such as:

- Customer Type: Returning
- Amount: ₹5000
- Payment Method: Card
- Failure Reason: Issuer Declined
- Previous Attempts: 1

Explain that this case is intentionally not covered by the simple deterministic rules, so RecoverAI can demonstrate the AI-assisted decision path.

After creating the case, click **Run RecoverAI Agent**.

---

## 4. Explain the AI Decision

After the agent runs, show the generated result.

For an issuer-declined case, RecoverAI may produce:

```text
SEND_ALTERNATIVE_PAYMENT_METHOD
```

Explain that:

- the deterministic rule engine first checks whether the failure matches a known rule
- if it does not, the case is sent to Gemini for analysis
- Gemini returns a diagnosis, recommended action, confidence score, and reasoning
- the recommendation is not executed blindly
- it must pass the confidence threshold and policy guardrails first

Point out the AI explanation shown in the interface and the confidence score.

Mention that the autonomous AI confidence threshold is:

```text
0.75
```

If confidence is below the threshold, the case is escalated to:

```text
HUMAN_REVIEW
```

---

## 5. Show the Razorpay Recovery Action

For the alternative-payment-method strategy, RecoverAI creates a Razorpay Test Mode Payment Link.

Show that the case changes to:

```text
PENDING_PAYMENT
```

Explain that this does not count as recovered revenue yet.

Open the Razorpay Recovery Link.

Mention that this is a real Razorpay Test Mode payment flow rather than a simulated payment confirmation.

---

## 6. Complete the Test Payment

Complete the Razorpay Test Mode payment.

After payment succeeds, return to RecoverAI.

The frontend polls the backend and should automatically update the case from:

```text
PENDING_PAYMENT
```

to:

```text
RECOVERED
```

Explain that Razorpay sends a:

```text
payment_link.paid
```

webhook to the deployed RecoverAI backend.

The backend verifies the Razorpay webhook signature before changing the recovery state.

Only after the signed webhook is successfully processed is the payment counted as a Razorpay-confirmed Test Mode recovery.

---

## 7. Explain Webhook Security

Briefly explain the webhook safeguards.

RecoverAI uses:

- raw request-body handling
- HMAC SHA-256 signature verification
- payment-link matching
- idempotency protection
- automatic state updates
- audit logging

Mention that duplicate webhook deliveries cannot mark the same case as recovered multiple times.

---

## 8. Show Recovery Guardrails

Demonstrate or explain the bounded automation rules.

### Low AI Confidence

If AI confidence is below `0.75`:

```text
HUMAN_REVIEW
```

No autonomous recovery action is executed.

### Autonomous Recovery Limit

RecoverAI allows a maximum of two autonomous recovery attempts.

After repeated failed autonomous interventions:

```text
RECOVERY_FAILED
        ↓
HUMAN_REVIEW
```

### Original Payment Attempt Hard Stop

If the original payment already has:

```text
attemptCount >= 3
```

RecoverAI selects:

```text
STOP_RECOVERY
```

This prevents repeatedly disturbing a customer or continuously retrying an unhealthy payment.

### Protected States

Cases in these states are protected from further automatic processing:

```text
RECOVERED
STOPPED
PENDING_PAYMENT
HUMAN_REVIEW
```

---

## 9. Show Analytics

Open the Analytics page.

Explain the two separate types of evidence.

### Live Recovery Analytics

These metrics come from cases actually processed through RecoverAI.

Show examples such as:

- Razorpay-confirmed Test Mode recovery
- simulated recovery
- pending Razorpay payments
- processed cases
- strategy performance

Explain that simulated recovery outcomes are not mixed with Razorpay-confirmed recovered revenue.

### Safe Synthetic Benchmark

Show the fixed 50-payment benchmark.

Current benchmark:

```text
50 synthetic payments
42 recovery cases
Revenue at risk: ₹2,33,600
Recoverable cases: 37
Projected recovered cases: 18
Projected recovered revenue: ₹96,000
Projected recovery rate: 42.86%
Human review cases: 1
Stopped cases: 4
```

Clearly state:

> The 42.86% value is a projected synthetic recovery rate, not a claim about production merchant performance.

The benchmark is intentionally side-effect free:

```text
0 Gemini API calls
0 Razorpay Payment Links
0 recovery-state mutations
0 audit-log mutations
```

This allows the recovery logic to be evaluated repeatedly without generating external actions.

---

## 10. Show the Audit Trail

Open the Audit Trail page.

Explain that RecoverAI records recovery activity for traceability.

Audit events can include:

- payment ID
- selected strategy
- decision reasoning
- execution result
- recovery outcome
- payment confirmation events
- timestamps

Point out the webhook-related audit event from the Razorpay-confirmed recovery if it is visible.

Explain that this provides an observable history of what the agent decided and what happened afterward.

---

## 11. Brief Architecture Explanation

Show the architecture diagram if needed.

Summarize the architecture as:

```text
React + Vite Frontend
        ↓
Node.js + Express Backend
        ↓
Rule Engine / Gemini / Policy Guardrails
        ↓
Recovery Executor
        ↓
MongoDB Atlas + Razorpay Test Mode
        ↓
Webhook Confirmation
        ↓
Audit Trail + Analytics
```

Deployment:

- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas
- AI: Google Gemini
- Payments: Razorpay Test Mode

---

## 12. Closing Pitch

RecoverAI is designed as a bounded revenue recovery agent rather than an unrestricted AI system.

It combines deterministic rules for predictable failures with Gemini reasoning for uncertain cases, but every AI-driven action is still controlled by confidence thresholds, stopping rules, protected states, and auditability.

The system demonstrates the complete recovery lifecycle:

```text
Detect revenue at risk
        ↓
Choose an intervention
        ↓
Apply safety guardrails
        ↓
Execute the recovery action
        ↓
Observe the payment result
        ↓
Update persistent state
        ↓
Measure recovered revenue
```

The goal is not simply to retry failed payments, but to choose the right intervention while keeping autonomous recovery measurable, explainable, and bounded.

---

## Recommended Demo Order

For a short judging demo, follow this order:

1. Introduce the problem and RecoverAI in about 20–30 seconds.
2. Show the Dashboard briefly.
3. Create an issuer-declined recovery case.
4. Run RecoverAI Agent.
5. Explain Gemini diagnosis, confidence gating, and policy approval.
6. Open the generated Razorpay Test Mode recovery link.
7. Complete the payment.
8. Show the automatic `PENDING_PAYMENT → RECOVERED` transition.
9. Briefly show Analytics and explain the live-vs-synthetic separation.
10. Briefly show the Audit Trail.
11. End with the bounded-agent and revenue-recovery pitch.

The Razorpay-confirmed recovery flow should be the main highlight of the demo.
