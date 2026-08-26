import { useEffect, useMemo, useState } from "react";
import axios from "axios";

axios.defaults.baseURL =
  import.meta.env.VITE_API_URL || "";

import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Plus,
  Play,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
  WalletCards,
  Zap,
} from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import "./App.css";


function App() {

  const [activePage, setActivePage] =
    useState("dashboard");

  const [summary, setSummary] =
    useState(null);

  const [states, setStates] =
    useState([]);

  const [cases, setCases] =
    useState([]);

  const [auditLogs, setAuditLogs] =
    useState([]);

  const [batchEvaluation, setBatchEvaluation] =
    useState(null);

  const [batchError, setBatchError] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");


  const loadDashboard = async (
    showLoading = true
  ) => {

    try {

      if (showLoading) {
        setLoading(true);
      }

      setError("");


      const [
        summaryResponse,
        statesResponse,
        casesResponse,
        auditResponse,
      ] = await Promise.all([

        axios.get(
          "/api/recovery-summary"
        ),

        axios.get(
          "/api/recovery-states"
        ),

        axios.get(
          "/api/recovery-cases"
        ),

        axios.get(
          "/api/audit-logs"
        ),

      ]);


      setSummary(
        summaryResponse.data
      );

      setStates(
        statesResponse.data
      );

      setCases(
        casesResponse.data
      );

      setAuditLogs(
        auditResponse.data
      );

    } catch (err) {

      console.error(err);

      setError(
        "Could not load RecoverAI data."
      );

    } finally {

      if (showLoading) {
        setLoading(false);
      }
    }
  };


  // ====================================================
  // LOAD SAFE SYNTHETIC BATCH EVALUATION
  // ====================================================

  const loadBatchEvaluation =
    async () => {

      try {

        setBatchError("");

        const response =
          await axios.get(
            "/api/batch-evaluation"
          );

        setBatchEvaluation(
          response.data
        );

      } catch (error) {

        console.error(
          "Batch evaluation load failed:",
          error
        );

        setBatchError(
          "Synthetic benchmark could not be loaded."
        );
      }
    };


  // ====================================================
  // INITIAL LOAD + AUTO REFRESH
  // ====================================================

  useEffect(() => {

    loadDashboard();

    loadBatchEvaluation();


    const interval =
      setInterval(() => {

        loadDashboard(false);

      }, 5000);


    return () => {

      clearInterval(interval);

    };

  }, []);


  // ====================================================
  // MAP PAYMENT ID -> CURRENT RECOVERY STATE
  // ====================================================

  const stateMap = useMemo(() => {

    const map = new Map();


    states.forEach(
      (state) => {

        map.set(
          state.paymentId,
          state
        );
      }
    );


    return map;

  }, [states]);


  // ====================================================
  // MERGE PAYMENT DATA + LATEST RECOVERY STATE
  // ====================================================

  const recoveryCases = useMemo(() => {

    return cases

      .filter(
        (payment) =>
          payment.status !== "success"
      )

      .map(
        (payment) => {

          const state =
            stateMap.get(
              payment.paymentId
            );


          return {

            ...payment,

            currentOutcome:
              state?.outcome ||
              "NOT_PROCESSED",

            currentAction:
              state?.recoveryAction ||
              payment.recoveryAction,

            recoveryAttempts:
              state?.recoveryAttempts || 0,

            paymentLinkId:
              state?.paymentLinkId || null,

            paymentLinkUrl:
              state?.paymentLinkUrl || null,

            paymentLinkStatus:
              state?.paymentLinkStatus || null,

            razorpayPaymentId:
              state?.razorpayPaymentId || null,

            processedAt:
              state?.processedAt || null,

            recoveredAt:
              state?.recoveredAt || null,

            decisionExplanation:
              state?.explanation ||

              (
                state?.outcome ===
                "HUMAN_REVIEW"

                  ?

                  `RecoverAI escalated this case for human review after ${state?.recoveryAttempts || 0} recovery attempts. No further autonomous recovery action will be taken.`

                  :

                  payment.explanation
              ),
          };
        }
      );

  }, [cases, stateMap]);


  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {

    return (
      <div className="center-screen">

        <div className="loader"></div>

        <p>
          Loading RecoverAI...
        </p>

      </div>
    );
  }


  // ====================================================
  // ERROR
  // ====================================================

  if (error) {

    return (
      <div className="center-screen">

        <h2>
          Unable to load dashboard
        </h2>

        <p>
          {error}
        </p>

        <button
          onClick={() =>
            loadDashboard()
          }
          className="primary-button"
        >
          Try Again
        </button>

      </div>
    );
  }


  // ====================================================
  // APP
  // ====================================================

  return (

    <div className="app">

      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
      />


      <main className="main">

        <Topbar
          activePage={activePage}

          loadDashboard={() =>
            loadDashboard()
          }
        />


        {
          activePage === "dashboard" &&
          (
            <DashboardPage
              summary={summary}
              states={states}
            />
          )
        }


        {
          activePage === "cases" &&
          (
            <RecoveryCasesPage

              recoveryCases={
                recoveryCases
              }

              refreshData={() =>
                loadDashboard(false)
              }
            />
          )
        }


        {
          activePage === "analytics" &&
          (
            <AnalyticsPage
              summary={summary}

              batchEvaluation={
                batchEvaluation
              }

              batchError={
                batchError
              }

              refreshBatch={
                loadBatchEvaluation
              }
            />
          )
        }


        {
          activePage === "audit" &&
          (
            <AuditPage
              auditLogs={
                auditLogs
              }
            />
          )
        }

      </main>

    </div>
  );
}


// ======================================================
// SIDEBAR
// ======================================================

function Sidebar({
  activePage,
  setActivePage
}) {

  const menuItems = [

    {
      id: "dashboard",
      label: "Dashboard",
      icon: <Activity size={18} />
    },

    {
      id: "cases",
      label: "Recovery Cases",
      icon: <WalletCards size={18} />
    },

    {
      id: "analytics",
      label: "Analytics",
      icon: <TrendingUp size={18} />
    },

    {
      id: "audit",
      label: "Audit Trail",
      icon: <ShieldCheck size={18} />
    }

  ];


  return (

    <aside className="sidebar">

      <div className="brand">

        <div className="brand-icon">
          <Zap size={22} />
        </div>


        <div>

          <h2>
            RecoverAI
          </h2>

          <span>
            Revenue Recovery Agent
          </span>

        </div>

      </div>


      <nav>

        {
          menuItems.map(
            (item) => (

              <button

                key={item.id}

                className={
                  `nav-item ${
                    activePage === item.id
                      ? "active"
                      : ""
                  }`
                }

                onClick={() =>
                  setActivePage(
                    item.id
                  )
                }
              >

                {item.icon}

                {item.label}

              </button>

            )
          )
        }

      </nav>


      <div className="sidebar-status">

        <span className="status-dot"></span>


        <div>

          <strong>
            Agent Online
          </strong>

          <p>
            Razorpay Test Mode
          </p>

        </div>

      </div>

    </aside>
  );
}


