import {
  Fragment,
  useEffect,
  useMemo,
  useState
} from "react";
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
  Moon,
  Sun,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  UserRound,
  CalendarDays,
  BarChart3,
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
  useState(() => {

    const validPages = [

      "dashboard",

      "cases",

      "promises",

      "analytics",

      "audit"

    ];


    const hashPage =
      window.location.hash
        .replace(/^#\/?/, "")
        .trim();


    if (
      validPages.includes(
        hashPage
      )
    ) {

      return hashPage;
    }


    const savedPage =
      localStorage.getItem(
        "recoverai-active-page"
      );


    return validPages.includes(
      savedPage
    )

      ? savedPage

      : "dashboard";
  });
  
  const [theme, setTheme] =
  useState(() => {

    const savedTheme =
      localStorage.getItem(
        "recoverai-theme"
      );


    if (
      savedTheme === "dark" ||
      savedTheme === "light"
    ) {
      return savedTheme;
    }


    return window
      .matchMedia(
        "(prefers-color-scheme: dark)"
      )
      .matches

      ? "dark"
      : "light";
  });

  const [summary, setSummary] =
    useState(null);

  const [states, setStates] =
    useState([]);

  const [cases, setCases] =
    useState([]);

  const [auditLogs, setAuditLogs] =
    useState([]);
  
  const [promises, setPromises] =
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


    /*
      Each dashboard resource is independent.

      Promise.allSettled allows successful resources to
      refresh even if one API temporarily fails.

      This is especially important after a Razorpay
      webhook because recoveryStates may already contain
      RECOVERED while another dashboard endpoint is
      temporarily unavailable.
    */

    /*
      Add a unique refresh token to every dashboard read.

      This prevents the browser, CDN, or deployment layer from
      reusing an older GET response after a Razorpay webhook or
      manual refresh. The backend can safely ignore this query
      parameter.
    */

    const refreshToken =
      Date.now();


    const requestConfig = {

  params: {

    _refresh:
      refreshToken
  }
};


    const results =
      await Promise.allSettled([

        axios.get(
          "/api/recovery-summary",
          requestConfig
        ),

        axios.get(
          "/api/recovery-states",
          requestConfig
        ),

        axios.get(
          "/api/recovery-cases",
          requestConfig
        ),

        axios.get(
          "/api/audit-logs",
          requestConfig
        ),

        axios.get(
          "/api/promises",
          requestConfig
        )

      ]);


    const [
      summaryResult,
      statesResult,
      casesResult,
      auditResult,
      promisesResult
    ] = results;


    let successfulRequests =
      0;


    // ==================================================
    // SUMMARY
    // ==================================================

    if (
      summaryResult.status ===
      "fulfilled"
    ) {

      setSummary(
        summaryResult.value.data
      );

      successfulRequests++;
    }

    else {

      console.error(
        "Recovery summary refresh failed:",
        summaryResult.reason
      );
    }


    // ==================================================
    // RECOVERY STATES
    // ==================================================

    if (
      statesResult.status ===
      "fulfilled"
    ) {

      setStates(
        statesResult.value.data
      );

      successfulRequests++;
    }

    else {

      console.error(
        "Recovery states refresh failed:",
        statesResult.reason
      );
    }


    // ==================================================
    // RECOVERY CASES
    // ==================================================

    if (
      casesResult.status ===
      "fulfilled"
    ) {

      setCases(
        casesResult.value.data
      );

      successfulRequests++;
    }

    else {

      console.error(
        "Recovery cases refresh failed:",
        casesResult.reason
      );
    }


    // ==================================================
    // AUDIT LOGS
    // ==================================================

    if (
      auditResult.status ===
      "fulfilled"
    ) {

      setAuditLogs(
        auditResult.value.data
      );

      successfulRequests++;
    }

    else {

      console.error(
        "Audit log refresh failed:",
        auditResult.reason
      );
    }


    // ==================================================
    // PROMISES
    // ==================================================

    if (
      promisesResult.status ===
      "fulfilled"
    ) {

      setPromises(
        promisesResult
          .value
          .data
          ?.promises || []
      );

      successfulRequests++;
    }

    else {

      console.error(
        "Promise refresh failed:",
        promisesResult.reason
      );
    }


    /*
      Only show a blocking dashboard error when this is
      the initial load AND every request failed.

      During background polling, keep the last successful
      data visible.
    */

    if (
      showLoading &&
      successfulRequests === 0
    ) {

      setError(
        "Could not load RecoverAI data."
      );
    }

  } catch (err) {

    /*
      This should now be rare because individual request
      failures are handled through Promise.allSettled.
    */

    console.error(
      "Dashboard refresh failed:",
      err
    );


    if (showLoading) {

      setError(
        "Could not load RecoverAI data."
      );
    }

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



    useEffect(() => {

  document.documentElement
    .setAttribute(
      "data-theme",
      theme
    );


  localStorage.setItem(
    "recoverai-theme",
    theme
  );

}, [theme]);



// ====================================================
// PRESERVE CURRENT PAGE
// ====================================================

useEffect(() => {

  localStorage.setItem(
    "recoverai-active-page",
    activePage
  );


  const expectedHash =
    `#/${activePage}`;


  if (
    window.location.hash !==
    expectedHash
  ) {

    window.history.replaceState(
      null,
      "",
      expectedHash
    );
  }

}, [activePage]);


// ====================================================
// URL-ADDRESSABLE APP SECTIONS
// ====================================================

useEffect(() => {

  const validPages = new Set([
    "dashboard",
    "cases",
    "promises",
    "analytics",
    "audit"
  ]);


  const syncPageFromHash = () => {

    const hashPage =
      window.location.hash
        .replace(/^#\/?/, "")
        .trim();


    if (
      validPages.has(
        hashPage
      )
    ) {

      setActivePage(
        hashPage
      );
    }
  };


  window.addEventListener(
    "hashchange",
    syncPageFromHash
  );


  return () => {

    window.removeEventListener(
      "hashchange",
      syncPageFromHash
    );
  };

}, []);


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

routingDecision:
  state?.routingDecision || null,

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
  // MANUAL FULL REFRESH
  // ====================================================

  const handleManualRefresh = () => {

    /*
      The top-bar Refresh button is an explicit operator action.

      Persist the current section first, then reload the SPA so every
      dashboard resource is fetched again from the backend. This is
      intentionally independent of background polling, so the manual
      Refresh control remains reliable even if a browser suspends a
      timer or an individual in-memory request gets stuck.

      activePage is already restored from localStorage when the app
      mounts, so the operator stays on the same main section.
    */

    localStorage.setItem(
      "recoverai-active-page",
      activePage
    );


    window.location.reload();
  };


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
        type="button"
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
      />


      <main className="main">

       <Topbar
  activePage={activePage}

  onRefresh={
    handleManualRefresh
  }

  theme={theme}

  setTheme={setTheme}
/>


        {
          activePage === "dashboard" &&
          (
           <DashboardPage
  summary={summary}
  states={states}
  theme={theme}
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
         activePage === "promises" &&
       (
        <PromiseTrackerPage
  promises={promises}
  recoveryCases={recoveryCases}
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


  theme={theme}
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
  activePage
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
  id: "promises",
  label: "Promise Tracker",
  icon: <Clock3 size={18} />
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

          <div className="brand-title-row">
            <h2>
              RecoverAI
            </h2>

          </div>

          <span>
            Revenue Recovery Agent
          </span>

        </div>

      </div>


      <nav>

        {
          menuItems.map(
            (item) => (

              <a
                key={item.id}

                href={`#/${item.id}`}

                className={
                  `nav-item ${
                    activePage === item.id
                      ? "active"
                      : ""
                  }`
                }

                aria-current={
                  activePage === item.id
                    ? "page"
                    : undefined
                }

              >

                {item.icon}

                {item.label}

              </a>

            )
          )
        }

      </nav>


      <div className="sidebar-status">

        <span className="status-dot"></span>


        <div>

          <strong>
            Test Environment
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
  onRefresh,
  theme,
  setTheme
}) {

  const pageInfo = {

    dashboard: {
      eyebrow:
        "AUTONOMOUS REVENUE RECOVERY",

      title:
        "Recovery Dashboard",

      subtitle:
        "See what’s at risk, what RecoverAI is doing, and what Razorpay has confirmed."
    },

    cases: {
      eyebrow:
        "CASE INTELLIGENCE",

      title:
        "Recovery Cases",

      subtitle:
        "Review failed payments, understand each routing decision, and act on the cases that need attention."
    },

    promises: {
  eyebrow:
    "CUSTOMER COMMITMENTS",

  title:
    "Promise-to-Pay Tracker",

  subtitle:
    "Follow every customer commitment from promise to payment, escalation, or re-engagement."
},

    analytics: {
      eyebrow:
        "PERFORMANCE INTELLIGENCE",

      title:
        "Recovery Analytics",

      subtitle:
        "See which recovery strategies are working, where guardrails intervene, and what the benchmark projects."
    },

    audit: {
      eyebrow:
        "DECISION TRACEABILITY",

      title:
        "Audit Trail",

      subtitle:
        "Trace every decision RecoverAI made, why it made it, and what happened next."
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


      <div className="theme-toggle">

  <button
    type="button"
    className={
      `theme-option ${
        theme === "dark"
          ? "active"
          : ""
      }`
    }
    onClick={() =>
      setTheme("dark")
    }
    aria-pressed={
      theme === "dark"
    }
  >
    <Moon size={16} />

    Dark
  </button>


  <button
    type="button"
    className={
      `theme-option ${
        theme === "light"
          ? "active"
          : ""
      }`
    }
    onClick={() =>
      setTheme("light")
    }
    aria-pressed={
      theme === "light"
    }
  >
    <Sun size={16} />

    Light
  </button>

</div>


      <button
        type="button"
        className="refresh-button"
        onClick={
          onRefresh
        }
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
  states,
  theme
}) {

  const strategyPerformance =
    summary?.strategyPerformance || {};


  const recoverySources =
    summary?.recoverySources || {

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


  const confirmedRecoveryRate =
    summary?.recoveryCases > 0

      ? (
          (
            Number(
              recoverySources
                .razorpayConfirmed
                .cases || 0
            ) /
            Number(
              summary.recoveryCases
            )
          ) * 100
        ).toFixed(2)

      : "0.00";


  const dashboardStrategyOrder = [

    "RETRY",

    "CREATE_PROMISE_TO_PAY",

    "START_CONVERSATIONAL_RECOVERY",

    "SCHEDULE_CALLBACK",

    "SEND_ALTERNATIVE_PAYMENT_METHOD",

    "OFFER_LOYALTY_INCENTIVE"
  ];


  const remainingStrategyActions =
    Object.keys(
      strategyPerformance
    ).filter(
      (action) =>
        !dashboardStrategyOrder.includes(
          action
        )
    );


  const strategyData = [
    ...dashboardStrategyOrder,
    ...remainingStrategyActions
  ].map(
    (action) => ({

      action:
        shortActionName(action),

      successRate:
        Number(
          strategyPerformance[
            action
          ]?.successRate || 0
        )
    })
  );


  const ruleRoutedCases =
    states.filter(
      (state) =>
        state.routingDecision?.source ===
        "RULE"
    ).length;


  const aiRoutedCases =
    states.filter(
      (state) =>
        state.routingDecision?.source ===
        "AI"
    ).length;


  const humanReviewCases =
    states.filter(
      (state) =>
        state.outcome ===
        "HUMAN_REVIEW"
    ).length;


  const stoppedCases =
    states.filter(
      (state) =>
        state.recoveryAction ===
          "STOP_RECOVERY" ||
        state.outcome ===
          "STOP_RECOVERY" ||
        state.outcome ===
          "STOPPED"
    ).length;


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

          label="Razorpay Confirmed"

          value={
            formatMoney(
              recoverySources
                .razorpayConfirmed
                .revenue
            )
          }

          detail={
            `${recoverySources.razorpayConfirmed.cases} confirmed Test Mode recoveries`
          }
        />


        <MetricCard

          icon={
            <Activity />
          }

          label="Confirmed Recovery Rate"

          value={
            `${confirmedRecoveryRate}%`
          }

          detail="Razorpay-confirmed cases across recovery cases"
        />


        <MetricCard

          icon={
            <Clock3 />
          }

          label="Pending Razorpay"

          value={
            formatMoney(
              recoverySources
                .razorpayPending
                .revenue
            )
          }

          detail={
            `${recoverySources.razorpayPending.cases} payment links awaiting confirmation`
          }
        />

      </section>


      <section className="content-grid">

       <StrategyChart
  strategyData={
    strategyData
  }

  theme={theme}
/>


        <div className="panel agent-panel">

          <div className="agent-icon">
            <BrainCircuit size={28} />
          </div>


          <div className="agent-heading-row">

            <p className="eyebrow">
              RECOVERY ENGINE STATUS
            </p>

            <span className="agent-live-pill">
              <span />
              Live
            </span>

          </div>


          <h3>
            Recovery Engine Active
          </h3>


          <p>
            Live operational view of how RecoverAI is routing current recovery
            cases. Clear cases use deterministic rules, uncertain cases can use
            Gemini, and risky cases are escalated or stopped by guardrails.
          </p>


          <div className="agent-stat-grid">

            <div className="agent-stat">

              <span>
                Total Payment Records
              </span>

              <strong>
                {summary.totalPayments}
              </strong>

            </div>


            <div className="agent-stat">

              <span>
                Rule-Routed States
              </span>

              <strong>
                {ruleRoutedCases}
              </strong>

            </div>


            <div className="agent-stat">

              <span>
                AI-Routed States
              </span>

              <strong>
                {aiRoutedCases}
              </strong>

            </div>


            <div className="agent-stat">

              <span>
                Human Review
              </span>

              <strong>
                {humanReviewCases}
              </strong>

            </div>


            <div className="agent-stat">

              <span>
                Stopped by Guardrails
              </span>

              <strong>
                {stoppedCases}
              </strong>

            </div>


            <div className="agent-stat">

              <span>
                Live Stopped Revenue
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


          <p className="agent-data-note">
            Live dashboard data only — synthetic benchmark results remain in Analytics.
          </p>

        </div>

      </section>


      <section className="panel">

        <div className="panel-header">

          <div>

            <h3>
              Recent Recovery States
            </h3>

            <p>
              Latest recorded recovery
              states
            </p>

          </div>


          <span className="case-count">
            {states.length} tracked states
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


  // ====================================================
  // QUEUE PAGINATION
  // ====================================================

  const CASES_PER_PAGE = 10;

  const [
    currentPage,
    setCurrentPage
  ] = useState(1);


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


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredCases.length /
        CASES_PER_PAGE
      )
    );


  /*
    Return to page 1 whenever the queue view changes.

    This prevents a filter from leaving the user on
    a page that no longer exists.
  */

  useEffect(() => {

    setCurrentPage(1);

  }, [
    searchTerm,
    statusFilter,
    failureFilter,
    processingFilter
  ]);


  /*
    Polling can change the number of recovery cases.

    If the current page becomes invalid after a refresh,
    move to the last available page.
  */

  useEffect(() => {

    if (currentPage > totalPages) {

      setCurrentPage(totalPages);
    }

  }, [
    currentPage,
    totalPages
  ]);


  const paginatedCases =
    useMemo(() => {

      const startIndex =
        (currentPage - 1) *
        CASES_PER_PAGE;

      return filteredCases.slice(
        startIndex,
        startIndex + CASES_PER_PAGE
      );

    }, [
      filteredCases,
      currentPage
    ]);


  const firstVisibleCase =
    filteredCases.length === 0

      ? 0

      : (
          (currentPage - 1) *
          CASES_PER_PAGE
        ) + 1;


  const lastVisibleCase =
    Math.min(
      currentPage * CASES_PER_PAGE,
      filteredCases.length
    );


  const paginationItems =
    useMemo(() => {

      if (totalPages <= 7) {

        return Array.from(
          {
            length: totalPages
          },
          (_, index) =>
            index + 1
        );
      }


      const items = [1];

      const windowStart =
        Math.max(
          2,
          currentPage - 1
        );

      const windowEnd =
        Math.min(
          totalPages - 1,
          currentPage + 1
        );


      if (windowStart > 2) {

        items.push("start-ellipsis");
      }


      for (
        let page = windowStart;
        page <= windowEnd;
        page += 1
      ) {

        items.push(page);
      }


      if (
        windowEnd <
        totalPages - 1
      ) {

        items.push("end-ellipsis");
      }


      items.push(totalPages);

      return items;

    }, [
      currentPage,
      totalPages
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
        type="button"
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
        type="button"

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
                  Recovery Plan / Action
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

                  paginatedCases.map(
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

                          <div className="recovery-action-cell">

                            {
                              payment.currentOutcome ===
                              "NOT_PROCESSED"
                              &&
                              (
                                <span className="action-context-label">
                                  Recommended
                                </span>
                              )
                            }

                            <span>

                              {
                                payment.currentAction ===
                                "REVIEW"

                                  ?

                                  "Requires AI Analysis"

                                  :

                                  formatAction(
                                    payment.currentAction
                                  )
                              }

                            </span>

                          </div>

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
        type="button"
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


        {
          filteredCases.length > 0
          &&
          (
            <div className="cases-pagination">

              <div className="pagination-summary">

                Showing{" "}

                <strong>
                  {firstVisibleCase}
                </strong>

                {" to "}

                <strong>
                  {lastVisibleCase}
                </strong>

                {" of "}

                <strong>
                  {filteredCases.length}
                </strong>

                {" cases"}

              </div>


              <div
                className="pagination-controls"
                aria-label="Recovery cases pagination"
              >

                <button
                  type="button"
                  className="pagination-arrow"
                  aria-label="Previous page"
                  disabled={
                    currentPage === 1
                  }
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.max(
                          1,
                          page - 1
                        )
                    )
                  }
                >
                  ‹
                </button>


                {
                  paginationItems.map(
                    (item) => {

                      if (
                        typeof item !==
                        "number"
                      ) {

                        return (
                          <span
                            key={item}
                            className="pagination-ellipsis"
                          >
                            …
                          </span>
                        );
                      }


                      return (
                        <button
                          key={item}
                          type="button"
                          className={
                            `pagination-page ${
                              currentPage === item
                                ? "active"
                                : ""
                            }`
                          }
                          aria-current={
                            currentPage === item
                              ? "page"
                              : undefined
                          }
                          onClick={() =>
                            setCurrentPage(
                              item
                            )
                          }
                        >
                          {item}
                        </button>
                      );
                    }
                  )
                }


                <button
                  type="button"
                  className="pagination-arrow"
                  aria-label="Next page"
                  disabled={
                    currentPage ===
                    totalPages
                  }
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.min(
                          totalPages,
                          page + 1
                        )
                    )
                  }
                >
                  ›
                </button>

              </div>

            </div>
          )
        }

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
    MODAL SCROLL LOCK

    While the create-case workflow is open, the underlying
    Recovery Cases page must not move. Only the workflow cards
    are allowed to scroll internally.
  */

  useEffect(() => {

    const previousBodyOverflow =
      document.body.style.overflow;

    const previousHtmlOverflow =
      document.documentElement.style.overflow;


    document.body.style.overflow =
      "hidden";

    document.documentElement.style.overflow =
      "hidden";


    return () => {

      document.body.style.overflow =
        previousBodyOverflow;

      document.documentElement.style.overflow =
        previousHtmlOverflow;
    };

  }, []);


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


  const finalRecoveryAction =
    liveCreatedCase?.currentAction ||

    recoveryResult?.recoveryAction ||

    recoveryResult
      ?.recoveryResult
      ?.recoveryAction ||

    "REVIEW";


  const finalRoutingDecision =
    liveCreatedCase?.routingDecision ||

    recoveryResult?.routingDecision ||

    recoveryResult
      ?.recoveryResult
      ?.routingDecision ||

    null;


  const routingConfidence =
    typeof finalRoutingDecision?.confidence ===
    "number"

      ? Math.round(
          finalRoutingDecision.confidence *
          100
        )

      : null;


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


  // ====================================================
  // CREATE PAYMENT + CONTINUE TO AGENT
  // ====================================================

  const createPaymentCase =
    async () => {

      /*
        Validate the small set of fields the operator can edit before
        creating any backend record. This prevents avoidable cases such
        as zero/negative amounts or negative previous-attempt counts.
      */

      if (
        !String(form.paymentId || "").trim() ||
        !String(form.customerId || "").trim()
      ) {

        setFormError(
          "Payment ID and Customer ID are required."
        );

        return;
      }


      if (
        !Number.isFinite(Number(form.amount)) ||
        Number(form.amount) <= 0
      ) {

        setFormError(
          "Amount must be greater than ₹0."
        );

        return;
      }


      if (
        !Number.isInteger(Number(form.attemptCount)) ||
        Number(form.attemptCount) < 0
      ) {

        setFormError(
          "Previous Attempts must be a whole number of 0 or more."
        );

        return;
      }


      /*
        React state updates are asynchronous. Track this request locally
        so an agent failure after a successful payment creation gets the
        correct error message in the same async flow.
      */

      let paymentWasCreated = false;


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

        paymentWasCreated = true;


        /*
          Keep the backend sequence exactly the same:

          1. Create the failed payment.
          2. Run the recovery agent for that payment.

          The only change is that the UI now continues
          automatically into the processing stage.
        */

        const recoveryResponse =
          await axios.post(

            `/api/recovery/${form.paymentId}`

          );


        setRecoveryResult(
          recoveryResponse.data
        );


        await refreshData();

      } catch (error) {

        console.error(error);


        setFormError(

          error.response
            ?.data
            ?.message ||

          (
            paymentWasCreated

              ? "Case details were saved, but recovery processing failed. Use Retry Agent to continue."

              : "Could not create recovery case."
          )

        );

      } finally {

        setSubmitting(false);
      }
    };


  const formLocked =
    Boolean(createdPayment);


  return (

    <div className="case-detail-overlay create-case-overlay">

      <div
        className={
          `create-workflow-shell ${
            recoveryResult
              ? "three-stage"
              : createdPayment
                ? "two-stage"
                : "one-stage"
          }`
        }
      >

        {/* =================================================
            STAGE 1 — CREATE CASE
        ================================================== */}

        <section className="create-stage-column">

          <div className="create-stage-label">
            <span>1</span>
            Create case
          </div>


          <div className="create-stage-card create-form-stage">

            <div className="create-stage-header">

              <div>

                <p className="eyebrow">
                  NEW FAILURE EVENT
                </p>

                <h2>
                  Create recovery case
                </h2>

              </div>


              <button
                type="button"
                className="close-button"
                onClick={onClose}
                aria-label="Close create recovery case"
              >
                ×
              </button>

            </div>


            <div
              className={
                `create-form ${
                  formLocked
                    ? "form-locked"
                    : ""
                }`
              }
            >

              <FormField
                label="Payment ID"
                name="paymentId"
                value={form.paymentId}
                onChange={updateField}
                disabled={formLocked}
              />


              <FormField
                label="Customer ID"
                name="customerId"
                value={form.customerId}
                onChange={updateField}
                disabled={formLocked}
              />


              <FormField
                label="Amount (₹)"
                name="amount"
                type="number"
                value={form.amount}
                onChange={updateField}
                disabled={formLocked}
                min={1}
                step={1}
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
                disabled={formLocked}
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
                disabled={formLocked}
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
                disabled={formLocked}
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
                disabled={formLocked}
                min={0}
                step={1}
              />

            </div>


            <div className="ai-info-box">

              <BrainCircuit size={19} />


              <div>

                <strong>
                  Agent routing
                </strong>

                <p>
                  Rules handle known failures.
                  Gemini is used only when the
                  next recovery path is uncertain.
                </p>

              </div>

            </div>


            <div className="create-stage-actions">

              {
                !createdPayment

                  ?

                  <>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={onClose}
                      disabled={submitting}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      className="run-recovery-button"
                      disabled={submitting}
                      onClick={
                        createPaymentCase
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
                              Creating...
                            </>
                          )

                          :

                          "Create Case"
                      }

                    </button>
                  </>

                  :

                  <div className="stage-complete-strip">

                    <CheckCircle2 size={18} />

                    Case details saved

                  </div>
              }

            </div>

          </div>

        </section>


        {/* =================================================
            STAGE 2 — AGENT PROCESSING
        ================================================== */}

        {
          createdPayment
          &&
          (
            <section className="create-stage-column">

              <div className="create-stage-label">
                <span>2</span>
                Agent processing
              </div>


              <div className="create-stage-card agent-processing-stage">

                <div className="create-stage-header compact">

                  <div>

                    <p className="eyebrow">
                      RECOVERY ENGINE
                    </p>

                    <h2>
                      Agent processing
                    </h2>

                  </div>

                </div>


                <div className="agent-processing-body">

                  <div
                    className={
                      `processing-orb ${
                        recoveryResult
                          ? "complete"
                          : ""
                      }`
                    }
                  >

                    {
                      recoveryResult

                        ?

                        <CheckCircle2 size={34} />

                        :

                        <RefreshCcw
                          size={34}
                          className="spin-icon"
                        />
                    }

                  </div>


                  <h3>

                    {
                      recoveryResult

                        ? "Routing complete"

                        : "RecoverAI is evaluating the case"
                    }

                  </h3>


                  <p>

                    {
                      recoveryResult

                        ? "The recovery path has been selected and the case is ready."

                        : "Evaluating retry, payment, promise-to-pay and conversational recovery paths."
                    }

                  </p>


                  <div className="processing-skeleton">

                    <span className="wide"></span>

                    <span className="medium"></span>

                    <div>
                      <i></i>
                      <span></span>
                    </div>

                    <div>
                      <i></i>
                      <span></span>
                    </div>

                    <div>
                      <i></i>
                      <span className="short"></span>
                    </div>

                  </div>


                  {
                    !submitting &&
                    !recoveryResult &&
                    formError
                    &&
                    (
                      <button
                        type="button"
                        className="run-recovery-button"
                        onClick={
                          runCreatedRecovery
                        }
                      >
                        <RefreshCcw size={17} />
                        Retry Agent
                      </button>
                    )
                  }

                </div>

              </div>

            </section>
          )
        }


        {/* =================================================
            STAGE 3 — RESULT
        ================================================== */}

        {
          recoveryResult
          &&
          (
            <section className="create-stage-column">

              <div className="create-stage-label">
                <span>3</span>
                Case created
              </div>


              <div className="create-stage-card create-result-stage">

                <div className="create-stage-header compact">

                  <div>

                    <p className="eyebrow">
                      RECOVERY READY
                    </p>

                    <h2>
                      Create recovery case
                    </h2>

                  </div>


                  <button
                    type="button"
                    className="close-button"
                    onClick={onClose}
                    aria-label="Close"
                  >
                    ×
                  </button>

                </div>


                <div className="result-success-hero">

                  <div className="result-success-icon">
                    <CheckCircle2 size={42} />
                  </div>


                  <h3>
                    Case created
                  </h3>


                  <div className="result-success-banner">

                    <CheckCircle2 size={18} />

                    Recovery case has been
                    created successfully.

                  </div>

                </div>


                <div className="result-summary-table">

                  <div>

                    <span>
                      Recovery action
                    </span>

                    <strong>
                      {
                        formatAction(
                          finalRecoveryAction
                        )
                      }
                    </strong>

                  </div>


                  <div>

                    <span>
                      Confidence
                    </span>

                    <strong className="confidence-success">

                      {
                        routingConfidence !== null

                          ? `${routingConfidence}%`

                          : "—"
                      }

                    </strong>

                  </div>


                  <div>

                    <span>
                      Current outcome
                    </span>

                    <StatusBadge
                      status={
                        liveOutcome ||
                        "UNKNOWN"
                      }
                    />

                  </div>

                </div>


                {
                  liveOutcome ===
                  "PENDING_PAYMENT"
                  &&
                  (
                    <div className="blocked-action-message">

                      <Clock3 size={17} />

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

                      <CheckCircle2 size={20} />


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
                  livePaymentLink &&
                  liveOutcome !==
                  "RECOVERED"
                  &&
                  (
                    <a
                      href={livePaymentLink}
                      target="_blank"
                      rel="noreferrer"
                      className="payment-link-button"
                    >

                      Open Razorpay Recovery Link

                      <ExternalLink size={17} />

                    </a>
                  )
                }


                <button
                  type="button"
                  className="secondary-button result-close-button"
                  onClick={onClose}
                >
                  Done
                </button>

              </div>

            </section>
          )
        }


        {
          formError
          &&
          (
            <div className="workflow-error">

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

  const [
  conversationMessage,
  setConversationMessage
] = useState("");


const [
  conversationResult,
  setConversationResult
] = useState(null);


const [
  conversationLoading,
  setConversationLoading
] = useState(false);

const [
  isListening,
  setIsListening
] = useState(false);


const [
  speechSupported,
  setSpeechSupported
] = useState(true);


  const blockedStates = [

    "RECOVERED",

    "STOPPED",

    "PENDING_PAYMENT",

    "HUMAN_REVIEW",

    "PROMISE_TO_PAY"

  ];


  const canRunRecovery =
    !blockedStates.includes(
      payment.currentOutcome
    );

    const routingDecision =
  result?.routingDecision ||
  payment.routingDecision ||
  null;


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

  const runConversationRecovery =
  async () => {

    try {

      setConversationLoading(true);

      setActionError("");

      setConversationResult(null);


      const response =
  await axios.post(
    "/api/conversation/recover",

    {
      payment: {

        paymentId:
          payment.paymentId,

        customerId:
          payment.customerId,

        customerType:
          payment.customerType,

        amount:
          payment.amount,

        status:
          "failed",

        method:
          payment.method,

        failureReason:
          payment.failureReason,

        attemptCount:
          payment.attemptCount
      },

      customerMessage:
        conversationMessage
    },

    {
      timeout:
        40000
    }
  );


        


      setConversationResult(
        response.data
      );

      const result =
  response.data;

  const speechLanguage =
  detectSpeechLanguage(
    conversationMessage
  );


const shouldSpeakHindi =
  speechLanguage ===
  "hi-IN";


if (
  result.outcome ===
  "PROMISE_TO_PAY"
) {

  const responseText =
    shouldSpeakHindi

      ? `Theek hai. Aapka payment promise ${result.analysis?.promisedDate || "later"} ke liye note kar liya gaya hai.`

      : `Okay. Your payment promise for ${result.analysis?.promisedDate || "later"} has been recorded.`;



  speakResponse(
    responseText,
    conversationMessage
  );

}


else if (
  result.outcome ===
  "PENDING_PAYMENT"
) {

  const responseText =
    shouldSpeakHindi

      ? "Theek hai. Maine aapke liye payment link ready kar diya hai."

      : "Okay. I have prepared a payment link for you.";



  speakResponse(
    responseText,
    conversationMessage
  );

}


else if (
  result.outcome ===
  "HUMAN_REVIEW"
) {

  const responseText =
    shouldSpeakHindi

      ? "Theek hai. Is case ko human support ke liye forward kiya ja raha hai."

      : "Okay. This case is being forwarded for human review.";



  speakResponse(
    responseText,
    conversationMessage
  );

}


else {

  const responseText =
    shouldSpeakHindi

      ? (
          result.message ||
          "Aapki response process kar li gayi hai."
        )

      : "Your response has been processed.";



  speakResponse(
    responseText,
    conversationMessage
  );

}


      await refreshData();


    } catch (error) {

      console.error(error);


      setActionError(

        error.response
          ?.data
          ?.message ||

        "Conversational recovery could not be processed."
      );


    } finally {

      setConversationLoading(false);
    }
  };


  const startVoiceInput = async () => {

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


  if (!SpeechRecognition) {

    setSpeechSupported(false);

    setActionError(
      "Speech recognition is not supported in this browser. Please use Chrome or Edge."
    );

    return;
  }


  try {

    /*
      Ask for microphone permission explicitly first.
      This makes permission-related failures much clearer.
    */

    if (
      !navigator.mediaDevices?.getUserMedia
    ) {

      setActionError(
        "Microphone access is not available in this browser context. Use a supported browser over HTTPS, or type the customer response instead."
      );

      return;
    }


    await navigator.mediaDevices.getUserMedia({
      audio: true
    });


    const recognition =
      new SpeechRecognition();


    /*
      Hinglish often contains both Hindi and English.
      Chrome's hi-IN recognition can still capture
      mixed Hindi-English speech reasonably well.
    */

    recognition.lang =
      "en-IN";


    recognition.interimResults =
      true;


    recognition.continuous =
      false;


    recognition.maxAlternatives =
      1;


    recognition.onstart =
      () => {

        setIsListening(true);

        setActionError("");
      };


    recognition.onresult =
      (event) => {

        let transcript = "";


        for (
          let i = event.resultIndex;
          i < event.results.length;
          i++
        ) {

          transcript +=
            event.results[i][0]
              .transcript;
        }


        setConversationMessage(
  transcript.trim()
);
      };


    recognition.onerror =
      (event) => {

        console.error(
          "Speech recognition error:",
          event.error,
          event.message
        );


        let message =
          `Voice recognition failed: ${event.error}`;


        if (
          event.error ===
          "not-allowed"
        ) {

          message =
            "Microphone access was blocked. Allow microphone permission for this site and try again.";
        }


        if (
          event.error ===
          "audio-capture"
        ) {

          message =
            "No microphone could be detected by the browser.";
        }


        if (
          event.error ===
          "no-speech"
        ) {

          message =
            "No speech was detected. Click the microphone and speak immediately.";
        }


        if (
          event.error ===
          "network"
        ) {

          message =
            "Browser speech recognition could not reach its speech service. Check your internet connection and try again.";
        }


        setActionError(
          message
        );


        setIsListening(false);
      };


    recognition.onend =
      () => {

        setIsListening(false);
      };


    recognition.start();


  } catch (error) {

    console.error(
      "Microphone permission error:",
      error
    );


    setIsListening(false);


    if (
      error.name ===
      "NotAllowedError"
    ) {

      setActionError(
        "Microphone permission is denied. Allow microphone access in the browser address bar and try again."
      );

      return;
    }


    if (
      error.name ===
      "NotFoundError"
    ) {

      setActionError(
        "No microphone was found on this device."
      );

      return;
    }


    setActionError(
      `Microphone could not be started: ${error.message}`
    );
  }
};


function detectSpeechLanguage(text) {

  if (!text) {
    return "en-IN";
  }


  // Detect Hindi written in Devanagari.
  const devanagariPattern =
    /[\u0900-\u097F]/;


  if (
    devanagariPattern.test(text)
  ) {
    return "hi-IN";
  }


  // Common Roman Hindi / Hinglish words.
  const hindiWords = [
    "hai",
    "hain",
    "nahi",
    "nahin",
    "haan",
    "abhi",
    "kal",
    "aaj",
    "paise",
    "paisa",
    "kar",
    "karo",
    "karna",
    "karunga",
    "karungi",
    "karta",
    "karti",
    "dunga",
    "dungi",
    "mujhe",
    "mera",
    "meri",
    "maine",
    "main",
    "mein",
    "kab",
    "baad",
    "thoda",
    "shayad",
    "pata",
    "kya",
    "kyun",
    "kaise",
    "hoga",
    "hogi",
    "bhej",
    "bhejo",
    "ko"
  ];


  const words =
    text
      .toLowerCase()
      .replace(
        /[^a-zA-Z\u0900-\u097F\s]/g,
        " "
      )
      .split(/\s+/)
      .filter(Boolean);


  const containsHindiWord =
    words.some(
      (word) =>
        hindiWords.includes(
          word
        )
    );


  if (
    containsHindiWord
  ) {
    return "hi-IN";
  }


  return "en-IN";
}



const speakResponse =
  (
    text,
    customerMessage
  ) => {

    if (
      !("speechSynthesis" in window)
    ) {
      return;
    }


    window.speechSynthesis.cancel();


    const utterance =
      new SpeechSynthesisUtterance(
        text
      );


    utterance.lang =
      detectSpeechLanguage(
        customerMessage
      );


    utterance.rate =
      0.95;


    utterance.pitch =
      1;


    window.speechSynthesis.speak(
      utterance
    );
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
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="Close recovery case"
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


          {
            payment.currentAction
            &&
            (
              <div className="decision-action-block">

                <span className="detail-inline-label">

                  {
                    payment.currentOutcome ===
                    "NOT_PROCESSED"

                      ?

                      "Recommended next action"

                      :

                      "Latest recovery action"
                  }

                </span>


                <p className="decision-action">

                  {
                    payment.currentAction ===
                    "REVIEW"

                      ?

                      "Requires AI Analysis"

                      :

                      formatAction(
                        payment.currentAction
                      )
                  }

                </p>

              </div>
            )
          }

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
  routingDecision &&
  (
    <div className="detail-section">

      <h4>
        Routing Decision
      </h4>

      <div className="detail-grid">

        <DetailItem
          label="Recovery Channel"
          value={
            formatAction(
              routingDecision.channel
            )
          }
        />

        <DetailItem
          label="Decision Source"
          value={
            routingDecision.source === "RULE"
              ? "Rule Engine"
              : routingDecision.source === "AI"
              ? "Gemini AI"
              : routingDecision.source === "AI_FALLBACK"
              ? "AI Fallback"
              : formatAction(
                  routingDecision.source
                )
          }
        />

        <DetailItem
          label="Confidence"
          value={
            routingDecision.confidence != null
              ? `${Math.round(
                  Number(
                    routingDecision.confidence
                  ) * 100
                )}%`
              : "—"
          }
        />

      </div>

      <p
        style={{
          marginTop: "14px"
        }}
      >
        <strong>
          Routing reason:
        </strong>
        {" "}
        {
          routingDecision.reason ||
          "No routing explanation available."
        }
      </p>

    </div>
  )
}


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

                AI Analysis Required

              </div>


              <p>
                The rule engine does not have
                enough certainty to choose the
                next recovery path. RecoverAI
                will use Gemini when you run
                this case.
              </p>

            </div>
          )
        }


        {
          canRunRecovery &&
          (
            <button
        type="button"
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
  payment.currentAction ===
    "START_CONVERSATIONAL_RECOVERY"

  ||
  result?.channel ===
    "CONVERSATIONAL_RECOVERY"

  ?

  (
    <div className="detail-section">

      <h4>
        Conversational Recovery
      </h4>


      <p>
        RecoverAI selected a conversational recovery flow for this case.
      </p>
      
      <button
  className="secondary-button"
  type="button"
  onClick={startVoiceInput}
  disabled={
    isListening ||
    !speechSupported
  }
  style={{
    marginTop: "12px"
  }}
>
  {
    isListening
      ? "Listening..."
      : "🎤 Speak in Hindi / Hinglish"
  }
</button>

      <textarea
        className="conversation-response-input"
        value={conversationMessage}
        onChange={(event) =>
          setConversationMessage(
            event.target.value
          )
        }
        placeholder="Enter the customer's response in English, Hindi, or Hinglish..."
        rows={4}
      />


      <button
        type="button"
        className="run-recovery-button"
        disabled={
          conversationLoading ||
          !conversationMessage.trim()
        }
        onClick={
          runConversationRecovery
        }
      >

        {
          conversationLoading
            ? "Analyzing Conversation..."
            : "Process Customer Response"
        }

      </button>


      {
        conversationResult &&
        (
          <div className="recovery-result-box">

            <BrainCircuit
              size={20}
            />


            <div>

              <strong>
                {
                  formatAction(
                    conversationResult.finalAction
                  )
                }
              </strong>


              <p>
                {
                  conversationResult.message
                }
              </p>


              <p>
                Intent:{" "}
                <strong>
                  {
                    formatAction(
                      conversationResult
                        .analysis
                        ?.intent ||
                      "UNKNOWN"
                    )
                  }
                </strong>
              </p>


              <p>
                Confidence:{" "}
                <strong>
                  {
                    Math.round(
                      Number(
                        conversationResult
                          .analysis
                          ?.confidence || 0
                      ) * 100
                    )
                  }%
                </strong>
              </p>


              {
                conversationResult
                  .analysis
                  ?.promisedDate
                &&
                (
                  <p>
                    Promised Date:{" "}
                    <strong>
                      {
                        conversationResult
                          .analysis
                          .promisedDate
                      }
                    </strong>
                  </p>
                )
              }

            </div>

          </div>
        )
      }


      {
        conversationResult
          ?.executionResult
          ?.paymentLinkUrl
        &&
        (
          <a
            href={
              conversationResult
                .executionResult
                .paymentLinkUrl
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

  :

  null
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
// PROMISE-TO-PAY TRACKER
// ======================================================

function PromiseTrackerPage({
  promises,
  recoveryCases,
  refreshData
}) {

  const [selectedPaymentId, setSelectedPaymentId] =
    useState(null);

  const [expandedPromiseId, setExpandedPromiseId] =
    useState(() => promises?.[0]?.paymentId || null);


  const [
    promiseSearchTerm,
    setPromiseSearchTerm
  ] = useState("");


  // ====================================================
  // PROMISE QUEUE PAGINATION
  // ====================================================

  const PROMISES_PER_PAGE = 10;

  const [
    promisePage,
    setPromisePage
  ] = useState(1);


  const selectedRecoveryCase =
    recoveryCases.find(
      (payment) =>
        payment.paymentId === selectedPaymentId
    ) || null;

  const now = new Date();

  const activePromises =
    promises.filter(
      (item) =>
        item.promise?.promiseStatus === "ACTIVE"
    );

  const totalPromisedAmount =
    activePromises.reduce(
      (total, item) =>
        total + Number(item.promise?.promisedAmount || 0),
      0
    );

  const duePromises =
    promises.filter((item) => {
      const status = item.promise?.promiseStatus;
      const promisedDate = item.promise?.promisedDate;

      return (
        (status === "DUE" || status === "ACTIVE") &&
        promisedDate &&
        new Date(promisedDate) <= now
      );
    });

  const brokenPromises =
    promises.filter(
      (item) => item.promise?.promiseStatus === "BROKEN"
    );

  const keptPromises =
    promises.filter(
      (item) => item.promise?.promiseStatus === "KEPT"
    );

  const orderedPromises =
    useMemo(
      () =>
        [...promises].sort(
          (a, b) =>
            new Date(a.promise?.promisedDate || 0) -
            new Date(b.promise?.promisedDate || 0)
        ),
      [promises]
    );


  const filteredPromises =
    useMemo(() => {

      const normalizedSearch =
        promiseSearchTerm
          .trim()
          .toLowerCase();


      if (normalizedSearch === "") {

        return orderedPromises;
      }


      return orderedPromises.filter(
        (item) => {

          const searchableValues = [
            item.paymentId,
            item.customerId,
            item.promise?.promiseStatus,
            item.promise?.language,
            item.promise?.conversationSummary,
            item.promise?.promisedAmount,
            item.promise?.promisedDate
          ];


          return searchableValues.some(
            (value) =>
              String(value ?? "")
                .toLowerCase()
                .includes(
                  normalizedSearch
                )
          );
        }
      );

    }, [
      orderedPromises,
      promiseSearchTerm
    ]);


  const promiseTotalPages =
    Math.max(
      1,
      Math.ceil(
        filteredPromises.length /
        PROMISES_PER_PAGE
      )
    );


  useEffect(() => {

    setPromisePage(1);

  }, [promiseSearchTerm]);


  useEffect(() => {

    if (
      promisePage >
      promiseTotalPages
    ) {

      setPromisePage(
        promiseTotalPages
      );
    }

  }, [
    promisePage,
    promiseTotalPages
  ]);


  const paginatedPromises =
    useMemo(() => {

      const startIndex =
        (promisePage - 1) *
        PROMISES_PER_PAGE;

      return filteredPromises.slice(
        startIndex,
        startIndex +
        PROMISES_PER_PAGE
      );

    }, [
      filteredPromises,
      promisePage
    ]);


  const firstVisiblePromise =
    filteredPromises.length === 0

      ? 0

      : (
          (promisePage - 1) *
          PROMISES_PER_PAGE
        ) + 1;


  const lastVisiblePromise =
    Math.min(
      promisePage *
      PROMISES_PER_PAGE,
      filteredPromises.length
    );


  const promisePaginationItems =
    useMemo(() => {

      if (
        promiseTotalPages <= 7
      ) {

        return Array.from(
          {
            length:
              promiseTotalPages
          },
          (_, index) =>
            index + 1
        );
      }


      const items = [1];

      const windowStart =
        Math.max(
          2,
          promisePage - 1
        );

      const windowEnd =
        Math.min(
          promiseTotalPages - 1,
          promisePage + 1
        );


      if (windowStart > 2) {

        items.push(
          "start-ellipsis"
        );
      }


      for (
        let page = windowStart;
        page <= windowEnd;
        page += 1
      ) {

        items.push(page);
      }


      if (
        windowEnd <
        promiseTotalPages - 1
      ) {

        items.push(
          "end-ellipsis"
        );
      }


      items.push(
        promiseTotalPages
      );

      return items;

    }, [
      promisePage,
      promiseTotalPages
    ]);


  return (
    <section className="page-section promise-page">

      <section className="metrics-grid promise-metrics">
  <MetricCard
    icon={<Activity />}
    label="Active Promises"
    value={activePromises.length}
  />

  <MetricCard
    icon={<CircleDollarSign />}
    label="Active Promise Value"
    value={formatMoney(totalPromisedAmount)}
  />

  <MetricCard
    icon={<Clock3 />}
    label="Due / Broken"
    value={
      <span className="promise-status-metric">

        <span className="promise-status-metric-item">
          <strong className="metric-warning-value">
            {duePromises.length}
          </strong>
          <small>Due</small>
        </span>

        <span className="metric-slash">
          /
        </span>

        <span className="promise-status-metric-item">
          <strong className="metric-danger-value">
            {brokenPromises.length}
          </strong>
          <small>Broken</small>
        </span>

      </span>
    }
  />

  <MetricCard
    icon={<CheckCircle2 />}
    label="Promises Kept"
    value={keptPromises.length}
  />
</section>

      <section className="panel promise-table-panel">
        <div className="panel-header promise-panel-header">

          <div>

            <h3>
              Promise-to-Pay Commitments
            </h3>

            <p>
              Customer commitments and their current lifecycle status
            </p>

          </div>


          <span className="case-count">

            {filteredPromises.length}

            {promiseSearchTerm.trim() !== ""
              ? ` of ${orderedPromises.length} commitments`
              : " commitments"}

          </span>

        </div>

        <div className="section-search-row">
          <input
            className="cases-search section-search-input"
            type="search"
            value={promiseSearchTerm}
            placeholder="Search payment, customer, status or language..."
            aria-label="Search Promise-to-Pay commitments"
            onChange={(event) =>
              setPromiseSearchTerm(
                event.target.value
              )
            }
          />

          {promiseSearchTerm.trim() !== "" && (
            <button
              type="button"
              className="clear-filters-button section-search-clear"
              onClick={() =>
                setPromiseSearchTerm("")
              }
            >
              Clear search
            </button>
          )}
        </div>

        {promises.length === 0 ? (
          <div className="blocked-action-message">
            <Clock3 size={17} />
            No Promise-to-Pay commitments have been captured yet.
          </div>
        ) : filteredPromises.length === 0 ? (
          <div className="empty-filter-state promise-search-empty">
            No commitments match “{promiseSearchTerm.trim()}”.
          </div>
        ) : (
          <div className="table-container promise-table-container">
            <table className="promise-table">
              <thead>
                <tr>
                  <th className="promise-toggle-column"></th>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Promised Date</th>
                  <th>Language</th>
                  <th>Analysis Confidence</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {paginatedPromises.map((item) => {
                  const isExpanded = expandedPromiseId === item.paymentId;
                  const confidence = item.promise?.confidence != null
                    ? Math.round(Number(item.promise.confidence) * 100)
                    : null;

                  return (
                    <Fragment key={item.paymentId}>
                      <tr
                        className={`promise-row ${isExpanded ? "expanded" : ""}`}
                        onClick={() =>
                          setExpandedPromiseId(
                            isExpanded ? null : item.paymentId
                          )
                        }
                      >
                        <td className="promise-toggle-cell">
                          <button
                            className="promise-expand-button"
                            type="button"
                            aria-label={isExpanded ? "Collapse promise" : "Expand promise"}
                            aria-expanded={isExpanded}
                            onClick={(event) => {
                              event.stopPropagation();

                              setExpandedPromiseId(
                                isExpanded
                                  ? null
                                  : item.paymentId
                              );
                            }}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>

                        <td>
                          <div className="case-main">
                            <strong>{item.paymentId}</strong>
                            <span>{item.customerId}</span>
                          </div>
                        </td>

                        <td className="money-cell">
                          {formatMoney(item.promise?.promisedAmount || 0)}
                        </td>

                        <td>
                          {item.promise?.promisedDate
                            ? formatPromiseDate(item.promise.promisedDate)
                            : "No date captured"}
                        </td>

                        <td>
                          {formatAction(item.promise?.language || "unknown")}
                        </td>

                        <td>
                          <div className="confidence-cell">
                            <span>{confidence != null ? `${confidence}%` : "—"}</span>
                            <div className="confidence-track">
                              <span style={{ width: `${confidence || 0}%` }}></span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <StatusBadge status={item.promise?.promiseStatus || "UNKNOWN"} />
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="promise-expanded-row">
                          <td colSpan="7">
                            <div className="promise-expanded-card">
                              <div className="promise-summary-grid">
                                <div className="promise-customer-block">
                                  <div className="promise-avatar">
                                    <UserRound size={20} />
                                  </div>
                                  <div>
                                    <span>Customer</span>
                                    <strong>{item.customerId}</strong>
                                    <small>{item.paymentId}</small>
                                  </div>
                                </div>

                                <DetailItem
                                  label="Promised Amount"
                                  value={formatMoney(item.promise?.promisedAmount || 0)}
                                />

                                <DetailItem
                                  label="Promised Date"
                                  value={
                                    item.promise?.promisedDate
                                      ? formatPromiseDate(item.promise.promisedDate)
                                      : "No date captured"
                                  }
                                />

                                <DetailItem
                                  label="Language"
                                  value={formatAction(item.promise?.language || "unknown")}
                                />

                                <DetailItem
                                  label="Analysis Confidence"
                                  value={confidence != null ? `${confidence}%` : "—"}
                                />
                              </div>

                              <div className="promise-conversation-box">
                                <div className="promise-conversation-title">
                                  <MessageSquare size={15} />
                                  Conversation Summary
                                </div>
                                <p>
                                  {item.promise?.conversationSummary ||
                                    "No conversation summary available."}
                                </p>
                              </div>

                              <div className="promise-expanded-footer">
                                <div>
                                  <CalendarDays size={14} />
                                  Commitment captured by RecoverAI
                                </div>

                                {item.promise?.promiseStatus === "BROKEN" && (
                                  <button
                                    className="secondary-button"
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSelectedPaymentId(item.paymentId);
                                    }}
                                  >
                                    <Play size={15} />
                                    Open Recovery Case
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}


        {
          filteredPromises.length > 0
          &&
          (
            <div className="cases-pagination promise-pagination">

              <div className="pagination-summary">

                Showing{" "}

                <strong>
                  {firstVisiblePromise}
                </strong>

                {" to "}

                <strong>
                  {lastVisiblePromise}
                </strong>

                {" of "}

                <strong>
                  {filteredPromises.length}
                </strong>

                {promiseSearchTerm.trim() !== ""
                  ? ` matching of ${orderedPromises.length} commitments`
                  : " commitments"}

              </div>


              <div
                className="pagination-controls"
                aria-label="Promise commitments pagination"
              >

                <button
                  type="button"
                  className="pagination-arrow"
                  aria-label="Previous promises page"
                  disabled={
                    promisePage === 1
                  }
                  onClick={() =>
                    setPromisePage(
                      (page) =>
                        Math.max(
                          1,
                          page - 1
                        )
                    )
                  }
                >
                  ‹
                </button>


                {
                  promisePaginationItems.map(
                    (item) => {

                      if (
                        typeof item !==
                        "number"
                      ) {

                        return (
                          <span
                            key={item}
                            className="pagination-ellipsis"
                          >
                            …
                          </span>
                        );
                      }


                      return (
                        <button
                          key={item}
                          type="button"
                          className={
                            `pagination-page ${
                              promisePage === item
                                ? "active"
                                : ""
                            }`
                          }
                          aria-current={
                            promisePage === item
                              ? "page"
                              : undefined
                          }
                          onClick={() => {

                            setPromisePage(
                              item
                            );

                            setExpandedPromiseId(
                              null
                            );
                          }}
                        >
                          {item}
                        </button>
                      );
                    }
                  )
                }


                <button
                  type="button"
                  className="pagination-arrow"
                  aria-label="Next promises page"
                  disabled={
                    promisePage ===
                    promiseTotalPages
                  }
                  onClick={() =>
                    setPromisePage(
                      (page) =>
                        Math.min(
                          promiseTotalPages,
                          page + 1
                        )
                    )
                  }
                >
                  ›
                </button>

              </div>

            </div>
          )
        }

      </section>

      {selectedRecoveryCase && (
        <CaseDetailPanel
          payment={selectedRecoveryCase}
          onClose={() => setSelectedPaymentId(null)}
          refreshData={refreshData}
        />
      )}
    </section>
  );
}


// ======================================================
// ANALYTICS
// ======================================================

function AnalyticsPage({
  summary,
  batchEvaluation,
  batchError,
  theme
}) {

  const chartText =
  theme === "dark"
    ? "#697386"
    : "#64748b";


const chartGrid =
  theme === "dark"
    ? "#242b38"
    : "#e2e8f0";


const tooltipBackground =
  theme === "dark"
    ? "#141923"
    : "#ffffff";


const tooltipBorder =
  theme === "dark"
    ? "#334155"
    : "#e2e8f0";


const tooltipText =
  theme === "dark"
    ? "#f8fafc"
    : "#0f172a";

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

      <section className="analytics-section-heading analytics-live-heading">

        <div className="analytics-heading-copy">

          <div className="analytics-heading-title-row">

            <span className="analytics-heading-icon">
              <Activity size={17} />
            </span>

            <h2>
              Live Recovery Performance
            </h2>

            <span className="analytics-mode-badge live">
              Live
            </span>

          </div>

          <p>
            Actual RecoverAI case outcomes, with Razorpay-confirmed
            Test Mode recoveries separated from simulated results.
          </p>

        </div>

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
              Live Recovery Conversion by Action
            </h3>

            <p>
              Share of executed actions whose cases currently reached
              a recovered outcome
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
    fontSize: 11,
    fill: chartText
  }}

  axisLine={{
    stroke: chartGrid
  }}

  tickLine={false}
/>


<YAxis
  domain={[
    0,
    100
  ]}

  tick={{
    fontSize: 11,
    fill: chartText
  }}

  axisLine={false}

  tickLine={false}
/>


<Tooltip
  contentStyle={{
    backgroundColor:
      tooltipBackground,

    border:
      `1px solid ${tooltipBorder}`,

    borderRadius:
      "8px",

    color:
      tooltipText,

    fontSize:
      "12px"
  }}

  labelStyle={{
    color:
      tooltipText
  }}

  cursor={{
    fill:
      theme === "dark"
        ? "rgba(37, 99, 255, 0.05)"
        : "rgba(37, 99, 235, 0.05)"
  }}
/>


<Bar
  dataKey="successRate"

  maxBarSize={58}

  radius={[
    6,
    6,
    0,
    0
  ]}

  fill={
    theme === "dark"
      ? "#2563ff"
      : "#2563eb"
  }
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

        <div className="batch-evaluation-header analytics-benchmark-heading">

          <div className="analytics-heading-copy">

            <div className="analytics-heading-title-row">

              <span className="analytics-heading-icon benchmark">
                <BarChart3 size={17} />
              </span>

              <h2>
                50-Payment Batch Evaluation
              </h2>

              <span className="analytics-mode-badge synthetic">
                Benchmark
              </span>

            </div>

            <p>
              Fixed synthetic evaluation for comparing recovery strategies
              without presenting projected results as live merchant performance.
            </p>

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

              <div
                className="batch-safety-banner"
                title="This benchmark does not call Gemini, create Razorpay links, or modify live recovery records."
              >

                <ShieldCheck size={20} />

                <div>

                  <strong>
                    Safe benchmark mode
                  </strong>

                  <p>
                    No Gemini calls · No Razorpay links ·
                    no live recovery records changed
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
                        How benchmark cases were routed
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
                      <span>AI-Assisted Evaluation</span>
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
                      Projected success rate by recovery strategy
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
                          fontSize: 11,
                          fill: chartText
                        }}
                        axisLine={{
                          stroke: chartGrid
                        }}
                        tickLine={false}
                      />

                      <YAxis
                        domain={[0, 100]}
                        tick={{
                          fontSize: 11,
                          fill: chartText
                        }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <Tooltip
                        contentStyle={{
                          backgroundColor: tooltipBackground,
                          border: `1px solid ${tooltipBorder}`,
                          borderRadius: "8px",
                          color: tooltipText,
                          fontSize: "12px"
                        }}
                        labelStyle={{
                          color: tooltipText
                        }}
                        cursor={{
                          fill: theme === "dark"
                            ? "rgba(37, 99, 255, 0.05)"
                            : "rgba(37, 99, 235, 0.05)"
                        }}
                      />

                      <Bar
                        dataKey="successRate"
                        radius={[6, 6, 0, 0]}
                        fill={
                          theme === "dark"
                            ? "#2563ff"
                            : "#2563eb"
                        }
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

  const AUDIT_EVENTS_PER_PAGE = 10;


  const [
    auditPage,
    setAuditPage
  ] = useState(1);


  const [
    auditSearchTerm,
    setAuditSearchTerm
  ] = useState("");


  const latestLogs =
    useMemo(
      () => [
        ...auditLogs
      ].reverse(),
      [auditLogs]
    );


  const filteredAuditLogs =
    useMemo(() => {

      const normalizedSearch =
        auditSearchTerm
          .trim()
          .toLowerCase();


      if (normalizedSearch === "") {

        return latestLogs;
      }


      return latestLogs.filter(
        (log) => {

          const searchableValues = [
            log.paymentId,
            log.event,
            log.outcome,
            log.recoveryAction,
            log.actionMessage,
            log.explanation,
            log.razorpay?.razorpayPaymentId,
            log.razorpayPaymentId,
            log.timestamp
          ];


          return searchableValues.some(
            (value) =>
              String(value ?? "")
                .toLowerCase()
                .includes(
                  normalizedSearch
                )
          );
        }
      );

    }, [
      latestLogs,
      auditSearchTerm
    ]);


  const auditTotalPages =
    Math.max(
      1,
      Math.ceil(
        filteredAuditLogs.length /
        AUDIT_EVENTS_PER_PAGE
      )
    );


  useEffect(() => {

    setAuditPage(1);

  }, [auditSearchTerm]);


  useEffect(() => {

    if (
      auditPage >
      auditTotalPages
    ) {

      setAuditPage(
        auditTotalPages
      );
    }

  }, [
    auditPage,
    auditTotalPages
  ]);


  const paginatedAuditLogs =
    useMemo(() => {

      const startIndex =
        (auditPage - 1) *
        AUDIT_EVENTS_PER_PAGE;

      return filteredAuditLogs.slice(
        startIndex,
        startIndex +
        AUDIT_EVENTS_PER_PAGE
      );

    }, [
      filteredAuditLogs,
      auditPage
    ]);


  const firstVisibleAudit =
    filteredAuditLogs.length === 0

      ? 0

      : (
          (auditPage - 1) *
          AUDIT_EVENTS_PER_PAGE
        ) + 1;


  const lastVisibleAudit =
    Math.min(
      auditPage *
      AUDIT_EVENTS_PER_PAGE,
      filteredAuditLogs.length
    );


  const auditPaginationItems =
    useMemo(() => {

      if (
        auditTotalPages <= 7
      ) {

        return Array.from(
          {
            length:
              auditTotalPages
          },
          (_, index) =>
            index + 1
        );
      }


      const items = [1];

      const windowStart =
        Math.max(
          2,
          auditPage - 1
        );

      const windowEnd =
        Math.min(
          auditTotalPages - 1,
          auditPage + 1
        );


      if (windowStart > 2) {

        items.push(
          "start-ellipsis"
        );
      }


      for (
        let page = windowStart;
        page <= windowEnd;
        page += 1
      ) {

        items.push(page);
      }


      if (
        windowEnd <
        auditTotalPages - 1
      ) {

        items.push(
          "end-ellipsis"
        );
      }


      items.push(
        auditTotalPages
      );

      return items;

    }, [
      auditPage,
      auditTotalPages
    ]);


  /*
    Audit cards should describe what actually happened.

    A payment-confirmed event must not continue showing the
    earlier recovery instruction (for example, "Send Alternative
    Payment Method"). That instruction belonged to a previous
    audit event, not the confirmation event itself.
  */

  const getAuditActionLabel =
    (log) => {

      switch (
        log.event
      ) {

        case "RAZORPAY_PAYMENT_CONFIRMED":
          return "Payment confirmed by Razorpay";

        case "RECOVERY_PROCESSED":
          return log.recoveryAction

            ? formatAction(
                log.recoveryAction
              )

            : "Recovery processed";

        case "PROMISE_CREATED":
          return "Promise to Pay recorded";

        case "CALLBACK_REQUESTED":
          return "Callback request recorded";

        case "PAYMENT_ALREADY_MADE":
          return "Payment verification requested";

        default:
          return formatAction(
            log.event ||
            log.recoveryAction ||
            "Audit event"
          );
      }
    };


  return (

    <section className="panel audit-panel">

      <div className="panel-header audit-panel-header">

        <div>

          <h3>
            Recovery Audit Timeline
          </h3>

          <p>
            Complete trace of agent decisions,
            actions and outcomes
          </p>

        </div>


        <span className="case-count">

          {
            filteredAuditLogs.length
          }

          {auditSearchTerm.trim() !== ""
            ? ` of ${auditLogs.length} events`
            : " events"}

        </span>

      </div>


      <div className="section-search-row audit-search-row">
        <input
          className="cases-search section-search-input"
          type="search"
          value={auditSearchTerm}
          placeholder="Search payment ID, event, outcome or Razorpay ID..."
          aria-label="Search audit trail"
          onChange={(event) =>
            setAuditSearchTerm(
              event.target.value
            )
          }
        />

        {auditSearchTerm.trim() !== "" && (
          <button
            type="button"
            className="clear-filters-button section-search-clear"
            onClick={() =>
              setAuditSearchTerm("")
            }
          >
            Clear search
          </button>
        )}
      </div>


      <div className="audit-list">

        {
          paginatedAuditLogs.length > 0

            ?

          paginatedAuditLogs.map(
            (log) => (

              <article
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


                <div className="audit-event-main">

                  <div className="audit-payment-row">

                    <strong>
                      {log.paymentId}
                    </strong>

                    <StatusBadge
                      status={
                        log.outcome
                      }
                    />

                  </div>


                  <span className="audit-event-type">

                    {
                      formatAction(
                        log.event
                      )
                    }

                  </span>

                </div>


                <div className="audit-event-description">

                  <p className="audit-message">

                    {
                      log.actionMessage ||
                      log.explanation ||
                      "Recovery event recorded."
                    }

                  </p>


                </div>


                <div className="audit-action-field">

                  <span className="audit-field-label">
                    Action taken
                  </span>

                  <strong>

                    {
                      getAuditActionLabel(
                        log
                      )
                    }

                  </strong>

                </div>


                <div className="audit-event-meta">

                  <span className="audit-field-label">
                    Recorded at
                  </span>

                  <strong className="audit-time">

                    {
                      formatDate(
                        log.timestamp
                      )
                    }

                  </strong>


                  {
                    log.razorpay
                      ?.razorpayPaymentId
                    &&
                    (
                      <span className="audit-razorpay-id">

                        {
                          log
                            .razorpay
                            .razorpayPaymentId
                        }

                      </span>
                    )
                  }

                </div>

              </article>

            )
          )

            :

            (
              <div className="audit-empty-state">
                <ShieldCheck size={18} />

                <div>
                  <strong>
                    {auditSearchTerm.trim() !== ""
                      ? "No matching audit events"
                      : "No audit events yet"}
                  </strong>
                  <p>
                    {auditSearchTerm.trim() !== ""
                      ? `No audit events match “${auditSearchTerm.trim()}”.`
                      : "Recovery decisions and state transitions will appear here once cases are processed."}
                  </p>
                </div>
              </div>
            )
        }

      </div>


      {
        filteredAuditLogs.length > 0
        &&
        (
          <div className="cases-pagination audit-pagination">

            <div className="pagination-summary">

              Showing{" "}

              <strong>
                {firstVisibleAudit}
              </strong>

              {" to "}

              <strong>
                {lastVisibleAudit}
              </strong>

              {" of "}

              <strong>
                {filteredAuditLogs.length}
              </strong>

              {auditSearchTerm.trim() !== ""
                ? ` matching of ${latestLogs.length} events`
                : " events"}

            </div>


            <div
              className="pagination-controls"
              aria-label="Audit timeline pagination"
            >

              <button
                type="button"
                className="pagination-arrow"
                aria-label="Previous audit page"
                disabled={
                  auditPage === 1
                }
                onClick={() =>
                  setAuditPage(
                    (page) =>
                      Math.max(
                        1,
                        page - 1
                      )
                  )
                }
              >
                ‹
              </button>


              {
                auditPaginationItems.map(
                  (item) => {

                    if (
                      typeof item !==
                      "number"
                    ) {

                      return (
                        <span
                          key={item}
                          className="pagination-ellipsis"
                        >
                          …
                        </span>
                      );
                    }


                    return (
                      <button
                        key={item}
                        type="button"
                        className={
                          `pagination-page ${
                            auditPage === item
                              ? "active"
                              : ""
                          }`
                        }
                        aria-current={
                          auditPage === item
                            ? "page"
                            : undefined
                        }
                        onClick={() =>
                          setAuditPage(
                            item
                          )
                        }
                      >
                        {item}
                      </button>
                    );
                  }
                )
              }


              <button
                type="button"
                className="pagination-arrow"
                aria-label="Next audit page"
                disabled={
                  auditPage ===
                  auditTotalPages
                }
                onClick={() =>
                  setAuditPage(
                    (page) =>
                      Math.min(
                        auditTotalPages,
                        page + 1
                      )
                  )
                }
              >
                ›
              </button>

            </div>

          </div>
        )
      }

    </section>
  );
}


// ======================================================
// STRATEGY CHART
// ======================================================

function StrategyChart({
  strategyData,
  theme
}) {

  const chartText =
  theme === "dark"
    ? "#697386"
    : "#64748b";


const chartGrid =
  theme === "dark"
    ? "#242b38"
    : "#e2e8f0";


const tooltipBackground =
  theme === "dark"
    ? "#141923"
    : "#ffffff";


const tooltipBorder =
  theme === "dark"
    ? "#334155"
    : "#e2e8f0";


const tooltipText =
  theme === "dark"
    ? "#f8fafc"
    : "#0f172a";

  return (

    <div className="panel chart-panel">

      <div className="panel-header">

        <div>

          <h3>
            Recovery Strategy Outcomes
          </h3>

          <p>
            Current recovery conversion after each executed action
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
            margin={{
              top: 8,
              right: 12,
              left: 4,
              bottom: 18
            }}
            barCategoryGap="34%"
          >

            <XAxis
              dataKey="action"
              interval={0}
              height={54}
              tickMargin={13}
              tick={{
                fontSize: 12,
                fill: chartText
              }}
              axisLine={{
                stroke: chartGrid
              }}
              tickLine={false}
            />

            <YAxis
              domain={[
                0,
                100
              ]}
              tick={{
                fontSize: 12,
                fill: chartText
              }}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBackground,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: "8px",
                color: tooltipText,
                fontSize: "12px"
              }}
              labelStyle={{
                color: tooltipText
              }}
              cursor={{
                fill: theme === "dark"
                  ? "rgba(37, 99, 255, 0.05)"
                  : "rgba(37, 99, 235, 0.05)"
              }}
            />


            <Bar

  dataKey="successRate"

  radius={[
    6,
    6,
    0,
    0
  ]}

  fill={
    theme === "dark"
      ? "#2563ff"
      : "#2563eb"
  }
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
              Payment Link
            </th>

          </tr>

        </thead>


        <tbody>

          {
            states.length > 0

              ?

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
                      state.recoveryAttempts ??
                      0
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

              :

              (
                <tr>
                  <td
                    colSpan="6"
                    className="empty-filter-state"
                  >
                    No recovery states have been recorded yet.
                  </td>
                </tr>
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

    <div className="metric-card" data-label={label}>

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
  type = "text",
  disabled = false,
  min,
  step
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
        disabled={disabled}
        min={min}
        step={step}
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
  options,
  disabled = false
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
        disabled={disabled}
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

      <span className="status-badge-dot" aria-hidden="true"></span>

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

    CREATE_PROMISE_TO_PAY:
      "Promise to Pay",

    START_CONVERSATIONAL_RECOVERY:
      "Conversation",

    SCHEDULE_CALLBACK:
      "Callback",

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

function formatPromiseDate(
  date
) {

  if (!date) {
    return "No date captured";
  }

  return new Date(
    date
  ).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    }
  );
}


export default App;