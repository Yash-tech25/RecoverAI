# RecoverAI — 5-Minute Demo Script

> **Demo goal:** prove the bounded agentic loop, real Razorpay Test Mode recovery evidence, conversational Promise-to-Pay, safety controls, analytics, and auditability without depending on a risky fresh payment-link creation during judging.

## Before the Demo

Keep these ready:

- Dashboard
- Recovery Cases
- Promise Tracker
- Analytics
- Audit Trail
- architecture diagram
- one existing Razorpay-confirmed `RECOVERED` case with a Razorpay Payment ID and webhook audit event

If the Razorpay Test Mode Payment Link quota has already been reached, **do not try to create a fresh link during the demo**.

---

## 0:00–0:25 — Problem + Pitch

**Say:**

“RecoverAI is a bounded, multi-channel agentic revenue recovery system built for the Razorpay AI Buildathon Revenue Recovery track.

Instead of treating every failed payment the same way, it observes the payment context, routes the case to the right recovery channel, applies guardrails, takes an action, observes the result or customer commitment, persists the state, and then continues, escalates, or stops.”

**Show:** Dashboard.

---

## 0:25–0:50 — Live Revenue View

Briefly show revenue at risk, Razorpay-confirmed recovered revenue, confirmed recovery rate, simulated recovery, pending Razorpay payments, and processed vs unprocessed cases.

**Say:**

“Razorpay-confirmed Test Mode recovery is separated from simulated outcomes and from the synthetic benchmark. A payment link is not counted as recovered just because it was created.”

---

## 0:50–1:50 — Conversational Recovery → Promise-to-Pay

Open **Recovery Cases**.

Use an existing clean insufficient-funds case, or create one if needed:

```text
Status: failed
Failure reason: insufficient_funds
Attempt count: 1
Customer type: returning
```

Run RecoverAI.

**Say:**

“Insufficient funds is a known case, so the deterministic router sends it to conversational recovery instead of blindly retrying the payment.”

Use:

```text
I don't have enough balance today. I can pay tomorrow.
```

**Say:**

“Gemini is not given unrestricted control. It classifies the customer intent into a bounded schema. Here it identifies a Promise-to-Pay and the backend converts that into a controlled state transition.”

Show the resulting **PROMISE TO PAY** state.

If Gemini is slow or unavailable, switch immediately to an already-completed Promise-to-Pay case and continue.

---

## 1:50–2:20 — Promise Tracker

Open **Promise Tracker** and search the same payment ID.

Show promised amount, promised date, status, analysis confidence, and conversation summary.

**Say:**

“The commitment is persisted, not just displayed in the chat. RecoverAI tracks Promise-to-Pay through ACTIVE, DUE, KEPT, BROKEN, or CANCELLED states, with guarded transitions and a 24-hour grace period.”

---

## 2:20–2:55 — Safety / Human Escalation

Open a previously tested **HUMAN_REVIEW** or **STOPPED** case.

Good examples are low confidence, payment already made, dispute, or an uncertain processor response.

**Say:**

“AI-assisted routing must meet a 0.75 confidence threshold. Low-confidence or sensitive cases go to human review. The AI router cannot choose STOP_RECOVERY — hard stopping remains deterministic. If the original payment already has three or more attempts, RecoverAI stops further automated recovery.”

---

## 2:55–3:45 — Razorpay-Confirmed Recovery

Open an existing Razorpay-confirmed **RECOVERED** case.

Show the outcome, Razorpay Payment Link information, Razorpay Payment ID, recovery timestamp, and audit evidence.

**Say:**

“For eligible payment-recovery cases, RecoverAI can create a real Razorpay Test Mode Payment Link. Creating the link only moves the case to PENDING_PAYMENT.

The case becomes recovered only after Razorpay sends `payment_link.paid` to the deployed backend. RecoverAI verifies the HMAC SHA-256 signature, matches the payment link, handles duplicate deliveries idempotently, stores the Razorpay Payment ID, and only then moves the case to RECOVERED.”

Always say **Razorpay Test Mode**, not live-money recovery.

---

## 3:45–4:20 — Analytics + Benchmark

Open **Analytics**.

At the final verification point, the system showed:

```text
Razorpay-confirmed recovered revenue: ₹22,599
Razorpay-confirmed recovered cases: 6
```

Then show the fixed benchmark:

```text
50 synthetic payments
42 recovery cases
Revenue at risk: ₹2,33,600
Projected recovered cases: 18
Projected recovered revenue: ₹96,000
Projected recovery rate: 42.86%
```

**Say:**

“The 42.86% figure is a projected synthetic recovery rate, not a production claim. The benchmark is side-effect free: it makes zero Gemini calls, creates zero Razorpay links, and does not mutate recovery state or audit logs.”

---

## 4:20–4:40 — Audit Trail

Open **Audit Trail** and search either the Promise-to-Pay case or the Razorpay-confirmed recovered case.

**Say:**

“The audit trail records what the system decided and what happened afterward. Recovery decisions, conversation actions, promise events, callbacks, and webhook confirmations are appended chronologically rather than rewriting history.”

Show at least two connected events for the same payment.

---

## 4:40–5:00 — Architecture + Close

Show the architecture diagram.

**Say:**

“The frontend is React on Vercel, the backend is Node and Express on Render, state is stored in MongoDB Atlas, Gemini handles bounded uncertain reasoning and conversation analysis, and Razorpay Test Mode provides the payment recovery path.

The key loop is: observe, diagnose, route, guard, act, observe the result, persist state, and then continue, escalate, or stop.

RecoverAI is not just a retry tool. It is a bounded recovery agent designed to make recovery measurable, explainable, and safe.”

Stop here.

---

## Judge Q&A Cheat Sheet

**Why hybrid rules + AI?**  
Known cases are faster and more predictable with rules. Gemini is reserved for ambiguity and customer-language understanding.

**What happens if Gemini fails?**  
The system uses bounded timeouts/retries and safely falls back to `HUMAN_REVIEW`.

**Why separate channel routing and action selection?**  
A case can clearly need payment recovery while the exact intervention is still uncertain. Separating the decisions improves control and auditability.

**How do you prevent duplicate recovery actions?**  
A MongoDB-backed recovery lock prevents simultaneous processing for the same payment. Protected states and idempotent operations add further protection.

**How do you prevent duplicate webhook recovery?**  
The webhook is signature-verified and recovered-state handling is idempotent.

**Is 42.86% real merchant performance?**  
No. It is a fixed synthetic benchmark projection. Razorpay-confirmed Test Mode recovery is reported separately.

**Are you making phone calls?**  
No. Conversational recovery is handled through the application interface; callback requests are persisted as bounded recovery actions.

---

## Demo Fallback Plan

1. **Gemini slow/503:** show an already-completed AI/conversation case and explain the safe fallback.
2. **Razorpay Payment Link quota reached:** show the existing Razorpay-confirmed recovered case, Payment ID, webhook event, and analytics.
3. **Render cold start:** open the backend root first, wait for it to wake, then reload the frontend.
4. **Running out of time:** prioritize Dashboard → Promise-to-Pay → Razorpay-confirmed recovery → Analytics → Architecture.

The demo should prove the system's behavior, not depend on an external service cooperating in real time.