// ======================================================
// TOP BAR
// ======================================================

function Topbar({
  activePage,
  loadDashboard
}) {

  const pageInfo = {

    dashboard: {
      eyebrow:
        "AUTONOMOUS REVENUE RECOVERY",

      title:
        "Recovery Dashboard",

      subtitle:
        "Monitor revenue at risk, AI decisions and recovery outcomes."
    },

    cases: {
      eyebrow:
        "CASE INTELLIGENCE",

      title:
        "Recovery Cases",

      subtitle:
        "Inspect payment failures, AI recommendations and recovery states."
    },

    analytics: {
      eyebrow:
        "PERFORMANCE INTELLIGENCE",

      title:
        "Recovery Analytics",

      subtitle:
        "Measure recovery strategies and business impact."
    },

    audit: {
      eyebrow:
        "DECISION TRACEABILITY",

      title:
        "Audit Trail",

      subtitle:
        "Review every recovery decision, execution and outcome."
    }

  };


  const page =
    pageInfo[activePage];


  return (

    <header className="topbar">

      <div>

        <p className="eyebrow">
          {page.eyebrow}
        </p>

        <h1>
          {page.title}
        </h1>

        <p className="subtitle">
          {page.subtitle}
        </p>

      </div>


      <button
        className="refresh-button"
        onClick={loadDashboard}
      >

        <RefreshCcw size={17} />

        Refresh

      </button>

    </header>
  );
}


// ======================================================
// DASHBOARD
// ======================================================

function DashboardPage({
  summary,
  states
}) {

  const strategyData =
    Object.entries(
      summary?.strategyPerformance || {}
    ).map(
      ([action, data]) => ({

        action:
          shortActionName(action),

        successRate:
          data.successRate,

      })
    );


  const recentStates = [
    ...states
  ]

    .sort(
      (a, b) =>
        new Date(b.processedAt) -
        new Date(a.processedAt)
    )

    .slice(0, 8);


  return (

    <>

      <section className="metrics-grid">

        <MetricCard

          icon={
            <CircleDollarSign />
          }

          label="Revenue At Risk"

          value={
            formatMoney(
              summary.revenueAtRisk
            )
          }

          detail={
            `${summary.recoveryCases} recovery cases`
          }
        />


        <MetricCard

          icon={
            <TrendingUp />
          }

          label="Revenue Recovered"

          value={
            formatMoney(
              summary.recoveredRevenue
            )
          }

          detail={
            `${summary.recoveredCases} recovered cases`
          }
        />


        <MetricCard

          icon={
            <Activity />
          }

          label="Recovery Rate"

          value={
            `${summary.recoveryRate}%`
          }

          detail="Across recovery cases"
        />


        <MetricCard

          icon={
            <Clock3 />
          }

          label="Pending Payment"

          value={
            formatMoney(
              summary.pendingPaymentAmount
            )
          }

          detail="Awaiting customer payment"
        />

      </section>


      <section className="content-grid">

        <StrategyChart
          strategyData={
            strategyData
          }
        />


        <div className="panel agent-panel">

          <div className="agent-icon">
            <BrainCircuit size={28} />
          </div>


          <p className="eyebrow">
            AI AGENT STATUS
          </p>


          <h3>
            Recovery Agent Active
          </h3>


          <p>
            Rules handle deterministic
            failures while Gemini handles
            uncertain cases. Policy
            guardrails approve actions
            before Razorpay execution.
          </p>


          <div className="agent-stat">

            <span>
              Total Payments
            </span>

            <strong>
              {summary.totalPayments}
            </strong>

          </div>


          <div className="agent-stat">

            <span>
              Stopped Revenue
            </span>

            <strong>

              {
                formatMoney(
                  summary.stoppedAmount
                )
              }

            </strong>

          </div>

        </div>

      </section>


      <section className="panel">

        <div className="panel-header">

          <div>

            <h3>
              Recent Recovery States
            </h3>

            <p>
              Latest autonomous recovery
              activity
            </p>

          </div>


          <span className="case-count">
            {states.length} cases
          </span>

        </div>


        <RecoveryStateTable
          states={recentStates}
        />

      </section>

    </>
  );
}


// ======================================================
// RECOVERY CASES
// ======================================================

function RecoveryCasesPage({
  recoveryCases,
  refreshData
}) {

  /*
    IMPORTANT:

    We store only the ID of the selected payment.

    We DO NOT store the whole payment object because
    that object becomes stale when polling downloads
    an updated recovery state.
  */

  const [
    selectedPaymentId,
    setSelectedPaymentId
  ] = useState(null);


  const [
    showCreateCase,
    setShowCreateCase
  ] = useState(false);


  // ====================================================
  // QUEUE SEARCH + FILTERS
  // ====================================================

  const [
    searchTerm,
    setSearchTerm
  ] = useState("");


  const [
    statusFilter,
    setStatusFilter
  ] = useState("ALL");


  const [
    failureFilter,
    setFailureFilter
  ] = useState("ALL");


  const [
    processingFilter,
    setProcessingFilter
  ] = useState("ALL");


  /*
    Failure reasons are derived from the current queue,
    so the filter stays in sync with the data.
  */

  const failureReasons =
    useMemo(() => {

      return [
        ...new Set(
          recoveryCases
            .map(
              (payment) =>
                payment.failureReason
            )
            .filter(Boolean)
        )
      ].sort();

    }, [recoveryCases]);


  /*
    Filter the queue without changing the original data.
  */

  const filteredCases =
    useMemo(() => {

      const normalizedSearch =
        searchTerm
          .trim()
          .toLowerCase();


      return recoveryCases.filter(
        (payment) => {

          const matchesSearch =
            normalizedSearch === ""

            ||

            payment.paymentId
              ?.toLowerCase()
              .includes(
                normalizedSearch
              )

            ||

            payment.customerId
              ?.toLowerCase()
              .includes(
                normalizedSearch
              );


          const matchesStatus =
            statusFilter === "ALL"

            ||

            payment.currentOutcome ===
            statusFilter;


          const matchesFailure =
            failureFilter === "ALL"

            ||

            payment.failureReason ===
            failureFilter;


          const matchesProcessing =

            processingFilter === "ALL"

            ||

            (
              processingFilter ===
              "PROCESSED"

              &&

              payment.currentOutcome !==
              "NOT_PROCESSED"
            )

            ||

            (
              processingFilter ===
              "UNPROCESSED"

              &&

              payment.currentOutcome ===
              "NOT_PROCESSED"
            );


          return (
            matchesSearch &&
            matchesStatus &&
            matchesFailure &&
            matchesProcessing
          );
        }
      );

    }, [
      recoveryCases,
      searchTerm,
      statusFilter,
      failureFilter,
      processingFilter
    ]);


  const hasActiveFilters =
    searchTerm.trim() !== ""

    ||

    statusFilter !== "ALL"

    ||

    failureFilter !== "ALL"

    ||

    processingFilter !== "ALL";


  const clearFilters =
    () => {

      setSearchTerm("");

      setStatusFilter("ALL");

      setFailureFilter("ALL");

      setProcessingFilter("ALL");
    };


  /*
    This is recalculated every time recoveryCases changes.

    Therefore if Razorpay webhook changes:
      PENDING_PAYMENT -> RECOVERED

    the open detail panel receives the new state automatically.
  */

  const selectedCase =
    recoveryCases.find(
      (payment) =>
        payment.paymentId ===
        selectedPaymentId
    ) || null;


  return (

    <section className="page-section">

      <div className="cases-toolbar">

        <div>

          <strong>
            Recovery Queue
          </strong>

          <span>
            Create and process payment failures
          </span>

        </div>


        <button
          className="create-case-button"

          onClick={() =>
            setShowCreateCase(true)
          }
        >

          <Plus size={17} />

          Create Recovery Case

        </button>

      </div>


      {/* ================================================
          QUEUE SEARCH + FILTERS
      ================================================= */}

      <div className="cases-controls">

        <input

          className="cases-search"

          type="text"

          value={searchTerm}

          placeholder="Search payment or customer ID..."

          onChange={
            (event) =>
              setSearchTerm(
                event.target.value
              )
          }
        />


        <select

          className="cases-filter"

          value={processingFilter}

          onChange={
            (event) =>
              setProcessingFilter(
                event.target.value
              )
          }
        >

          <option value="ALL">
            All Processing States
          </option>

          <option value="PROCESSED">
            Processed
          </option>

          <option value="UNPROCESSED">
            Unprocessed
          </option>

        </select>


        <select

          className="cases-filter"

          value={statusFilter}

          onChange={
            (event) =>
              setStatusFilter(
                event.target.value
              )
          }
        >

          <option value="ALL">
            All Outcomes
          </option>

          <option value="NOT_PROCESSED">
            Not Processed
          </option>

          <option value="PENDING_PAYMENT">
            Pending Payment
          </option>

          <option value="RECOVERED">
            Recovered
          </option>

          <option value="RECOVERY_FAILED">
            Recovery Failed
          </option>

          <option value="STOPPED">
            Stopped
          </option>

          <option value="HUMAN_REVIEW">
            Human Review
          </option>

        </select>


        <select

          className="cases-filter"

          value={failureFilter}

          onChange={
            (event) =>
              setFailureFilter(
                event.target.value
              )
          }
        >

          <option value="ALL">
            All Failure Reasons
          </option>


          {
            failureReasons.map(
              (reason) => (

                <option
                  key={reason}
                  value={reason}
                >

                  {
                    formatAction(
                      reason
                    )
                  }

                </option>

              )
            )
          }

        </select>


        {
          hasActiveFilters
          &&
          (
            <button

              className="clear-filters-button"

              onClick={
                clearFilters
              }
            >

              Clear

            </button>
          )
        }

      </div>


      <div className="panel">

        <div className="panel-header">

          <div>

            <h3>
              Payment Recovery Queue
            </h3>

            <p>
              Failures detected by RecoverAI
            </p>

          </div>


          <span className="case-count">

            {
              filteredCases.length
            }

            {" of "}

            {
              recoveryCases.length
            }

            {" cases"}

          </span>

        </div>


        <div className="table-container">

          <table>

            <thead>

              <tr>

                <th>
                  Payment
                </th>

                <th>
                  Amount
                </th>

                <th>
                  Failure
                </th>

                <th>
                  AI / Rule Action
                </th>

                <th>
                  Status
                </th>

                <th>
                  Details
                </th>

              </tr>

            </thead>


            <tbody>

              {
                filteredCases.length > 0

                  ?

                  filteredCases.map(
                    (payment) => (

                      <tr
                        key={
                          payment.paymentId
                        }
                      >

                        <td>

                          <div className="case-main">

                            <strong>
                              {
                                payment.paymentId
                              }
                            </strong>

                            <span>
                              {
                                payment.customerId
                              }
                            </span>

                          </div>

                        </td>


                        <td className="money-cell">

                          {
                            formatMoney(
                              payment.amount
                            )
                          }

                        </td>


                        <td>

                          <span className="failure-reason">

                            {
                              formatAction(
                                payment.failureReason ||
                                "Unknown"
                              )
                            }

                          </span>

                        </td>


                        <td>

                          {
                            payment.currentAction ===
                            "REVIEW"

                              ?

                              "AI Analysis Required"

                              :

                              formatAction(
                                payment.currentAction
                              )
                          }

                        </td>


                        <td>

                          <StatusBadge
                            status={
                              payment.currentOutcome
                            }
                          />

                        </td>


                        <td>

                          <button
                            className="secondary-button"

                            onClick={() =>
                              setSelectedPaymentId(
                                payment.paymentId
                              )
                            }
                          >

                            View

                          </button>

                        </td>

                      </tr>

                    )
                  )

                  :

                  (
                    <tr>

                      <td
                        colSpan="6"
                        className="empty-filter-state"
                      >

                        No recovery cases match the current filters.

                      </td>

                    </tr>
                  )
              }

            </tbody>

          </table>

        </div>

      </div>


      {
        selectedCase &&
        (
          <CaseDetailPanel

            payment={
              selectedCase
            }

            onClose={() =>
              setSelectedPaymentId(
                null
              )
            }

            refreshData={
              refreshData
            }
          />
        )
      }


      {
        showCreateCase &&
        (
          <CreateCaseModal

            onClose={() =>
              setShowCreateCase(
                false
              )
            }

            refreshData={
              refreshData
            }

            recoveryCases={
              recoveryCases
            }
          />
        )
      }

    </section>
  );
}


// ======================================================
// CREATE CASE
// ======================================================

function CreateCaseModal({
  onClose,
  refreshData,
  recoveryCases
}) {

  /*
    Generate ID once when modal is created.
  */

  const [generatedNumber] =
    useState(
      () =>
        Date.now()
          .toString()
          .slice(-6)
    );


  const [form, setForm] =
    useState({

      paymentId:
        `pay_${generatedNumber}`,

      customerId:
        `cust_${generatedNumber}`,

      customerType:
        "returning",

      amount:
        5000,

      method:
        "card",

      failureReason:
        "bank_restriction",

      attemptCount:
        1

    });


  const [submitting, setSubmitting] =
    useState(false);


  const [
    createdPayment,
    setCreatedPayment
  ] = useState(null);


  const [
    recoveryResult,
    setRecoveryResult
  ] = useState(null);


  const [formError, setFormError] =
    useState("");


  /*
    LIVE VERSION OF THE CREATED CASE.

    Polling updates recoveryCases every 5 seconds.

    Therefore this changes automatically after
    the Razorpay webhook changes the MongoDB state.
  */

  const liveCreatedCase =
    recoveryCases.find(
      (payment) =>
        payment.paymentId ===
        form.paymentId
    ) || null;


  /*
    Prefer latest backend state.

    Before polling sees the case, fall back
    to the immediate POST response.
  */

  const liveOutcome =

    liveCreatedCase?.currentOutcome ||

    recoveryResult
      ?.recoveryResult
      ?.outcome ||

    null;


  const livePaymentLink =
    liveCreatedCase?.paymentLinkUrl ||

    recoveryResult
      ?.executionResult
      ?.paymentLinkUrl ||

    null;


  const updateField =
    (event) => {

      const {
        name,
        value
      } = event.target;


      setForm(
        (previous) => ({

          ...previous,

          [name]:

            name === "amount" ||
            name === "attemptCount"

              ? Number(value)

              : value

        })
      );
    };


  // ====================================================
  // CREATE PAYMENT
  // ====================================================

  const createPaymentCase =
    async () => {

      try {

        setSubmitting(true);

        setFormError("");


        const response =
          await axios.post(
            "/api/payments",
            {

              ...form,

              status:
                "failed"
            }
          );


        setCreatedPayment(
          response.data.payment
        );


        await refreshData();

      } catch (error) {

        console.error(error);


        setFormError(

          error.response
            ?.data
            ?.message ||

          "Could not create recovery case."

        );

      } finally {

        setSubmitting(false);
      }
    };


  // ====================================================
  // RUN AGENT
  // ====================================================

  const runCreatedRecovery =
    async () => {

      try {

        setSubmitting(true);

        setFormError("");


        const response =
          await axios.post(

            `/api/recovery/${form.paymentId}`

          );


        setRecoveryResult(
          response.data
        );


        await refreshData();

      } catch (error) {

        console.error(error);


        setFormError(

          error.response
            ?.data
            ?.message ||

          "Recovery could not be processed."

        );

      } finally {

        setSubmitting(false);
      }
    };


  return (

    <div className="case-detail-overlay">

      <div className="create-case-card">

        <div className="detail-header">

          <div>

            <p className="eyebrow">
              NEW FAILURE EVENT
            </p>

            <h2>
              Create Recovery Case
            </h2>

          </div>


          <button
            className="close-button"
            onClick={onClose}
          >
            ×
          </button>

        </div>


        {/* ==========================================
            CREATE FORM
        =========================================== */}

        {
          !createdPayment
          &&
          (
            <>

              <div className="create-form">

                <FormField
                  label="Payment ID"
                  name="paymentId"
                  value={form.paymentId}
                  onChange={updateField}
                />


                <FormField
                  label="Customer ID"
                  name="customerId"
                  value={form.customerId}
                  onChange={updateField}
                />


                <FormField
                  label="Amount (₹)"
                  name="amount"
                  type="number"
                  value={form.amount}
                  onChange={updateField}
                />


                <SelectField

                  label="Customer Type"

                  name="customerType"

                  value={
                    form.customerType
                  }

                  onChange={
                    updateField
                  }

                  options={[
                    "new",
                    "returning"
                  ]}
                />


                <SelectField

                  label="Payment Method"

                  name="method"

                  value={
                    form.method
                  }

                  onChange={
                    updateField
                  }

                  options={[
                    "card",
                    "upi"
                  ]}
                />


                <SelectField

                  label="Failure Reason"

                  name="failureReason"

                  value={
                    form.failureReason
                  }

                  onChange={
                    updateField
                  }

                  options={[
                    "bank_restriction",
                    "issuer_declined",
                    "timeout",
                    "insufficient_funds",
                    "checkout_abandoned"
                  ]}
                />


                <FormField

                  label="Previous Attempts"

                  name="attemptCount"

                  type="number"

                  value={
                    form.attemptCount
                  }

                  onChange={
                    updateField
                  }
                />

              </div>


              <div className="ai-info-box">

                <BrainCircuit size={19} />


                <div>

                  <strong>
                    Agent routing
                  </strong>

                  <p>
                    Known failures use rules.
                    Unknown failures are sent
                    to Gemini only when recovery
                    is run.
                  </p>

                </div>

              </div>


              <button
                className="run-recovery-button"

                disabled={
                  submitting
                }

                onClick={
                  createPaymentCase
                }
              >

                {
                  submitting

                    ?

                    "Creating..."

                    :

                    "Create Case"
                }

              </button>

            </>
          )
        }


        {/* ==========================================
            CREATED, NOT YET PROCESSED
        =========================================== */}

        {
          createdPayment &&
          !recoveryResult
          &&
          (
            <div className="created-case-success">

              <CheckCircle2
                size={34}
              />


              <h3>
                Recovery case created
              </h3>


              <p>

                {
                  form.paymentId
                }

                {" is now stored in MongoDB and ready for analysis."}

              </p>


              <button
                className="run-recovery-button"

                disabled={
                  submitting
                }

                onClick={
                  runCreatedRecovery
                }
              >

                {
                  submitting

                    ?

                    (
                      <>

                        <RefreshCcw
                          size={17}
                          className="spin-icon"
                        />

                        Agent Processing...

                      </>
                    )

                    :

                    (
                      <>

                        <Play size={17} />

                        Run RecoverAI Agent

                      </>
                    )
                }

              </button>

            </div>
          )
        }


        {/* ==========================================
            AGENT RESULT
        =========================================== */}

        {
          recoveryResult &&
          (
            <div className="agent-result-card">

              {
                liveOutcome ===
                "RECOVERED"

                  ?

                  <CheckCircle2
                    size={34}
                  />

                  :

                  <Zap
                    size={34}
                  />
              }


              <p className="eyebrow">

                {
                  liveOutcome ===
                  "RECOVERED"

                    ?

                    "PAYMENT CONFIRMED"

                    :

                    "AGENT COMPLETED"
                }

              </p>


              <h3>

                {
                  formatAction(
                    recoveryResult
                      .recoveryAction
                  )
                }

              </h3>


              <p>

                {
                  recoveryResult
                    .explanation
                }

              </p>


              <div className="result-state-row">

                <span>
                  Current Outcome
                </span>


                <StatusBadge
                  status={
                    liveOutcome ||
                    "UNKNOWN"
                  }
                />

              </div>


              {
                liveOutcome ===
                "PENDING_PAYMENT"
                &&
                (
                  <div className="blocked-action-message">

                    <Clock3
                      size={17}
                    />

                    Waiting for Razorpay payment confirmation.
                    This status updates automatically.

                  </div>
                )
              }


              {
                liveOutcome ===
                "RECOVERED"
                &&
                (
                  <div className="recovery-result-box">

                    <CheckCircle2
                      size={20}
                    />


                    <div>

                      <strong>
                        Revenue recovered successfully
                      </strong>

                      <p>
                        Razorpay confirmed the payment
                        and RecoverAI updated the case
                        automatically.
                      </p>

                    </div>

                  </div>
                )
              }


              {
                liveCreatedCase
                  ?.razorpayPaymentId
                &&
                (
                  <div className="detail-section">

                    <h4>
                      Razorpay Payment
                    </h4>

                    <p>
                      {
                        liveCreatedCase
                          .razorpayPaymentId
                      }
                    </p>

                  </div>
                )
              }


              {
                livePaymentLink
                &&
                liveOutcome !==
                "RECOVERED"
                &&
                (
                  <a
                    href={
                      livePaymentLink
                    }

                    target="_blank"

                    rel="noreferrer"

                    className="payment-link-button"
                  >

                    <ExternalLink
                      size={17}
                    />

                    Open Razorpay Recovery Link

                  </a>
                )
              }

            </div>
          )
        }


        {
          formError &&
          (
            <div className="action-error">

              {formError}

            </div>
          )
        }

      </div>

    </div>
  );
}


// ======================================================
// CASE DETAILS
// ======================================================

function CaseDetailPanel({
  payment,
  onClose,
  refreshData
}) {

  const [processing, setProcessing] =
    useState(false);


  const [result, setResult] =
    useState(null);


  const [actionError, setActionError] =
    useState("");


  const blockedStates = [

    "RECOVERED",

    "STOPPED",

    "PENDING_PAYMENT",

    "HUMAN_REVIEW"

  ];


  const canRunRecovery =
    !blockedStates.includes(
      payment.currentOutcome
    );


  const runRecovery =
    async () => {

      try {

        setProcessing(true);

        setActionError("");

        setResult(null);


        const response =
          await axios.post(

            `/api/recovery/${payment.paymentId}`

          );


        setResult(
          response.data
        );


        await refreshData();

      } catch (error) {

        console.error(error);


        setActionError(

          error.response
            ?.data
            ?.message ||

          "Recovery could not be processed."

        );

      } finally {

        setProcessing(false);
      }
    };


  return (

    <div className="case-detail-overlay">

      <div className="case-detail-card">

        <div className="detail-header">

          <div>

            <p className="eyebrow">
              RECOVERY CASE
            </p>

            <h2>
              {payment.paymentId}
            </h2>

          </div>


          <button
            className="close-button"
            onClick={onClose}
          >
            ×
          </button>

        </div>


        <div className="detail-grid">

          <DetailItem

            label="Customer"

            value={
              payment.customerId
            }
          />


          <DetailItem

            label="Amount"

            value={
              formatMoney(
                payment.amount
              )
            }
          />


          <DetailItem

            label="Payment Method"

            value={
              payment.method ||
              "Not selected"
            }
          />


          <DetailItem

            label="Failure Reason"

            value={
              formatAction(
                payment.failureReason ||
                "Unknown"
              )
            }
          />


          <DetailItem

            label="Customer Type"

            value={
              formatAction(
                payment.customerType
              )
            }
          />


          <DetailItem

            label="Payment Attempts"

            value={
              payment.attemptCount
            }
          />


          <DetailItem

            label="Recovery Attempts"

            value={
              payment.recoveryAttempts
            }
          />

        </div>


        <div className="detail-section">

          <h4>
            Current State
          </h4>


          <StatusBadge
            status={
              payment.currentOutcome
            }
          />


          <p className="decision-action">

            {
              payment.currentAction ===
              "REVIEW"

                ?

                "AI Analysis Required"

                :

                formatAction(
                  payment.currentAction
                )
            }

          </p>

        </div>


        <div className="detail-section">

          <h4>
            Decision Explanation
          </h4>

          <p>
            {
              payment.decisionExplanation ||
              payment.explanation
            }
          </p>

        </div>


        {
          payment.currentAction ===
          "REVIEW"

          &&

          payment.currentOutcome ===
          "NOT_PROCESSED"

          &&
          (
            <div className="ai-reasoning-box">

              <div className="ai-box-title">

                <BrainCircuit
                  size={18}
                />

                Gemini Required

              </div>


              <p>
                The deterministic recovery
                rules do not recognize this
                failure. Gemini will diagnose
                it when you run the recovery
                agent.
              </p>

            </div>
          )
        }


        {
          canRunRecovery &&
          (
            <button
              className="run-recovery-button"

              onClick={
                runRecovery
              }

              disabled={
                processing
              }
            >

              {
                processing

                  ?

                  (
                    <>

                      <RefreshCcw
                        size={17}
                        className="spin-icon"
                      />

                      Processing...

                    </>
                  )

                  :

                  (
                    <>

                      <Play
                        size={17}
                      />

                      Run Recovery

                    </>
                  )
              }

            </button>
          )
        }


        {
          !canRunRecovery &&
          (
            <div className="blocked-action-message">

              {
                payment.currentOutcome ===
                "RECOVERED"

                  ?

                  <CheckCircle2
                    size={17}
                  />

                  :

                  <ShieldCheck
                    size={17}
                  />
              }


              {
                payment.currentOutcome ===
                "PENDING_PAYMENT"

                  ?

                  "Recovery link created. Awaiting customer payment."

                  :

                payment.currentOutcome ===
                "RECOVERED"

                  ?

                  "Payment confirmed. Revenue recovery completed."

                  :

                payment.currentOutcome ===
                "HUMAN_REVIEW"

                  ?

                  "Escalated for human review. No further autonomous action will be taken."

                  :

                  "This recovery case is closed."
              }

            </div>
          )
        }


        {
          result &&
          (
            <div className="recovery-result-box">

              <CheckCircle2
                size={20}
              />


              <div>

                <strong>
  {
    payment.currentOutcome === "HUMAN_REVIEW"
      ? "Case escalated for human review"
      : payment.currentOutcome === "STOPPED"
      ? "Recovery safely stopped"
      : "Recovery action executed"
  }
</strong>


                <p>

                  {
                    formatAction(
                      result.recoveryAction
                    )
                  }

                  {" → "}

                  {
                    formatAction(
                      payment.currentOutcome
                    )
                  }

                </p>

              </div>

            </div>
          )
        }


        {
          payment.currentOutcome ===
          "RECOVERED"
          &&
          payment.razorpayPaymentId
          &&
          (
            <div className="detail-section">

              <h4>
                Razorpay Confirmation
              </h4>


              <p>
                Payment ID:{" "}

                <strong>
                  {
                    payment.razorpayPaymentId
                  }
                </strong>
              </p>


              {
                payment.recoveredAt
                &&
                (
                  <p>
                    Recovered:{" "}

                    {
                      formatDate(
                        payment.recoveredAt
                      )
                    }
                  </p>
                )
              }

            </div>
          )
        }


        {
          actionError &&
          (
            <div className="action-error">

              {actionError}

            </div>
          )
        }


        {
          (
            result
              ?.executionResult
              ?.paymentLinkUrl ||

            payment.paymentLinkUrl
          )

          &&

          payment.currentOutcome ===
          "PENDING_PAYMENT"

          &&
          (
            <a

              href={
                result
                  ?.executionResult
                  ?.paymentLinkUrl ||

                payment.paymentLinkUrl
              }

              target="_blank"

              rel="noreferrer"

              className="payment-link-button"
            >

              <ExternalLink
                size={17}
              />

              Open Razorpay Recovery Link

            </a>
          )
        }

      </div>

    </div>
  );
}


// ======================================================
// ANALYTICS
// ======================================================

function AnalyticsPage({
  summary,
  batchEvaluation,
  batchError,
  refreshBatch
}) {

  const strategyData =
    Object.entries(
      summary.strategyPerformance ||
      {}
    ).map(
      ([action, data]) => ({

        action:
          shortActionName(
            action
          ),

        successRate:
          data.successRate,

        attempted:
          data.attempted,

        recovered:
          data.recovered,

        recoveredAmount:
          data.recoveredAmount,

        pending:
          data.pending || 0,

        failed:
          data.failed || 0

      })
    );


  const recoverySources =
    summary.recoverySources || {

      razorpayConfirmed: {
        cases: 0,
        revenue: 0
      },

      simulated: {
        cases: 0,
        revenue: 0
      },

      razorpayPending: {
        cases: 0,
        revenue: 0
      }

    };


  const batchMetrics =
    batchEvaluation?.metrics ||
    null;


  const batchStrategyData =
    Object.entries(
      batchMetrics
        ?.strategyPerformance ||
      {}
    ).map(
      ([action, data]) => ({

        action:
          shortActionName(
            action
          ),

        successRate:
          data.successRate,

        attempted:
          data.attempted,

        recovered:
          data.recovered,

        recoveredAmount:
          data.recoveredAmount,

        failed:
          data.failed || 0

      })
    );


  return (

    <>

      <section className="analytics-section-heading">

        <div>

          <p className="eyebrow">
            LIVE RECOVERY EVIDENCE
          </p>

          <h2>
            Live Agent Performance
          </h2>

          <p>
            Results from cases actually processed by RecoverAI.
            Razorpay-confirmed Test Mode recovery is kept separate
            from simulated outcomes.
          </p>

        </div>

        <span className="analytics-mode-badge live">
          Live State
        </span>

      </section>


      <section className="analytics-metrics">

        <MetricCard
          icon={<CheckCircle2 />}
          label="Razorpay Confirmed"
          value={
            formatMoney(
              recoverySources.razorpayConfirmed.revenue
            )
          }
          detail={
            `${recoverySources.razorpayConfirmed.cases} Razorpay Test Mode recoveries`
          }
        />

        <MetricCard
          icon={<TrendingUp />}
          label="Simulated Recovery"
          value={
            formatMoney(
              recoverySources.simulated.revenue
            )
          }
          detail={
            `${recoverySources.simulated.cases} simulated successful cases`
          }
        />

        <MetricCard
          icon={<Clock3 />}
          label="Pending Razorpay"
          value={
            formatMoney(
              recoverySources.razorpayPending.revenue
            )
          }
          detail={
            `${recoverySources.razorpayPending.cases} payment links awaiting confirmation`
          }
        />

        <MetricCard
          icon={<Activity />}
          label="Cases Processed"
          value={
            `${summary.processedCases || 0} / ${summary.recoveryCases || 0}`
          }
          detail={
            `${summary.unprocessedCases || 0} recovery cases still unprocessed`
          }
        />

      </section>


      <section className="panel analytics-chart-panel">

        <div className="panel-header">

          <div>

            <h3>
              Live Strategy Success Rates
            </h3>

            <p>
              Performance based only on recovery actions
              that were actually executed
            </p>

          </div>

        </div>


        <div className="analytics-chart">

          <ResponsiveContainer
            width="100%"
            height="100%"
          >

            <BarChart
              data={strategyData}
            >

              <XAxis
                dataKey="action"
                tick={{
                  fontSize: 12
                }}
              />

              <YAxis
                domain={[
                  0,
                  100
                ]}
              />

              <Tooltip />

              <Bar
                dataKey="successRate"
                radius={[8, 8, 0, 0]}
                fill="#7f56d9"
              />

            </BarChart>

          </ResponsiveContainer>

        </div>

      </section>


      <section className="strategy-cards">

        {
          strategyData.map(
            (strategy) => (

              <div
                className="strategy-card"
                key={strategy.action}
              >

                <span className="strategy-name">
                  {strategy.action}
                </span>

                <strong className="strategy-rate">
                  {strategy.successRate}%
                </strong>

                <p>
                  {strategy.recovered}
                  {" of "}
                  {strategy.attempted}
                  {" recovered"}
                </p>

                <small>
                  {
                    formatMoney(
                      strategy.recoveredAmount
                    )
                  }
                  {" recovered"}
                </small>

                {
                  strategy.pending > 0
                  &&
                  (
                    <small>
                      {strategy.pending}
                      {" pending"}
                    </small>
                  )
                }

                {
                  strategy.failed > 0
                  &&
                  (
                    <small>
                      {strategy.failed}
                      {" failed"}
                    </small>
                  )
                }

              </div>

            )
          )
        }

      </section>


      <section className="batch-evaluation-section">

        <div className="batch-evaluation-header">

          <div>

            <p className="eyebrow">
              SAFE SYNTHETIC BENCHMARK
            </p>

            <h2>
              50-Payment Batch Evaluation
            </h2>

            <p>
              A fixed, deterministic benchmark used to evaluate
              RecoverAI across a larger batch without creating
              Razorpay links, calling Gemini, or modifying recovery state.
            </p>

          </div>


          <div className="batch-header-actions">

            <span className="analytics-mode-badge synthetic">
              Projected Results
            </span>

            <button
              className="batch-refresh-button"
              onClick={refreshBatch}
            >
              <RefreshCcw size={15} />
              Refresh Benchmark
            </button>

          </div>

        </div>


        {
          batchError
          &&
          (
            <div className="action-error batch-error">
              {batchError}
            </div>
          )
        }


        {
          !batchMetrics &&
          !batchError
          &&
          (
            <div className="batch-loading">
              <div className="loader"></div>
              <span>
                Loading synthetic benchmark...
              </span>
            </div>
          )
        }


        {
          batchMetrics
          &&
          (
            <>

              <div className="batch-safety-banner">

                <ShieldCheck size={20} />

                <div>

                  <strong>
                    Side-effect-free evaluation
                  </strong>

                  <p>
                    0 Gemini calls · 0 Razorpay links ·
                    0 recovery-state mutations
                  </p>

                </div>

              </div>


              <section className="batch-metrics-grid">

                <MetricCard
                  icon={<Activity />}
                  label="Benchmark Payments"
                  value={batchMetrics.totalPayments}
                  detail={
                    `${batchMetrics.recoveryCases} payments require recovery`
                  }
                />

                <MetricCard
                  icon={<CircleDollarSign />}
                  label="Synthetic Revenue At Risk"
                  value={
                    formatMoney(
                      batchMetrics.revenueAtRisk
                    )
                  }
                  detail="Fixed 50-case benchmark"
                />

                <MetricCard
                  icon={<TrendingUp />}
                  label="Projected Recovery"
                  value={
                    formatMoney(
                      batchMetrics.projectedRecoveredRevenue
                    )
                  }
                  detail={
                    `${batchMetrics.projectedRecoveredCases} projected recovered cases`
                  }
                />

                <MetricCard
                  icon={<CheckCircle2 />}
                  label="Projected Recovery Rate"
                  value={
                    `${batchMetrics.projectedRecoveryRate}%`
                  }
                  detail="Synthetic benchmark result"
                />

              </section>


              <section className="batch-detail-grid">

                <div className="panel batch-summary-panel">

                  <div className="panel-header">

                    <div>
                      <h3>
                        Guardrail Outcomes
                      </h3>

                      <p>
                        Cases intentionally stopped or escalated
                      </p>
                    </div>

                  </div>


                  <div className="batch-stat-row">
                    <span>Human Review</span>
                    <strong>
                      {batchMetrics.humanReviewCases} cases
                    </strong>
                    <small>
                      {
                        formatMoney(
                          batchMetrics.humanReviewAmount
                        )
                      }
                    </small>
                  </div>

                  <div className="batch-stat-row">
                    <span>Stopped</span>
                    <strong>
                      {batchMetrics.stoppedCases} cases
                    </strong>
                    <small>
                      {
                        formatMoney(
                          batchMetrics.stoppedAmount
                        )
                      }
                    </small>
                  </div>

                  <div className="batch-stat-row">
                    <span>Recoverable</span>
                    <strong>
                      {batchMetrics.recoverableCases} cases
                    </strong>
                    <small>
                      {
                        formatMoney(
                          batchMetrics.recoverableAmount
                        )
                      }
                    </small>
                  </div>

                </div>


                <div className="panel batch-summary-panel">

                  <div className="panel-header">

                    <div>
                      <h3>
                        Decision Routing
                      </h3>

                      <p>
                        Rule engine versus offline AI evaluation fixture
                      </p>
                    </div>

                  </div>


                  <div className="batch-routing-card">

                    <div className="batch-routing-icon">
                      <ShieldCheck size={20} />
                    </div>

                    <div>
                      <span>Rule Engine</span>
                      <strong>
                        {
                          batchMetrics
                            .decisionSources
                            .ruleEngine
                        }
                      </strong>
                    </div>

                  </div>


                  <div className="batch-routing-card">

                    <div className="batch-routing-icon">
                      <BrainCircuit size={20} />
                    </div>

                    <div>
                      <span>AI Evaluation Fixture</span>
                      <strong>
                        {
                          batchMetrics
                            .decisionSources
                            .aiEvaluationFixture
                        }
                      </strong>
                    </div>

                  </div>

                </div>

              </section>


              <section className="panel analytics-chart-panel batch-chart-panel">

                <div className="panel-header">

                  <div>
                    <h3>
                      Projected Strategy Performance
                    </h3>

                    <p>
                      Deterministic synthetic success rate by intervention
                    </p>
                  </div>

                </div>


                <div className="analytics-chart">

                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >

                    <BarChart
                      data={batchStrategyData}
                    >

                      <XAxis
                        dataKey="action"
                        tick={{
                          fontSize: 12
                        }}
                      />

                      <YAxis
                        domain={[0, 100]}
                      />

                      <Tooltip />

                      <Bar
                        dataKey="successRate"
                        radius={[8, 8, 0, 0]}
                        fill="#475467"
                      />

                    </BarChart>

                  </ResponsiveContainer>

                </div>

              </section>


              <section className="strategy-cards batch-strategy-cards">

                {
                  batchStrategyData.map(
                    (strategy) => (

                      <div
                        className="strategy-card batch-strategy-card"
                        key={strategy.action}
                      >

                        <span className="strategy-name">
                          {strategy.action}
                        </span>

                        <strong className="strategy-rate">
                          {strategy.successRate}%
                        </strong>

                        <p>
                          {strategy.recovered}
                          {" of "}
                          {strategy.attempted}
                          {" projected recovered"}
                        </p>

                        <small>
                          {
                            formatMoney(
                              strategy.recoveredAmount
                            )
                          }
                          {" projected"}
                        </small>

                        {
                          strategy.failed > 0
                          &&
                          (
                            <small>
                              {strategy.failed}
                              {" projected failed"}
                            </small>
                          )
                        }

                      </div>

                    )
                  )
                }

              </section>


              <div className="batch-disclaimer">

                <ShieldCheck size={18} />

                <p>
                  <strong>
                    Synthetic evaluation only.
                  </strong>
                  {" "}
                  The projected recovery rate and projected revenue
                  are benchmark results based on deterministic
                  simulation assumptions. They are not claims of
                  real-world merchant performance. Razorpay-confirmed
                  Test Mode recoveries are shown separately above.
                </p>

              </div>

            </>
          )
        }

      </section>

    </>
  );
}


// ======================================================
// AUDIT
// ======================================================

function AuditPage({
  auditLogs
}) {

  const latestLogs = [
    ...auditLogs
  ].reverse();


  return (

    <section className="panel">

      <div className="panel-header">

        <div>

          <h3>
            Recovery Audit Timeline
          </h3>

          <p>
            Complete trace of agent
            decisions and outcomes
          </p>

        </div>


        <span className="case-count">

          {
            auditLogs.length
          } events

        </span>

      </div>


      <div className="audit-list">

        {
          latestLogs.map(
            (log) => (

              <div
                className="audit-item"

                key={
                  log._id
                }
              >

                <div className="audit-marker">

                  {
                    log.event ===
                    "RAZORPAY_PAYMENT_CONFIRMED"

                      ?

                      <CheckCircle2
                        size={18}
                      />

                      :

                      <Zap
                        size={18}
                      />
                  }

                </div>


                <div className="audit-content">

                  <div className="audit-heading">

                    <div>

                      <strong>
                        {log.paymentId}
                      </strong>

                      <span>

                        {
                          formatAction(
                            log.event
                          )
                        }

                      </span>

                    </div>


                    <StatusBadge
                      status={
                        log.outcome
                      }
                    />

                  </div>


                  <p className="audit-message">

                    {
                      log.actionMessage ||
                      log.explanation
                    }

                  </p>


                  <div className="audit-meta">

                    <span>

                      {
                        formatAction(
                          log.recoveryAction
                        )
                      }

                    </span>


                    <span>

                      {
                        formatDate(
                          log.timestamp
                        )
                      }

                    </span>


                    {
                      log.razorpay
                        ?.razorpayPaymentId
                      &&
                      (
                        <span>

                          {
                            log
                              .razorpay
                              .razorpayPaymentId
                          }

                        </span>
                      )
                    }

                  </div>

                </div>

              </div>

            )
          )
        }

      </div>

    </section>
  );
}


// ======================================================
// STRATEGY CHART
// ======================================================

function StrategyChart({
  strategyData
}) {

  return (

    <div className="panel chart-panel">

      <div className="panel-header">

        <div>

          <h3>
            Strategy Performance
          </h3>

          <p>
            Recovery success rate
            by intervention
          </p>

        </div>

      </div>


      <div className="chart-wrapper">

        <ResponsiveContainer
          width="100%"
          height="100%"
        >

          <BarChart
            data={strategyData}
          >

            <XAxis

              dataKey="action"

              tick={{
                fontSize: 11
              }}
            />


            <YAxis
              domain={[
                0,
                100
              ]}
            />


            <Tooltip />


            <Bar

              dataKey="successRate"

              radius={[
                8,
                8,
                0,
                0
              ]}
            />

          </BarChart>

        </ResponsiveContainer>

      </div>

    </div>
  );
}


// ======================================================
// RECOVERY STATE TABLE
// ======================================================

function RecoveryStateTable({
  states
}) {

  return (

    <div className="table-container">

      <table>

        <thead>

          <tr>

            <th>
              Payment
            </th>

            <th>
              Customer
            </th>

            <th>
              Recovery Action
            </th>

            <th>
              Attempts
            </th>

            <th>
              Status
            </th>

            <th>
              Razorpay
            </th>

          </tr>

        </thead>


        <tbody>

          {
            states.map(
              (state) => (

                <tr
                  key={
                    state.paymentId
                  }
                >

                  <td className="payment-id">

                    {
                      state.paymentId
                    }

                  </td>


                  <td>

                    {
                      state.customerId
                    }

                  </td>


                  <td>

                    {
                      formatAction(
                        state.recoveryAction
                      )
                    }

                  </td>


                  <td>

                    {
                      state.recoveryAttempts ||
                      "-"
                    }

                  </td>


                  <td>

                    <StatusBadge
                      status={
                        state.outcome
                      }
                    />

                  </td>


                  <td>

                    {
                      state.paymentLinkUrl

                        ?

                        (
                          <a

                            href={
                              state.paymentLinkUrl
                            }

                            target="_blank"

                            rel="noreferrer"
                          >

                            View Link

                          </a>
                        )

                        :

                        (
                          <span className="muted">
                            —
                          </span>
                        )
                    }

                  </td>

                </tr>

              )
            )
          }

        </tbody>

      </table>

    </div>
  );
}


// ======================================================
// METRIC CARD
// ======================================================

function MetricCard({
  icon,
  label,
  value,
  detail
}) {

  return (

    <div className="metric-card">

      <div className="metric-top">

        <div className="metric-icon">

          {icon}

        </div>


        <span>
          {label}
        </span>

      </div>


      <h2>
        {value}
      </h2>


      <p>
        {detail}
      </p>

    </div>
  );
}


// ======================================================
// DETAIL ITEM
// ======================================================

function DetailItem({
  label,
  value
}) {

  return (

    <div className="detail-item">

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  );
}


// ======================================================
// FORM FIELD
// ======================================================

function FormField({
  label,
  name,
  value,
  onChange,
  type = "text"
}) {

  return (

    <label className="form-field">

      <span>
        {label}
      </span>


      <input

        name={name}

        type={type}

        value={value}

        onChange={onChange}
      />

    </label>
  );
}


// ======================================================
// SELECT FIELD
// ======================================================

function SelectField({
  label,
  name,
  value,
  onChange,
  options
}) {

  return (

    <label className="form-field">

      <span>
        {label}
      </span>


      <select

        name={name}

        value={value}

        onChange={onChange}
      >

        {
          options.map(
            (option) => (

              <option

                key={option}

                value={option}
              >

                {
                  formatAction(
                    option
                  )
                }

              </option>

            )
          )
        }

      </select>

    </label>
  );
}


// ======================================================
// STATUS BADGE
// ======================================================

function StatusBadge({
  status = "UNKNOWN"
}) {

  const className =
    status
      .toLowerCase()
      .replaceAll(
        "_",
        "-"
      );


  return (

    <span
      className={
        `status-badge ${className}`
      }
    >

      {
        status
          .replaceAll(
            "_",
            " "
          )
      }

    </span>
  );
}


// ======================================================
// HELPERS
// ======================================================

function formatMoney(
  amount = 0
) {

  return new Intl.NumberFormat(
    "en-IN",
    {

      style:
        "currency",

      currency:
        "INR",

      maximumFractionDigits:
        0

    }
  ).format(amount);
}


function formatAction(
  action = ""
) {

  return String(action)

    .replaceAll(
      "_",
      " "
    )

    .toLowerCase()

    .replace(
      /\b\w/g,

      (letter) =>
        letter.toUpperCase()
    );
}


function shortActionName(
  action = ""
) {

  const names = {

    RETRY:
      "Retry",

    REMIND_LATER:
      "Remind Later",

    SEND_REMINDER:
      "Reminder",

    SEND_ALTERNATIVE_PAYMENT_METHOD:
      "Alt. Payment",

    OFFER_LOYALTY_INCENTIVE:
      "Loyalty Offer",

    STOP_RECOVERY:
      "Stop"

  };


  return (
    names[action] ||
    formatAction(action)
  );
}


function formatDate(
  date
) {

  if (!date) {

    return "Unknown time";
  }


  return new Date(
    date
  ).toLocaleString(
    "en-IN"
  );
}


export default App;