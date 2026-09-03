// Mushavo Budget authenticated application — release 48
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.9/+esm";

const config = window.MUSHAVO_BUDGET_CONFIG || window.EXPENSE_TRACKER_CONFIG || {};
const placeholderValues = ["YOUR-PROJECT-REF", "YOUR-SUPABASE-PUBLISHABLE-KEY"];
const isConfigured =
  config.supabaseUrl &&
  config.supabasePublishableKey &&
  !placeholderValues.some((value) =>
    `${config.supabaseUrl} ${config.supabasePublishableKey}`.includes(value)
  );

const supabase = isConfigured
  ? createClient(config.supabaseUrl, config.supabasePublishableKey)
  : null;

const state = {
  session: null,
  profile: null,
  isAdmin: false,
  adminRole: null,
  headApproval: null,
  families: [],
  family: null,
  members: [],
  paymentItems: [],
  paymentRecords: [],
  familyInvitations: [],
  notifications: [],
  workspaces: [],
  workspaceMembers: [],
  workspaceSubscription: null,
  workspaceEntitlement: null,
  workspaceSettings: null,
  supportedCurrencies: [],
  exchangeRates: [],
  exchangeRateStatus: null,
  paymentConversions: [],
  billableMemberCount: 1,
  memberUsage: null,
  plans: [],
  planPrices: [],
  planLimits: [],
  renewalRequests: [],
  subscriptionInvoices: [],
  subscriptionPayments: [],
  entitlementHistory: [],
  heads: [],
  adminProfiles: [],
  adminFamilies: [],
  adminMembers: [],
  adminPaymentItems: [],
  adminPaymentRecords: [],
  payments: [],
  adminNotes: [],
  adminWorkspaces: [],
  adminWorkspaceMembers: [],
  adminSubscriptions: [],
  adminPlans: [],
  adminPlanPrices: [],
  adminPlanFeatures: [],
  adminPlanLimits: [],
  adminEnquiries: [],
  adminRenewalRequests: [],
  adminSubscriptionInvoices: [],
  adminSubscriptionPayments: [],
  adminSubscriptionProofs: [],
  adminSubscriptionReviews: [],
  adminSubscriptionMonitor: [],
  adminFinanceSettings: null,
  adminPaymentConversions: [],
  adminRateStatus: null,
  adminTab: "dashboard",
  familyTab: "dashboard",
  editingObligationId: null,
  filterMonth: toMonthValue(new Date()),
  filterStatus: "all",
  reportCurrencyFilter: "all",
  reportViewMode: "original",
  reportReportingCurrency: null
};

const realtime = {
  channel: null,
  refreshTimer: null,
  refreshInFlight: false
};

let dashboardFitFrame = null;
let appLoadPromise = null;
let appLoadUserId = null;

const PAYMENT_PROOF_BUCKET = "payment-proofs";
const SUBSCRIPTION_PROOF_BUCKET = "subscription-proofs";
const PAYMENT_PROOF_MAX_BYTES = 10 * 1024 * 1024;
const PAYMENT_PROOF_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const QUERY_TIMEOUT_MS = 15000;

const $ = (selector) => document.querySelector(selector);

const views = {
  loading: $("#loadingView"),
  configWarning: $("#configWarning"),
  appError: $("#appErrorView"),
  auth: $("#authView"),
  setup: $("#setupView"),
  suspended: $("#suspendedView"),
  admin: $("#adminView"),
  app: $("#appView")
};

const adminTabs = new Set(["dashboard", "households", "users", "plans", "finance", "enquiries", "support"]);
const familyTabs = new Set(["dashboard", "payments", "reports", "members", "subscription", "settings"]);
const currencyNames = {
  USD: "en-US",
  ZAR: "en-ZA",
  EUR: "de-DE",
  GBP: "en-GB",
  CAD: "en-CA",
  AUD: "en-AU"
};

const PAYMENT_CURRENCIES = [
  ["AED", "United Arab Emirates Dirham"], ["AUD", "Australian Dollar"], ["BDT", "Bangladeshi Taka"],
  ["BWP", "Botswana Pula"], ["BRL", "Brazilian Real"], ["CAD", "Canadian Dollar"], ["CHF", "Swiss Franc"],
  ["CNY", "Chinese Yuan"], ["DKK", "Danish Krone"], ["EGP", "Egyptian Pound"], ["EUR", "Euro"],
  ["GBP", "British Pound"], ["GHS", "Ghanaian Cedi"], ["HKD", "Hong Kong Dollar"], ["INR", "Indian Rupee"],
  ["JPY", "Japanese Yen"], ["KES", "Kenyan Shilling"], ["KWD", "Kuwaiti Dinar"], ["MUR", "Mauritian Rupee"],
  ["MZN", "Mozambican Metical"], ["NAD", "Namibian Dollar"], ["NGN", "Nigerian Naira"], ["NOK", "Norwegian Krone"],
  ["NZD", "New Zealand Dollar"], ["OMR", "Omani Rial"], ["PKR", "Pakistani Rupee"], ["PLN", "Polish Zloty"],
  ["QAR", "Qatari Riyal"], ["SAR", "Saudi Riyal"], ["SEK", "Swedish Krona"], ["SGD", "Singapore Dollar"],
  ["SZL", "Swazi Lilangeni"], ["THB", "Thai Baht"], ["TRY", "Turkish Lira"], ["TZS", "Tanzanian Shilling"],
  ["UGX", "Ugandan Shilling"], ["USD", "US Dollar"], ["ZAR", "South African Rand"], ["ZMW", "Zambian Kwacha"],
  ["ZWG", "Zimbabwe Gold"]
];

const today = new Date();
$("#paymentDate").value = toDateValue(today);
$("#monthFilter").value = state.filterMonth;
$("#reportMonthFilter").value = state.filterMonth;
$("#startDate").value = toDateValue(today);
$("#recordPaymentDate").value = toDateValue(today);
$("#renewalPaymentDate").value = toDateValue(today);
renderPaymentCurrencyOptions("", "USD");
registerServiceWorker();

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  let reloadingForServiceWorker = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadingForServiceWorker) return;
    reloadingForServiceWorker = true;
    window.location.reload();
  });
  const startRegistration = () => {
    navigator.serviceWorker
      .register("./sw.js", { scope: "./", updateViaCache: "none" })
      .then((registration) => registration.update().catch(() => {}))
      .catch((error) => console.warn("Service worker registration failed", error));
  };
  if (document.readyState === "complete") startRegistration();
  else window.addEventListener("load", startRegistration, { once: true });
}

function toDateValue(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthValue(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function monthStart(monthValue) {
  return `${monthValue}-01`;
}

function offsetMonthValue(monthValue, offset) {
  const date = parseDate(monthStart(monthValue));
  return toMonthValue(new Date(date.getFullYear(), date.getMonth() + offset, 1));
}

function monthDiff(fromDate, toDate) {
  return (toDate.getFullYear() - fromDate.getFullYear()) * 12 + toDate.getMonth() - fromDate.getMonth();
}

function lastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function money(amount, currency = "USD") {
  try {
    const digits = state.supportedCurrencies.find((item) => item.code === currency)?.decimal_digits;
    return new Intl.NumberFormat(currencyNames[currency] || "en-US", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: Number.isInteger(digits) ? digits : undefined,
      maximumFractionDigits: Number.isInteger(digits) ? digits : 4
    }).format(Number(amount || 0));
  } catch (_error) {
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }
}

const DECIMAL_SCALE_DIGITS = 12;
const DECIMAL_SCALE = 10n ** BigInt(DECIMAL_SCALE_DIGITS);

function decimalToScaled(value) {
  const normalized = `${value ?? 0}`.trim();
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const digits = `${whole || "0"}${fraction.padEnd(DECIMAL_SCALE_DIGITS, "0").slice(0, DECIMAL_SCALE_DIGITS)}`.replace(/^0+(?=\d)/, "");
  const scaled = BigInt(digits || "0");
  return negative ? -scaled : scaled;
}

function scaledToDecimal(value, fractionDigits = 4) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / DECIMAL_SCALE;
  const remainder = `${absolute % DECIMAL_SCALE}`.padStart(DECIMAL_SCALE_DIGITS, "0");
  const fraction = remainder.slice(0, Math.max(0, fractionDigits)).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

function multiplyScaled(left, right) {
  return (left * right + DECIMAL_SCALE / 2n) / DECIMAL_SCALE;
}

function activeWorkspaceCurrencies() {
  const enabled = state.workspaceSettings?.enabled_currencies;
  return Array.isArray(enabled) && enabled.length ? enabled : PAYMENT_CURRENCIES.map(([code]) => code);
}

function renderPaymentCurrencyOptions(searchTerm = "", selectedCurrency = "") {
  const select = $("#obligationCurrency");
  if (!select) return;
  const queryText = searchTerm.trim().toLowerCase();
  const currentValue = selectedCurrency || select.value || "USD";
  const allowed = new Set(activeWorkspaceCurrencies());
  const matches = PAYMENT_CURRENCIES.filter(([code, name]) =>
    allowed.has(code) && (!queryText || code.toLowerCase().includes(queryText) || name.toLowerCase().includes(queryText))
  );
  if (!queryText && currentValue && !matches.some(([code]) => code === currentValue)) {
    const currentCurrency = PAYMENT_CURRENCIES.find(([code]) => code === currentValue);
    if (currentCurrency) matches.unshift(currentCurrency);
  }
  select.innerHTML = "";
  if (matches.length) {
    matches.forEach(([code, name]) => select.append(new Option(`${code} — ${name}`, code)));
    if (matches.some(([code]) => code === currentValue)) select.value = currentValue;
  } else {
    const emptyOption = new Option("No matching currencies", "");
    emptyOption.disabled = true;
    emptyOption.selected = true;
    select.append(emptyOption);
  }
  const result = $("#currencySearchResult");
  if (result) result.textContent = `${matches.length} currenc${matches.length === 1 ? "y" : "ies"} available`;
}

function setView(viewName) {
  Object.values(views).forEach((view) => view.classList.add("hidden"));
  if (viewName) views[viewName].classList.remove("hidden");
}

function showLoading(title = "Opening your workspace", message = "Loading your latest budget...") {
  $("#loadingTitle").textContent = title;
  $("#loadingMessage").textContent = message;
  setView("loading");
}

function setSubmitting(button, isSubmitting, label) {
  if (!button) return;
  button.disabled = isSubmitting;
  button.textContent = label;
}

function showSignupSuccessMessage() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("signup") !== "success") return;
  url.searchParams.delete("signup");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  showToast("Account created successfully. Sign in with your new account.");
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = friendlyMessage(message);
  toast.classList.remove("hidden");
  window.setTimeout(() => toast.classList.add("hidden"), 3600);
}

function showAppError(error) {
  $("#appErrorMessage").textContent = friendlyMessage(error?.message) || "A database or permission error stopped the app from loading.";
  setView("appError");
}

function friendlyMessage(message = "") {
  const text = `${message}`;
  if (text.includes("ACTIVE_FAMILY_MEMBERSHIP_REQUIRED")) {
    return "An active Mushavo Budget membership is required for this action.";
  }
  if (text.includes("FAMILY_LIMIT_REACHED")) {
    return "You have reached your family limit. Ask the Mushavo Budget admin to increase it.";
  }
  if (text.includes("FAMILY_PLAN_REQUEST_ALREADY_PENDING")) {
    return "A Family plan request is already waiting for review. The family will be created after it is approved.";
  }
  if (text.includes("FAMILY_NAME_REQUIRED")) {
    return "Enter the name of the family you want to create.";
  }
  if (text.includes("INVALID_FAMILY_MEMBER_COUNT")) {
    return "The total number of people must be at least the number included in the Family plan.";
  }
  if (text.includes("MEMBER_LIMIT_REACHED")) {
    return "All paid family places are currently in use or reserved by pending invitations. Purchase another place before inviting someone else.";
  }
  if (text.includes("MEMBER_LIMIT_BELOW_CURRENT_USAGE")) {
    return "The selected member limit cannot be lower than the active members and pending invitations already using this family.";
  }
  if (text.includes("APPROVED_MEMBER_LIMIT_BELOW_USAGE")) {
    return "This payment cannot be approved because its paid member limit is below the family's current active member count.";
  }
  if (text.includes("ACTIVE_FAMILY_SUBSCRIPTION_REQUIRED")) {
    return "An active Family subscription is required before inviting members.";
  }
  if (text.includes("PARTIAL_PAYMENT_CURRENCY_MISMATCH")) {
    return "A partial payment must use the same currency as its payment item.";
  }
  if (text.includes("PAYMENT_CURRENCY_NOT_ENABLED")) {
    return "Enable this currency in Workspace currency settings before saving the payment.";
  }
  if (text.includes("DEFAULT_AND_REPORTING_CURRENCY_MUST_BE_ENABLED")) {
    return "The default and reporting currencies must both be included in the enabled currency list.";
  }
  if (text.includes("INVALID_ENABLED_CURRENCIES") || text.includes("UNSUPPORTED_CURRENCY")) {
    return "Choose at least one supported currency.";
  }
  if (text.includes("CURRENCY_SETTINGS_ACCESS_REQUIRED")) {
    return "Only the workspace owner or an authorized Business finance manager can change these currency settings.";
  }
  if (text.includes("FINANCE_CURRENCY_ACCESS_REQUIRED")) {
    return "Your admin role does not include Finance currency management.";
  }
  if (text.includes("RATE_SYNC_RATE_LIMITED")) {
    return "Rates were synced recently. Wait five minutes before starting another manual sync.";
  }
  if (text.includes("SERVER_CONFIGURATION_INCOMPLETE")) {
    return "The exchange-rate service is not configured. Add the CurrencyAPI and cron secrets to the Supabase Edge Function.";
  }
  if (text.includes("RATE_SNAPSHOT_STORE_FAILED") || text.includes("SYNC_RUN_CREATE_FAILED")) {
    return "The rate service reached the provider but could not save the result. Check the Supabase migration and function logs.";
  }
  if (text.includes("PERSONAL_PAYMENT_LIMIT_REACHED")) {
    return "Free accounts can keep up to 5 active personal payments. Family payments remain unlimited.";
  }
  if (text.includes("WORKSPACE_READ_ONLY")) {
    return "This shared workspace is read-only because its subscription is expired or suspended. The owner can renew it from Subscription.";
  }
  if (text.includes("PLAN_PRICE_NOT_CONFIGURED")) {
    return "This plan does not have an active price for the selected billing period and currency yet.";
  }
  if (text.includes("PAYMENT_AMOUNT_DOES_NOT_MATCH_INVOICE")) {
    return "The plan price or member count changed. Reopen the payment form to load the latest invoice total.";
  }
  if (text.includes("SUBSCRIPTION_REVIEW_ALREADY_PENDING")) {
    return "A subscription payment for this workspace is already waiting for review.";
  }
  if (text.includes("ADDITIONAL_SEAT_PAYMENT_REQUIRED")) {
    return "This member would use an additional paid seat. The Family Head must submit and receive approval for a Household payment covering the new seat first.";
  }
  if (text.includes("WORKSPACE_OWNER_REQUIRED")) {
    return "Only the workspace owner can complete this subscription action.";
  }
  if (text.includes("FINANCE_REVIEW_ACCESS_REQUIRED")) {
    return "Your admin role does not include subscription payment review access.";
  }
  if (text.includes("REJECTION_REASON_REQUIRED")) {
    return "Enter a reason so the workspace owner knows what must be corrected.";
  }
  if (text.includes("MEMBER_MANAGEMENT_ACCESS_REQUIRED")) {
    return "Your active membership does not currently include permission to manage family members.";
  }
  if (text.includes("CANNOT_REMOVE_FAMILY_OWNER")) {
    return "The family owner cannot be removed. Delete the entire family instead if you no longer need it.";
  }
  if (text.includes("MEMBER_NOT_FOUND")) {
    return "That member is no longer available in this family.";
  }
  if (text.includes("FAMILY_NOT_FOUND")) {
    return "That family no longer exists or you do not own it.";
  }
  if (text.includes("USER_NOT_REGISTERED")) {
    return "That user is not registered on Mushavo Budget. Ask them to sign up before sending an invitation.";
  }
  if (text.includes("CANNOT_INVITE_YOURSELF")) {
    return "You cannot invite your own email address.";
  }
  if (text.includes("PUSH_SUBSCRIPTION_ENDPOINT_CONFLICT")) {
    return "This browser subscription belongs to another signed-in account. Disable notifications for that account or reset this site's notification permission, then try again.";
  }
  if (text.includes("ALREADY_FAMILY_MEMBER")) {
    return "That user is already part of this family.";
  }
  if (text.includes("INVITATION_ALREADY_PENDING")) {
    return "That user already has a pending invitation for this family.";
  }
  if (text.includes("INVITATION_NOT_AVAILABLE")) {
    return "This invitation is no longer available. Refresh the page to see its latest status.";
  }
  if (text.includes("FAMILY_ALREADY_EXISTS")) {
    return "You already created a family workspace.";
  }
  if (text.includes("infinite recursion")) {
    return "A database access rule needs to be updated before this workspace can open.";
  }
  if (text.includes("permission denied") || text.includes("violates row-level security")) {
    return "You do not have permission to complete that action yet.";
  }
  if (text.includes("Failed to fetch") || text.includes("NetworkError")) {
    return "The network connection failed. Check your internet connection and try again.";
  }
  if (text.includes("duplicate key")) {
    if (text.includes("family_invitations")) {
      return "That user already has a pending invite for this family.";
    }
    return "That record already exists. Update the existing one instead.";
  }
  return text;
}

function appName() {
  return "Mushavo Budget";
}

function familyCurrency() {
  return state.family?.currency || state.paymentItems[0]?.currency || "USD";
}

function hasJoinableFamilyInvitation() {
  return state.familyInvitations.some((invitation) =>
    invitation.invitee_email?.toLowerCase() === state.session?.user?.email?.toLowerCase() &&
    ["pending", "accepted"].includes(invitation.status)
  );
}

function openDrawer() {
  const activeView = state.isAdmin ? views.admin : views.app;
  activeView?.classList.add("drawer-open");
  activeView?.querySelector(".drawer-backdrop")?.classList.remove("hidden");
}

function closeDrawer() {
  [views.admin, views.app].forEach((view) => {
    view?.classList.remove("drawer-open");
    view?.querySelector(".drawer-backdrop")?.classList.add("hidden");
  });
}

function confirmAction({ title = "Are you sure?", message = "", action = "Confirm" }) {
  const dialog = $("#confirmDialog");
  $("#confirmDialogTitle").textContent = title;
  $("#confirmDialogMessage").textContent = message;
  $("#confirmDialogConfirm").textContent = action;
  dialog.showModal();
  return new Promise((resolve) => {
    const form = $("#confirmDialogForm");
    const handleSubmit = (event) => {
      event.preventDefault();
      cleanup();
      dialog.close();
      resolve(true);
    };
    const handleClose = () => {
      cleanup();
      resolve(false);
    };
    const cleanup = () => {
      form.removeEventListener("submit", handleSubmit);
      dialog.removeEventListener("close", handleClose);
    };
    form.addEventListener("submit", handleSubmit);
    dialog.addEventListener("close", handleClose);
  });
}

function routeFromHash() {
  const route = window.location.hash.replace(/^#\/?/, "");
  const [area, tab] = route.split("/");
  return { area, tab };
}

function applyRouteFromHash() {
  const { area, tab } = routeFromHash();
  if (area === "admin" && adminTabs.has(tab)) state.adminTab = tab;
  if (area === "family" && familyTabs.has(tab)) state.familyTab = tab;
}

function setRoute(area, tab, replace = false) {
  const nextHash = `#${area}/${tab}`;
  if (window.location.hash === nextHash) return;
  if (replace) {
    window.history.replaceState(null, "", nextHash);
    return;
  }
  window.history.pushState(null, "", nextHash);
}

function syncRouteForWorkspace(area) {
  applyRouteFromHash();
  if (area === "admin") {
    if (!adminTabs.has(state.adminTab)) state.adminTab = "dashboard";
    setRoute("admin", state.adminTab, true);
  }
  if (area === "family") {
    if (!familyTabs.has(state.familyTab)) state.familyTab = "dashboard";
    setRoute("family", state.familyTab, true);
  }
}

function assertSupabase() {
  if (!supabase) {
    setView("configWarning");
    throw new Error("Supabase is not configured.");
  }
}

function isSameAuthUser(previousSession, nextSession) {
  return Boolean(previousSession?.user?.id && previousSession.user.id === nextSession?.user?.id);
}

function realtimeTablesForCurrentView() {
  const sharedTables = [
    "profiles", "family_heads", "families", "family_members", "payment_items", "payment_records",
    "family_invitations", "notifications", "budget_workspaces", "workspace_members",
    "workspace_invitations", "workspace_subscriptions", "subscription_renewal_requests",
    "subscription_invoices", "subscription_payments", "subscription_entitlement_history"
  ];
  if (!state.isAdmin) return sharedTables;
  return [...sharedTables, "plans", "plan_prices", "plan_features", "plan_limits", "payments", "enquiries", "admin_support_notes"];
}

function stopRealtime() {
  if (realtime.refreshTimer) {
    window.clearTimeout(realtime.refreshTimer);
    realtime.refreshTimer = null;
  }
  realtime.refreshInFlight = false;
  if (!supabase || !realtime.channel) return;
  supabase.removeChannel(realtime.channel);
  realtime.channel = null;
}

function startRealtime() {
  if (!supabase || !state.session) return;
  stopRealtime();
  if (state.session.access_token) supabase.realtime.setAuth(state.session.access_token);
  const channelName = `mushavo-budget:${state.session.user.id}:${state.isAdmin ? "admin" : "family"}`;
  const channel = supabase.channel(channelName);

  realtimeTablesForCurrentView().forEach((table) => {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      (payload) => queueRealtimeRefresh(payload)
    );
  });

  realtime.channel = channel.subscribe((status) => {
    if (status === "CHANNEL_ERROR") {
      console.warn("Realtime channel error. Check that tables are enabled in the supabase_realtime publication.");
    }
  });
}

function queueRealtimeRefresh(payload) {
  console.debug("Realtime change received", payload.table, payload.eventType);
  if (realtime.refreshTimer) window.clearTimeout(realtime.refreshTimer);
  realtime.refreshTimer = window.setTimeout(() => {
    refreshVisibleData().catch((error) => {
      console.error("Realtime refresh failed", error);
      showToast(error.message);
    });
  }, 180);
}

async function refreshVisibleData() {
  if (!state.session || realtime.refreshInFlight) return;
  const sessionId = state.session.user.id;
  realtime.refreshInFlight = true;
  try {
    if (state.isAdmin) {
      await loadAdminData();
      if (state.session?.user?.id !== sessionId) return;
      renderAdmin();
      return;
    }
    await Promise.all([loadAccess(), loadFamily()]);
    await loadFamilyData();
    await loadWorkspaceSubscriptionData();
    if (state.session?.user?.id !== sessionId) return;
    renderFamilyApp();
  } finally {
    realtime.refreshInFlight = false;
  }
}

async function query(label, promise) {
  let timeoutId;
  try {
    const { data, error } = await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error("The request took too long. Check your connection and try again.")),
          QUERY_TIMEOUT_MS
        );
      })
    ]);
    if (error) {
      console.error(label, error);
      throw new Error(error.message);
    }
    return data;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function init() {
  showLoading("Opening your workspace", "Checking your secure session...");
  if (!isConfigured) {
    setView("configWarning");
    return;
  }

  applyRouteFromHash();
  const { data } = await supabase.auth.getSession();
  state.session = data.session;

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") return;
    const previousSession = state.session;
    state.session = session;

    if (session && isSameAuthUser(previousSession, session)) {
      if (session.access_token) supabase.realtime.setAuth(session.access_token);
      return;
    }

    if (session) {
      window.setTimeout(() => {
        openAuthenticatedSession(session).catch(handleLoadFailure);
      }, 0);
      return;
    }
    window.setTimeout(handleSignedOut, 0);
  });

  if (state.session) {
    await openAuthenticatedSession(state.session);
  } else {
    setView("auth");
    showSignupSuccessMessage();
  }
}

function handleSignedOut() {
  resetState();
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  setView("auth");
}

function isInvalidStoredSessionError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("jwt issued at future")
    || message.includes("jwt expired")
    || message.includes("invalid jwt")
    || message.includes("invalid refresh token")
    || message.includes("refresh token not found");
}

function removeStoredSupabaseSession() {
  try {
    const projectRef = new URL(config.supabaseUrl).hostname.split(".")[0];
    if (projectRef) window.localStorage.removeItem(`sb-${projectRef}-auth-token`);
  } catch (_error) {
    // The normal sign-out path remains available if storage is unavailable.
  }
}

async function handleLoadFailure(error) {
  console.error(error);
  if (state.session && isInvalidStoredSessionError(error)) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (_signOutError) {
      // Remove only this project's stored session when the invalid JWT also
      // prevents Supabase from completing its normal local sign-out flow.
    }
    removeStoredSupabaseSession();
    handleSignedOut();
    showToast("Your saved session was no longer valid. Please sign in again.");
    return;
  }
  showToast(error.message);
  if (state.session) showAppError(error);
  else setView("auth");
}

function openAuthenticatedSession(session) {
  const userId = session?.user?.id;
  if (!userId) return Promise.reject(new Error("Your secure session could not be opened. Please sign in again."));
  if (appLoadPromise && appLoadUserId === userId) return appLoadPromise;

  resetState();
  state.session = session;
  appLoadUserId = userId;
  showLoading("Opening your workspace", "Loading your latest budget...");
  appLoadPromise = loadApp().then(() => {
    const url = new URL(window.location.href);
    const requestedPlan = url.searchParams.get("plan");
    if (!state.isAdmin && requestedPlan && state.plans.some((plan) => plan.code === requestedPlan)) {
      state.familyTab = "subscription";
      setRoute("family", "subscription", true);
      renderFamilyApp();
      openRenewalDialog(requestedPlan);
      url.searchParams.delete("plan");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }).finally(() => {
    if (appLoadUserId === userId) {
      appLoadPromise = null;
      appLoadUserId = null;
    }
  });
  return appLoadPromise;
}

function resetState() {
  stopRealtime();
  state.session = null;
  state.profile = null;
  state.isAdmin = false;
  state.adminRole = null;
  state.headApproval = null;
  state.families = [];
  state.family = null;
  state.members = [];
  state.paymentItems = [];
  state.paymentRecords = [];
  state.familyInvitations = [];
  state.notifications = [];
  state.workspaces = [];
  state.workspaceMembers = [];
  state.workspaceSubscription = null;
  state.workspaceEntitlement = null;
  state.workspaceSettings = null;
  state.supportedCurrencies = [];
  state.exchangeRates = [];
  state.exchangeRateStatus = null;
  state.paymentConversions = [];
  state.billableMemberCount = 1;
  state.memberUsage = null;
  state.plans = [];
  state.planPrices = [];
  state.planLimits = [];
  state.renewalRequests = [];
  state.subscriptionInvoices = [];
  state.subscriptionPayments = [];
  state.entitlementHistory = [];
  state.heads = [];
  state.adminProfiles = [];
  state.adminFamilies = [];
  state.adminMembers = [];
  state.adminPaymentItems = [];
  state.adminPaymentRecords = [];
  state.payments = [];
  state.adminNotes = [];
  state.adminWorkspaces = [];
  state.adminWorkspaceMembers = [];
  state.adminSubscriptions = [];
  state.adminPlans = [];
  state.adminPlanPrices = [];
  state.adminPlanFeatures = [];
  state.adminPlanLimits = [];
  state.adminEnquiries = [];
  state.adminRenewalRequests = [];
  state.adminSubscriptionInvoices = [];
  state.adminSubscriptionPayments = [];
  state.adminSubscriptionProofs = [];
  state.adminSubscriptionReviews = [];
  state.adminSubscriptionMonitor = [];
  state.adminFinanceSettings = null;
  state.adminPaymentConversions = [];
  state.adminRateStatus = null;
  state.adminTab = "dashboard";
  state.familyTab = "dashboard";
  state.editingObligationId = null;
  state.reportCurrencyFilter = "all";
  state.reportViewMode = "original";
  state.reportReportingCurrency = null;
}

async function loadApp() {
  assertSupabase();
  const startedAt = performance.now();
  const loadingUserId = state.session.user.id;
  const settled = (promise) => promise.then(
    () => ({ ok: true }),
    (error) => ({ ok: false, error })
  );
  const profileResult = settled(ensureProfile());
  const familyResult = settled(loadFamily());
  const invitationResult = settled(loadInvitations());
  const notificationResult = settled(loadNotifications());

  await loadAccess();

  if (state.isAdmin) {
    await loadAdminData();
    syncRouteForWorkspace("admin");
    setView("admin");
    renderAdmin();
    startRealtime();
    profileResult.then((result) => {
      if (!result.ok) console.warn("Profile load was deferred", result.error);
    });
    console.info(`[Mushavo] Admin workspace ready in ${Math.round(performance.now() - startedAt)}ms`);
    return;
  }

  const loadedFamily = await familyResult;
  if (!loadedFamily.ok) throw loadedFamily.error;

  await loadWorkspaceSubscriptionData();

  if (state.headApproval?.status === "suspended") {
    if (state.family?.owner_id === state.session.user.id) {
      state.family = null;
      persistSelectedFamily();
      await loadWorkspaceSubscriptionData();
    }
    showToast("A shared workspace is suspended. Your Personal workspace remains available.");
  }

  await loadFamilyFinancialData();
  syncRouteForWorkspace("family");
  setView("app");
  renderFamilyApp();
  handleNotificationDeepLink();
  startRealtime();
  Promise.all([profileResult, invitationResult, notificationResult]).then((results) => {
    const labels = ["Profile", "Invitations", "Notifications"];
    results.forEach((result, index) => {
      if (!result.ok) console.warn(`${labels[index]} background load failed`, result.error);
    });
    if (!state.session || state.session.user.id !== loadingUserId) return;
    renderNotifications();
    if (state.familyTab === "members") renderInvitations();
  });
  console.info(`[Mushavo] Workspace ready in ${Math.round(performance.now() - startedAt)}ms`);
}

async function ensureProfile() {
  const user = state.session.user;
  const fullName =
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Household owner";
  const email = user.email?.toLowerCase() || null;

  const existingProfile = await query(
    "profile load",
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
  );
  if (existingProfile) {
    state.profile = existingProfile;
    if (existingProfile.full_name !== fullName || existingProfile.email !== email) {
      query(
        "profile sync",
        supabase.from("profiles").update({ full_name: fullName, email }).eq("id", user.id).select("*").single()
      ).then((profile) => {
        state.profile = profile;
      }).catch((error) => console.warn("Profile sync was deferred", error));
    }
    return;
  }

  state.profile = await query(
    "profile create",
    supabase.from("profiles").insert({ id: user.id, full_name: fullName, email }).select("*").single()
  );
}

async function loadAccess() {
  const userEmail = state.session.user.email?.toLowerCase();
  const [adminRows, headRows] = await Promise.all([
    query(
      "admin access load",
      supabase.from("app_admins").select("*").eq("user_id", state.session.user.id).limit(1)
    ),
    query(
      "head access load",
      supabase.from("family_heads").select("*").ilike("email", userEmail).limit(1)
    )
  ]);
  state.isAdmin = adminRows.length > 0;
  state.adminRole = adminRows[0]?.role || (state.isAdmin ? "super_admin" : null);
  state.headApproval = headRows[0] || null;
}

async function loadFamily() {
  const [families, memberships] = await Promise.all([
    query(
      "families load",
      supabase.from("families").select("*").order("created_at", { ascending: true })
    ),
    query(
      "family memberships load",
      supabase.from("family_members").select("family_id, user_id, email, role, status")
    )
  ]);
  const userId = state.session.user.id;
  const userEmail = state.session.user.email?.toLowerCase();
  const joinedFamilyIds = new Set(
    memberships
      .filter((member) =>
        member.status === "active" &&
        (member.user_id === userId || member.email?.toLowerCase() === userEmail)
      )
      .map((member) => member.family_id)
  );
  state.families = families.filter((family) => family.owner_id === userId || joinedFamilyIds.has(family.id));
  const storedFamilyId = window.localStorage.getItem(selectedFamilyStorageKey());
  state.family = storedFamilyId === "__personal__"
    ? null
    : state.families.find((family) => family.id === storedFamilyId) ||
      state.families.find((family) => family.id === state.family?.id) ||
      state.families[0] ||
      null;
  persistSelectedFamily();
}

function selectedFamilyStorageKey() {
  return `mushavo-budget:selected-family:${state.session?.user?.id || "guest"}`;
}

function persistSelectedFamily() {
  const key = selectedFamilyStorageKey();
  if (state.family?.id) window.localStorage.setItem(key, state.family.id);
  else window.localStorage.setItem(key, "__personal__");
}

async function selectFamily(familyId) {
  if (familyId === "__personal__") {
    if (!state.family) return;
    state.family = null;
    state.editingObligationId = null;
    persistSelectedFamily();
    await Promise.all([loadFamilyFinancialData(), loadWorkspaceSubscriptionData()]);
    renderFamilyApp();
    return;
  }
  const family = state.families.find((item) => item.id === familyId);
  if (!family || family.id === state.family?.id) return;
  state.family = family;
  state.editingObligationId = null;
  persistSelectedFamily();
  await Promise.all([loadFamilyFinancialData(), loadWorkspaceSubscriptionData()]);
  renderFamilyApp();
}

async function loadFamilyData() {
  await Promise.all([loadFamilyFinancialData(), loadInvitations(), loadNotifications()]);
}

async function loadFamilyFinancialData() {
  await Promise.all([loadMembers(), loadPaymentItems(), loadPaymentRecords()]);
}

async function loadMembers() {
  if (!state.family) {
    state.members = [];
    return;
  }
  state.members = await query(
    "members load",
    supabase
      .from("family_members")
      .select("*")
      .eq("family_id", state.family.id)
      .order("created_at", { ascending: true })
  );
}

async function loadPaymentItems() {
  let request = supabase.from("payment_items").select("*");
  request = state.family
    ? request.or(`visibility.eq.personal,family_id.eq.${state.family.id}`)
    : request.eq("visibility", "personal");
  state.paymentItems = await query("payment items load", request.order("created_at", { ascending: false }));
}

async function loadPaymentRecords() {
  let request = supabase.from("payment_records").select("*");
  request = state.family
    ? request.or(`visibility.eq.personal,family_id.eq.${state.family.id}`)
    : request.eq("visibility", "personal");
  state.paymentRecords = await query(
    "payment records load",
    request.order("payment_date", { ascending: false }).order("created_at", { ascending: false })
  );
}

async function loadInvitations() {
  state.familyInvitations = await query(
    "family invitations load",
    supabase
      .from("family_invitations")
      .select("*, families(name, owner_email)")
      .order("created_at", { ascending: false })
  );
}

async function loadNotifications() {
  state.notifications = await query(
    "notifications load",
    supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30)
  );
}

function currentBudgetWorkspace() {
  if (state.family) {
    return state.workspaces.find((workspace) => workspace.legacy_family_id === state.family.id) || null;
  }
  return state.workspaces.find((workspace) => workspace.workspace_type === "personal") || null;
}

function currentWorkspaceIsOwned() {
  return currentBudgetWorkspace()?.owner_id === state.session?.user?.id;
}

async function loadWorkspaceSubscriptionData() {
  await query("personal workspace provision", supabase.rpc("provision_my_budget_workspace"));
  const [workspaces, members, plans, prices, limits, supportedCurrencies] = await Promise.all([
    query("workspace load", supabase.from("budget_workspaces").select("*").order("created_at", { ascending: true })),
    query("workspace membership load", supabase.from("workspace_members").select("*").order("created_at", { ascending: true })),
    query("plan catalogue load", supabase.from("plans").select("*").eq("is_active", true).order("sort_order", { ascending: true })),
    query("plan prices load", supabase.from("plan_prices").select("*").eq("is_active", true).order("effective_from", { ascending: false })),
    query("plan limits load", supabase.from("plan_limits").select("*")),
    query("supported currencies load", supabase.from("supported_currencies").select("*").eq("is_active", true).order("code"))
  ]);
  state.workspaces = workspaces;
  state.workspaceMembers = members;
  state.plans = plans;
  state.planPrices = prices;
  state.planLimits = limits;
  state.supportedCurrencies = supportedCurrencies;

  const workspace = currentBudgetWorkspace();
  if (!workspace) throw new Error("Your subscription workspace could not be reconciled. Run the complete Supabase schema again.");

  const [subscriptions, entitlements, billableMemberCount, memberUsage, requests, invoices, payments, history, settings, rates, rateStatus, conversions] = await Promise.all([
    query("workspace subscription load", supabase.from("workspace_subscriptions").select("*").eq("workspace_id", workspace.id).limit(1)),
    query("workspace entitlement load", supabase.rpc("effective_workspace_entitlement", { p_workspace_id: workspace.id })),
    query("workspace seat usage load", supabase.rpc("workspace_billable_member_count", { p_workspace_id: workspace.id })),
    query("workspace member capacity load", supabase.rpc("workspace_member_usage", { p_workspace_id: workspace.id })),
    query("renewal requests load", supabase.from("subscription_renewal_requests").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false })),
    query("subscription invoices load", supabase.from("subscription_invoices").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false })),
    query("subscription payments load", supabase.from("subscription_payments").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false })),
    query("entitlement history load", supabase.from("subscription_entitlement_history").select("*, plans(display_name, code)").eq("workspace_id", workspace.id).order("created_at", { ascending: false })),
    query("workspace currency settings load", supabase.from("workspace_settings").select("*").eq("workspace_id", workspace.id).single()),
    query("exchange rates load", supabase.from("exchange_rate_snapshots").select("quote_currency, rate, provider_effective_at, fetched_at, provider").eq("base_currency", "USD").order("provider_effective_at", { ascending: false }).limit(500)),
    query("exchange rate status load", supabase.rpc("exchange_rate_status", { p_include_admin_details: false })),
    query("payment conversions load", supabase.from("payment_conversions").select("*").eq("workspace_id", workspace.id).order("rate_effective_at", { ascending: false }))
  ]);
  state.workspaceSubscription = subscriptions[0] || null;
  state.workspaceEntitlement = entitlements[0] || null;
  state.billableMemberCount = Number(billableMemberCount || 1);
  state.memberUsage = memberUsage[0] || {
    active_member_count: 1,
    pending_invitation_count: 0,
    used_member_count: 1,
    member_limit: Number(subscriptions[0]?.member_limit || 1),
    available_member_count: Math.max(0, Number(subscriptions[0]?.member_limit || 1) - 1)
  };
  state.renewalRequests = requests;
  state.subscriptionInvoices = invoices;
  state.subscriptionPayments = payments;
  state.entitlementHistory = history;
  state.workspaceSettings = settings;
  state.exchangeRates = rates;
  state.exchangeRateStatus = rateStatus;
  state.paymentConversions = conversions;
}

async function loadAdminData(tab = state.adminTab) {
  const tasks = [];
  const assign = [];

  const add = (target, label, request) => {
    tasks.push(query(label, request));
    assign.push(target);
  };

  if (["dashboard", "households", "users", "support"].includes(tab)) {
    add("adminFamilies", "admin families load", supabase.from("families").select("*").order("created_at", { ascending: false }));
  }
  if (tab === "dashboard") {
    add("adminWorkspaces", "admin workspace summary load", supabase.from("budget_workspaces").select("*").order("created_at", { ascending: false }));
  }
  if (["households", "users", "finance"].includes(tab)) {
    add("heads", "heads load", supabase.from("family_heads").select("*").order("created_at", { ascending: false }));
    add("adminSubscriptionMonitor", "subscription monitor load", supabase.rpc("admin_subscription_monitor"));
  }
  if (tab === "users") {
    add("adminProfiles", "registered users load", supabase.from("profiles").select("*").order("created_at", { ascending: false }));
    add("adminMembers", "user family members load", supabase.from("family_members").select("*").order("created_at", { ascending: true }));
    add("adminWorkspaces", "user workspaces load", supabase.from("budget_workspaces").select("*").order("created_at", { ascending: false }));
    add("adminWorkspaceMembers", "user workspace membership load", supabase.from("workspace_members").select("*").order("created_at", { ascending: false }));
    add("adminSubscriptions", "user subscriptions load", supabase.from("workspace_subscriptions").select("*").order("updated_at", { ascending: false }));
    add("adminPlans", "user plans load", supabase.from("plans").select("*").order("sort_order", { ascending: true }));
  }
  if (tab === "households") {
    add("adminProfiles", "workspace owner profiles load", supabase.from("profiles").select("*").order("created_at", { ascending: false }));
    add("adminMembers", "admin members load", supabase.from("family_members").select("*").order("created_at", { ascending: true }));
    add("adminWorkspaces", "workspace directory load", supabase.from("budget_workspaces").select("*").order("created_at", { ascending: false }));
    add("adminWorkspaceMembers", "workspace member directory load", supabase.from("workspace_members").select("*").order("created_at", { ascending: true }));
    add("adminSubscriptions", "workspace subscription directory load", supabase.from("workspace_subscriptions").select("*").order("updated_at", { ascending: false }));
    add("adminPlans", "workspace plan directory load", supabase.from("plans").select("*").order("sort_order", { ascending: true }));
  }
  if (["dashboard", "households"].includes(tab)) {
    add("adminPaymentItems", "admin payment items load", supabase.from("payment_items").select("*").order("created_at", { ascending: false }));
    add("adminPaymentRecords", "admin payment records load", supabase.from("payment_records").select("*").order("payment_date", { ascending: false }));
  }
  if (["dashboard", "finance"].includes(tab)) {
    add(
      "payments",
      "payments load",
      supabase
        .from("payments")
        .select("*, family_heads(full_name, email, billing_status, status)")
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false })
    );
  }
  if (tab === "support") {
    add("adminNotes", "admin notes load", supabase.from("admin_support_notes").select("*").order("created_at", { ascending: false }));
  }
  if (["dashboard", "enquiries"].includes(tab)) {
    add("adminEnquiries", "public enquiries load", supabase.from("enquiries").select("*").order("created_at", { ascending: false }));
  }
  if (["plans", "finance"].includes(tab)) {
    add("adminPlans", "admin plans load", supabase.from("plans").select("*").order("sort_order", { ascending: true }));
    add("adminPlanPrices", "admin plan prices load", supabase.from("plan_prices").select("*").order("effective_from", { ascending: false }));
  }
  if (tab === "plans") {
    add("adminPlanFeatures", "admin plan features load", supabase.from("plan_features").select("*").order("feature_code"));
    add("adminPlanLimits", "admin plan limits load", supabase.from("plan_limits").select("*").order("limit_code"));
  }
  if (["dashboard", "households", "users", "finance"].includes(tab)) {
    add("adminSubscriptionPayments", "admin subscription payments load", supabase.from("subscription_payments").select("*").order("created_at", { ascending: false }));
  }
  if (["households", "users", "finance"].includes(tab)) {
    if (tab === "finance") {
      add("adminProfiles", "finance user profiles load", supabase.from("profiles").select("*").order("created_at", { ascending: false }));
      add("adminWorkspaces", "admin workspaces load", supabase.from("budget_workspaces").select("*").order("created_at", { ascending: false }));
      add("adminSubscriptions", "admin subscriptions load", supabase.from("workspace_subscriptions").select("*").order("updated_at", { ascending: false }));
      add("supportedCurrencies", "finance supported currencies load", supabase.from("supported_currencies").select("*").eq("is_active", true).order("code"));
      add("exchangeRates", "finance exchange rates load", supabase.from("exchange_rate_snapshots").select("quote_currency, rate, provider_effective_at, fetched_at, provider").eq("base_currency", "USD").order("provider_effective_at", { ascending: false }).limit(500));
      add("adminFinanceSettings", "admin finance currency settings load", supabase.from("admin_finance_settings").select("*").eq("id", 1).single());
      add("adminPaymentConversions", "admin payment conversions load", supabase.from("payment_conversions").select("*").is("workspace_id", null).order("rate_effective_at", { ascending: false }));
      add("adminRateStatus", "admin exchange rate status load", supabase.rpc("exchange_rate_status", { p_include_admin_details: true }));
    }
    add("adminRenewalRequests", "admin renewal requests load", supabase.from("subscription_renewal_requests").select("*").order("created_at", { ascending: false }));
    add("adminSubscriptionInvoices", "admin subscription invoices load", supabase.from("subscription_invoices").select("*").order("created_at", { ascending: false }));
    add("adminSubscriptionProofs", "admin subscription proofs load", supabase.from("subscription_payment_proofs").select("*").order("created_at", { ascending: false }));
    add("adminSubscriptionReviews", "admin subscription reviews load", supabase.from("subscription_payment_reviews").select("*").order("created_at", { ascending: false }));
  }

  const results = await Promise.all(tasks);
  assign.forEach((target, index) => {
    state[target] = results[index];
  });
}

function renderFamilyApp() {
  renderFamilyTabs();
  renderFamilyHeader();
  renderMemberOptions();
  renderPaymentScope();
  renderNotifications();
  const workspaceReadOnly = Boolean(state.workspaceEntitlement?.read_only || state.workspaceEntitlement?.effective_status === "suspended");
  document.querySelectorAll("[data-open-payment-item-dialog]").forEach((button) => {
    button.disabled = workspaceReadOnly;
    button.title = workspaceReadOnly ? "Renew this workspace to change payments" : "";
  });

  if (state.familyTab === "dashboard") renderDashboard();
  if (state.familyTab === "payments") renderObligations();
  if (state.familyTab === "members") {
    renderMemberAccess();
    renderMembers();
    renderInvitations();
  }
  if (state.familyTab === "settings") renderSettings();
  if (state.familyTab === "reports") renderReports();
  if (state.familyTab === "subscription") renderSubscription();
}

function renderFamilyTabs() {
  document.querySelectorAll("[data-family-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.familyTab === state.familyTab);
  });
  document.querySelectorAll("[data-family-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.familyPanel !== state.familyTab);
  });
}

function renderFamilyHeader() {
  const title = state.family?.name || "Personal budget";
  $("#householdTitle").textContent = title;
  $("#mobileHouseholdTitle").textContent = title;
  const billing = state.workspaceEntitlement
    ? `${state.workspaceEntitlement.plan_name} - ${titleCase(state.workspaceEntitlement.effective_status)}`
    : hasActiveMembership() ? "Household - Active" : "Free - Active";
  $("#headBillingBadge").textContent = billing;
  $("#headBillingBadge").className = `mini-badge ${badgeClass(billing)}`;
  renderFamilySelectors();
  $("#dashboardMonthTitle").textContent = parseDate(monthStart(state.filterMonth)).toLocaleString("en", {
    month: "long",
    year: "numeric"
  });
}

function canAddMembers() {
  return canManageMembersForFamily(state.family?.id);
}

function canCreateFamily() {
  return hasActiveMembership() && ownedFamilies().length < familyLimit();
}

function hasActiveMembership() {
  return state.headApproval?.status === "active";
}

function familyLimit() {
  return Math.max(0, Number(state.headApproval?.family_limit ?? 1));
}

function ownedFamilies() {
  return state.families.filter((family) => family.owner_id === state.session?.user?.id);
}

function canManageMembersForFamily(familyId) {
  const family = state.families.find((item) => item.id === familyId);
  const activeHouseholdEntitlement = family?.id === state.family?.id
    && state.workspaceEntitlement?.plan_code === "household"
    && state.workspaceEntitlement?.effective_status === "active"
    && !state.workspaceEntitlement?.read_only;
  return Boolean(
    family &&
    family.owner_id === state.session?.user?.id &&
    activeHouseholdEntitlement
  );
}

function renderFamilySelectors() {
  document.querySelectorAll("[data-family-selector]").forEach((select) => {
    select.innerHTML = "";
    select.append(new Option("Personal budget", "__personal__"));
    state.families.forEach((family) => select.append(new Option(family.name, family.id)));
    select.value = state.family?.id || "__personal__";
    select.disabled = state.families.length === 0;
  });
}

function renderMemberAccess() {
  const allowedToCreate = canCreateFamily();
  const owned = ownedFamilies();
  const manageableFamilies = owned.filter((family) => canManageMembersForFamily(family.id));
  const selectedMemberUsage = state.memberUsage || {};
  const selectedMemberLimit = Math.max(1, Number(selectedMemberUsage.member_limit || state.workspaceSubscription?.member_limit || 1));
  const selectedActiveMembers = Number(selectedMemberUsage.active_member_count ?? state.members.filter((member) => member.status === "active").length);
  const selectedPendingInvites = Number(selectedMemberUsage.pending_invitation_count ?? state.familyInvitations.filter((invite) => invite.family_id === state.family?.id && invite.status === "pending").length);
  const selectedAvailablePlaces = Math.max(0, Number(selectedMemberUsage.available_member_count ?? selectedMemberLimit - selectedActiveMembers - selectedPendingInvites));
  const familyCount = owned.length;
  const limit = familyLimit();
  const creationNotice = $("#familyCreationNotice");
  creationNotice.classList.toggle("hidden", allowedToCreate);
  if (!allowedToCreate) {
    if (!hasActiveMembership()) {
      $("#familyCreationNoticeTitle").textContent = "Active subscription required.";
      $("#familyCreationNoticeText").textContent = "The Mushavo Budget admin must activate your membership before you can create a family. You can still join a family by invitation.";
    } else {
      $("#familyCreationNoticeTitle").textContent = "Family limit reached.";
      $("#familyCreationNoticeText").textContent = `You currently own ${familyCount} of ${limit} allowed families. Ask the admin to increase your family limit.`;
    }
  }
  const createTitle = $("#createFamilyTitle");
  const createPanelCopy = createTitle?.parentElement?.querySelector(".muted-copy");
  const createButton = $("#memberFamilyForm").querySelector('button[type="submit"]');
  createTitle.textContent = "Create another family";
  if (createPanelCopy) createPanelCopy.textContent = "Your admin controls how many families your account may own.";
  createButton.textContent = "Create family";
  $("#memberFamilyForm").querySelectorAll("input, select, button").forEach((field) => {
    field.disabled = !allowedToCreate;
  });
  $("#memberFamilyForm").closest(".tool-panel").classList.toggle("hidden", !allowedToCreate);
  $("#familyManagementGrid").classList.toggle("hidden", !allowedToCreate);

  const inviteFamily = $("#inviteFamily");
  const previousInviteFamily = inviteFamily.value;
  inviteFamily.innerHTML = "";
  manageableFamilies.forEach((family) => inviteFamily.append(new Option(family.name, family.id)));
  inviteFamily.value = manageableFamilies.some((family) => family.id === previousInviteFamily)
    ? previousInviteFamily
    : manageableFamilies.find((family) => family.id === state.family?.id)?.id || manageableFamilies[0]?.id || "";
  const selectedFamilyIsManageable = manageableFamilies.some((family) => family.id === state.family?.id);
  const selectedFamilyHasCapacity = !selectedFamilyIsManageable || selectedAvailablePlaces > 0;
  const allowedToInvite = manageableFamilies.length > 0 && selectedFamilyHasCapacity;
  $("#inviteMemberButton").disabled = !allowedToInvite;
  $("#inviteForm").querySelectorAll("input, select, button").forEach((field) => {
    field.disabled = !allowedToInvite;
  });
  const memberNotice = $("#memberAccessNotice");
  memberNotice.classList.toggle("hidden", allowedToInvite);
  if (!allowedToInvite) {
    memberNotice.innerHTML = selectedFamilyIsManageable && selectedAvailablePlaces === 0
      ? `<strong>All ${selectedMemberLimit} paid places are in use.</strong> Active members and pending invitations reserve places. Purchase another place from Subscription before inviting someone else.`
      : owned.length
        ? "<strong>Member management is locked.</strong> The subscription must be active before you can invite or remove family members."
        : "<strong>Only a family owner can manage members.</strong> You can participate in families you joined, but only their owner can invite or remove members.";
  }

  const selectedFamilyPanel = $("#selectedFamilyPanel");
  const ownsSelectedFamily = state.family?.owner_id === state.session?.user?.id;
  selectedFamilyPanel.classList.toggle("hidden", !ownsSelectedFamily);
  if (ownsSelectedFamily) {
    $("#selectedFamilyTitle").textContent = state.family.name;
    $("#selectedFamilyMeta").textContent = `${money(state.family.monthly_budget, state.family.currency)} expected each month · ${selectedActiveMembers + selectedPendingInvites} of ${selectedMemberLimit} paid places reserved · ${familyCount} of ${limit} family workspaces used`;
    $("#selectedFamilyMemberCount").textContent = selectedActiveMembers;
    $("#selectedFamilyMemberLimit").textContent = selectedMemberLimit;
    $("#selectedFamilyAvailableCount").textContent = selectedAvailablePlaces;
    $("#selectedFamilyPaymentCount").textContent = state.paymentItems.filter((item) => item.family_id === state.family.id && item.status !== "inactive").length;
    $("#selectedFamilyInviteCount").textContent = selectedPendingInvites;
  }
}

function renderMemberOptions() {
  const obligationMember = $("#obligationMember");
  const recordPaidBy = $("#recordPaidBy");
  obligationMember.innerHTML = `<option value="">No family member</option>`;
  recordPaidBy.innerHTML = `<option value="">Personal account</option>`;

  activeMembers().forEach((member) => {
    const option = document.createElement("option");
    option.value = member.id;
    option.textContent = `${member.name} (${member.role})`;
    obligationMember.append(option);

    const payer = document.createElement("option");
    payer.value = member.id;
    payer.textContent = `${member.name} (${member.role})`;
    recordPaidBy.append(payer);
  });
}

function renderPaymentScope() {
  const scope = $("#paymentScope");
  if (!scope) return;
  const familyOption = scope.querySelector('option[value="family"]');
  familyOption.disabled = !state.family;
  if (!state.family && scope.value === "family") scope.value = "personal";
}

function activeMembers() {
  return state.members.filter((member) => member.status !== "inactive");
}

function selectedOccurrences(items = state.paymentItems, records = state.paymentRecords) {
  return generateOccurrences(items, records, state.filterMonth).filter((occurrence) => {
    return state.filterStatus === "all" || occurrence.status === state.filterStatus;
  });
}

function generateOccurrences(items, records, monthValue) {
  const targetDate = parseDate(monthStart(monthValue));
  return items
    .filter((item) => item.status !== "inactive" && isItemDueInMonth(item, targetDate))
    .map((item) => occurrenceForItem(item, records, targetDate))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function isItemDueInMonth(item, targetDate) {
  const start = parseDate(item.start_date);
  const diff = monthDiff(start, targetDate);
  if (diff < 0) return false;
  if (item.recurrence_type === "once") return diff === 0;
  if (item.recurrence_type === "yearly") return diff % 12 === 0;
  if (item.recurrence_type === "quarterly") return diff % 3 === 0;
  const interval = item.recurrence_type === "custom" ? Number(item.recurrence_interval || 1) : 1;
  return diff % Math.max(interval, 1) === 0;
}

function occurrenceForItem(item, records, targetDate) {
  const year = targetDate.getFullYear();
  const monthIndex = targetDate.getMonth();
  const day = Math.min(Number(item.due_day || 1), lastDayOfMonth(year, monthIndex));
  const dueDate = toDateValue(new Date(year, monthIndex, day));
  const periodStart = toDateValue(new Date(year, monthIndex, 1));
  const paid = records
    .filter((record) => record.payment_item_id === item.id && record.period_start === periodStart)
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const amount = Number(item.amount || 0);
  const outstanding = Math.max(amount - paid, 0);
  const status = occurrenceStatus(item, dueDate, paid, amount);
  return {
    key: `${item.id}:${periodStart}`,
    item,
    dueDate,
    periodStart,
    amount,
    paid,
    outstanding,
    status
  };
}

function occurrenceStatus(item, dueDate, paid, amount) {
  if (paid >= amount) return "paid";
  if (paid > 0) return "partial";
  const todayDate = parseDate(toDateValue(new Date()));
  const due = parseDate(dueDate);
  const days = Math.ceil((due - todayDate) / 86400000);
  if (days < 0) return "overdue";
  if (days <= Number(item.reminder_days_before ?? 3)) return "due-soon";
  return "upcoming";
}

function renderDashboard() {
  const occurrences = selectedOccurrences();
  const dueRows = occurrences.map((item) => ({ amount: item.amount, currency: item.item.currency }));
  const paidRows = occurrences.map((item) => ({ amount: item.paid, currency: item.item.currency }));
  const outstandingRows = occurrences.map((item) => ({ amount: item.outstanding, currency: item.item.currency }));
  const overdue = occurrences.filter((item) => item.status === "overdue");
  const myDue = myOccurrences(occurrences).filter((item) => item.status !== "paid");
  const dueSummary = dashboardAmountSummary(dueRows);
  const paidSummary = dashboardAmountSummary(paidRows);
  const outstandingSummary = dashboardAmountSummary(outstandingRows);
  const currencyCount = new Set(dueRows.map((row) => row.currency)).size;
  const percentage = dueSummary.scaled != null && dueSummary.scaled > 0n && paidSummary.scaled != null
    ? Math.min(Number((paidSummary.scaled * 10000n) / dueSummary.scaled) / 100, 100)
    : currencyCount <= 1
      ? (() => {
        const due = occurrences.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const paid = occurrences.reduce((sum, item) => sum + Number(item.paid || 0), 0);
        return due > 0 ? Math.min((paid / due) * 100, 100) : 0;
      })()
      : occurrences.length ? (occurrences.filter((item) => item.status === "paid").length / occurrences.length) * 100 : 0;

  $("#dueAmount").textContent = dueSummary.text;
  $("#outstandingAmount").textContent = outstandingSummary.text;
  $("#outstandingText").textContent = occurrences.some((item) => item.outstanding > 0)
    ? outstandingSummary.converted
      ? `Converted to ${outstandingSummary.currency}`
      : outstandingSummary.scaled == null
        ? "Original currencies"
        : "Still outstanding"
    : "All clear";
  $("#overdueCount").textContent = overdue.length;
  $("#overdueText").textContent = overdue.length ? "Needs follow-up" : "No overdue dues";
  $("#myDueCount").textContent = myDue.length;
  $("#paidMeter").style.width = `${percentage}%`;
  $("#paidProgressText").textContent = occurrences.length ? `${Math.round(percentage)}% paid this month` : "No dues yet";

  renderPriorityDueList(occurrences);
  renderMemberResponsibility(occurrences);
  scheduleDashboardTextFit();
}

function scheduleDashboardTextFit() {
  if (dashboardFitFrame) cancelAnimationFrame(dashboardFitFrame);
  dashboardFitFrame = requestAnimationFrame(() => {
    dashboardFitFrame = null;
    const isMobile = window.matchMedia("(max-width: 680px)").matches;
    document.querySelectorAll("[data-fit-text]").forEach((element) => {
      element.style.removeProperty("font-size");
      if (!isMobile || element.clientWidth <= 0) return;
      const minimum = Number(element.dataset.fitMin || 11);
      let size = Number.parseFloat(window.getComputedStyle(element).fontSize);
      while (element.scrollWidth > element.clientWidth && size > minimum) {
        size = Math.max(minimum, size - 0.5);
        element.style.fontSize = `${size}px`;
      }
    });
  });
}

function renderPriorityDueList(occurrences) {
  const list = $("#priorityDueList");
  const statusPriority = { overdue: 0, partial: 1, "due-soon": 2, upcoming: 3, paid: 4 };
  const monthGroups = [];

  for (let monthOffset = 0; monthOffset <= 6; monthOffset += 1) {
    const monthValue = offsetMonthValue(state.filterMonth, monthOffset);
    const monthOccurrences = (monthOffset === 0
      ? occurrences
      : generateOccurrences(state.paymentItems, state.paymentRecords, monthValue))
      .filter((item) => state.filterStatus === "all" || item.status === state.filterStatus)
      .sort((a, b) => statusPriority[a.status] - statusPriority[b.status] || a.dueDate.localeCompare(b.dueDate));

    monthGroups.push({ monthOffset, monthValue, occurrences: monthOccurrences });
  }

  list.innerHTML = "";
  monthGroups.forEach((group, groupIndex) => {
    const section = document.createElement("section");
    const isCurrentMonth = group.monthOffset === 0;
    section.className = `due-month-group month-accent-${groupIndex % 4}${isCurrentMonth ? " expanded" : " collapsed"}`;
    section.dataset.month = group.monthValue;
    const monthTitle = parseDate(monthStart(group.monthValue)).toLocaleString("en", {
      month: "long",
      year: "numeric"
    });
    const totalOutstanding = dashboardAmountSummary(group.occurrences.map((occurrence) => ({
      currency: occurrence.item.currency,
      amount: occurrence.outstanding
    }))).text;
    const summary = group.occurrences.length
      ? `${group.occurrences.length} payment${group.occurrences.length === 1 ? "" : "s"} · ${totalOutstanding} outstanding`
      : "No payments scheduled";
    section.innerHTML = `
      <button class="due-month-header" type="button" ${isCurrentMonth ? "disabled" : "data-toggle-due-month"} aria-expanded="${isCurrentMonth ? "true" : "false"}" aria-controls="due-month-${group.monthValue}">
        <div>
          <span>${group.monthOffset === 0 ? "Selected month" : "Upcoming month"}</span>
          <h4>${escapeHtml(monthTitle)}</h4>
        </div>
        <span class="due-month-summary"><small title="${escapeHtml(summary)}">${escapeHtml(summary)}</small>${isCurrentMonth ? "" : '<span class="accordion-chevron" aria-hidden="true">⌄</span>'}</span>
      </button>
      <div id="due-month-${group.monthValue}" class="due-month-items" ${isCurrentMonth ? "" : "hidden"}></div>
    `;
    const items = section.querySelector(".due-month-items");
    if (group.occurrences.length) {
      group.occurrences.forEach((occurrence) => items.append(renderOccurrenceCard(occurrence, true, true)));
    } else {
      items.innerHTML = emptyState("No payments this month", "There are no scheduled payments for this month and filter.");
    }
    list.append(section);
  });
}

function renderMemberResponsibility(occurrences) {
  const list = $("#memberResponsibilityList");
  const rows = activeMembers().map((member) => {
    const assigned = occurrences.filter((occurrence) => occurrence.item.responsible_member_id === member.id);
    return {
      member,
      key: member.id,
      name: member.name,
      role: member.role,
      assigned,
      overdueCount: assigned.filter((item) => item.status === "overdue").length,
      partialCount: assigned.filter((item) => item.status === "partial").length,
      dueSoonCount: assigned.filter((item) => item.status === "due-soon").length
    };
  }).filter((row) => row.assigned.length > 0);

  const householdAssigned = occurrences.filter((occurrence) =>
    occurrence.item.visibility === "family" && !occurrence.item.responsible_member_id
  );
  if (householdAssigned.length) {
    rows.push({
      member: null,
      key: "household",
      name: "Household account",
      role: "Unassigned family payments",
      assigned: householdAssigned,
      overdueCount: householdAssigned.filter((item) => item.status === "overdue").length,
      partialCount: householdAssigned.filter((item) => item.status === "partial").length,
      dueSoonCount: householdAssigned.filter((item) => item.status === "due-soon").length
    });
  }

  if (!rows.length) {
    list.innerHTML = emptyState("No assigned dues", "Assign members to recurring obligations to see responsibility totals.");
    return;
  }

  const statusRank = { overdue: 0, partial: 1, "due soon": 2, "on track": 3, paid: 4 };
  rows.forEach((row) => {
    row.totalSummary = dashboardAmountSummary(row.assigned.map((item) => ({
      amount: item.amount,
      currency: item.item.currency
    })));
    row.paidSummary = dashboardAmountSummary(row.assigned.map((item) => ({
      amount: Math.min(item.paid, item.amount),
      currency: item.item.currency
    })));
    row.outstandingSummary = dashboardAmountSummary(row.assigned.map((item) => ({
      amount: item.outstanding,
      currency: item.item.currency
    })));
    row.hasOutstanding = row.assigned.some((item) => item.outstanding > 0);
    row.progress = row.totalSummary.scaled != null && row.totalSummary.scaled > 0n && row.paidSummary.scaled != null
      ? Math.min(Number((row.paidSummary.scaled * 10000n) / row.totalSummary.scaled) / 100, 100)
      : row.assigned.length
        ? row.assigned.reduce((sum, item) => sum + (item.amount > 0 ? Math.min(item.paid / item.amount, 1) : 1), 0) / row.assigned.length * 100
        : 0;
    row.status = row.overdueCount
      ? "overdue"
      : row.partialCount
        ? "partial"
        : row.dueSoonCount
          ? "due soon"
          : row.hasOutstanding
            ? "on track"
            : "paid";
  });
  rows.sort((a, b) =>
    statusRank[a.status] - statusRank[b.status]
    || compareScaledDescending(a.outstandingSummary.scaled, b.outstandingSummary.scaled)
    || a.name.localeCompare(b.name)
  );

  list.innerHTML = "";
  rows.forEach((row) => {
    const nextDue = row.assigned
      .filter((occurrence) => occurrence.status !== "paid")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const item = document.createElement("article");
    item.className = "workload-card";
    const detailsId = `workload-details-${row.key}`;
    item.innerHTML = `
      <div class="workload-header">
        <div class="avatar" style="background:${escapeHtml(row.member?.avatar_color || "#0F766E")}">${memberInitials(row.name)}</div>
        <div class="workload-identity">
          <strong title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</strong>
          <span title="${escapeHtml(row.role || "Family member")}">${escapeHtml(row.role || "Family member")}</span>
        </div>
        <div class="workload-status">${statusBadge(row.status)}</div>
      </div>
      <div class="workload-metrics">
        <div><span>Assigned</span><strong>${row.assigned.length}</strong></div>
        <div><span>Total due</span><strong data-fit-text data-fit-min="10">${row.totalSummary.text}</strong></div>
        <div><span>Paid</span><strong data-fit-text data-fit-min="10">${row.paidSummary.text}</strong></div>
        <div><span>Outstanding</span><strong data-fit-text data-fit-min="10">${row.outstandingSummary.text}</strong></div>
      </div>
      <div class="workload-progress">
        <div class="meter small-meter"><span style="width:${row.progress}%"></span></div>
        <span>${Math.round(row.progress)}% paid${row.overdueCount ? ` &middot; ${row.overdueCount} overdue` : ""}</span>
      </div>
      <div class="workload-next" title="${escapeHtml(nextDue ? `${nextDue.item.name}, due ${nextDue.dueDate}` : "All assigned payments are paid")}">
        <strong>Next</strong>
        <span>${nextDue ? `${escapeHtml(nextDue.item.name)} &middot; ${nextDue.dueDate}` : "All assigned payments are paid"}</span>
      </div>
      <div class="workload-actions">
        <button type="button" data-toggle-workload="${row.key}" aria-expanded="false" aria-controls="${detailsId}">View payments</button>
      </div>
      <div id="${detailsId}" class="workload-details hidden">
        ${row.assigned
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
          .map((occurrence) => `
            <div class="workload-detail-row">
              <div>
                <strong title="${escapeHtml(occurrence.item.name)}">${escapeHtml(occurrence.item.name)}</strong>
                <span>${occurrence.dueDate} &middot; ${escapeHtml(occurrence.status)}</span>
              </div>
              <strong data-fit-text data-fit-min="10">${money(occurrence.outstanding, occurrence.item.currency)}</strong>
              ${occurrence.status !== "paid" ? `<button type="button" data-record-payment="${occurrence.key}">Record</button>` : ""}
            </div>
          `).join("")}
      </div>
    `;
    list.append(item);
  });
}

function renderObligations() {
  const list = $("#obligationsList");
  if (!state.paymentItems.length) {
    list.innerHTML = emptyState("No recurring obligations", "Add rent, utilities, school fees, subscriptions, or family contributions.");
    return;
  }
  list.innerHTML = "";
  state.paymentItems.forEach((item) => list.append(renderObligationCard(item)));
}

function renderObligationCard(item) {
  const member = memberById(item.responsible_member_id);
  const article = document.createElement("article");
  article.className = "record-card";
  article.dataset.paymentItemId = item.id;
  article.innerHTML = `
    <div class="record-main">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(item.category)} &middot; ${recurrenceLabel(item)} &middot; Due day ${item.due_day}</span>
      <div class="badge-row">
        ${statusBadge(item.status || "active")}
        <span class="mini-badge">${escapeHtml(item.visibility === "family" ? "Family" : "Personal")}</span>
        <span class="mini-badge">${escapeHtml(member?.name || "No assigned member")}</span>
        <span class="mini-badge">Daily reminders from ${item.reminder_days_before ?? 0} day${Number(item.reminder_days_before ?? 0) === 1 ? "" : "s"} before until due</span>
      </div>
    </div>
    <div class="record-side">
      <strong>${money(item.amount, item.currency)}</strong>
      <div class="row-actions">
        <button type="button" data-edit-obligation="${item.id}">Edit</button>
        <button type="button" data-toggle-obligation="${item.id}" data-next-status="${item.status === "inactive" ? "active" : "inactive"}">
          ${item.status === "inactive" ? "Reactivate" : "Pause"}
        </button>
        <button type="button" data-delete-obligation="${item.id}">Delete</button>
      </div>
    </div>
  `;
  return article;
}

function handleNotificationDeepLink() {
  const url = new URL(window.location.href);
  const paymentItemId = url.searchParams.get("payment_item");
  if (!paymentItemId) return;
  const target = document.querySelector(`[data-payment-item-id="${CSS.escape(paymentItemId)}"]`);
  if (!target) return;
  requestAnimationFrame(() => {
    target.classList.add("notification-deep-link-target");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => target.classList.remove("notification-deep-link-target"), 6000);
  });
}

function renderSchedule() {
  const list = $("#scheduleList");
  const occurrences = selectedOccurrences();
  if (!occurrences.length) {
    list.innerHTML = emptyState("No dues for this view", "Change the month or status filter, or add a recurring obligation.");
    return;
  }
  list.innerHTML = "";
  occurrences.forEach((occurrence) => list.append(renderOccurrenceCard(occurrence, true)));
}

function renderMyPayments() {
  const list = $("#myPaymentsList");
  const occurrences = myOccurrences(selectedOccurrences());
  if (!occurrences.length) {
    list.innerHTML = emptyState("No payments assigned to you", "Your assigned obligations appear here when your member email matches your login email.");
    return;
  }
  list.innerHTML = "";
  occurrences.forEach((occurrence) => list.append(renderOccurrenceCard(occurrence, true)));
}

function myOccurrences(occurrences) {
  const email = state.session.user.email?.toLowerCase();
  const matchingMember = state.members.find((member) => member.email?.toLowerCase() === email);
  return occurrences.filter((occurrence) =>
    occurrence.item.visibility === "personal" ||
    (matchingMember && occurrence.item.responsible_member_id === matchingMember.id)
  );
}

function renderOccurrenceCard(occurrence, withAction = false, collapsible = false) {
  const member = memberById(occurrence.item.responsible_member_id);
  const article = document.createElement("article");
  if (collapsible) {
    const detailsId = `occurrence-details-${occurrence.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    article.className = "record-card occurrence-card";
    article.innerHTML = `
      <button class="occurrence-summary-button" type="button" data-toggle-occurrence-details aria-expanded="false" aria-controls="${detailsId}">
        <span class="date-chip">
          <strong>${parseDate(occurrence.dueDate).getDate()}</strong>
          <span>${parseDate(occurrence.dueDate).toLocaleString("en", { month: "short" })}</span>
        </span>
        <span class="occurrence-summary-copy">
          <strong class="occurrence-name" title="${escapeHtml(occurrence.item.name)}">${escapeHtml(occurrence.item.name)}</strong>
          <span class="occurrence-summary-meta">Due ${escapeHtml(occurrence.dueDate)} · ${escapeHtml(occurrence.status)}</span>
        </span>
        <strong class="occurrence-amount" data-fit-text data-fit-min="10">${money(occurrence.amount, occurrence.item.currency)}</strong>
        <span class="accordion-chevron" aria-hidden="true">⌄</span>
      </button>
      <div id="${detailsId}" class="occurrence-card-details" hidden>
        <dl class="occurrence-facts">
          <div><dt>Responsible</dt><dd>${escapeHtml(member?.name || "Household account")}</dd></div>
          <div><dt>Category</dt><dd>${escapeHtml(occurrence.item.category)}</dd></div>
          <div><dt>Paid</dt><dd>${money(occurrence.paid, occurrence.item.currency)}</dd></div>
          <div><dt>Outstanding</dt><dd>${money(occurrence.outstanding, occurrence.item.currency)}</dd></div>
        </dl>
        <div class="occurrence-detail-footer">
          <div class="badge-row">${statusBadge(occurrence.status)}<span class="mini-badge">Daily reminder from ${occurrence.item.reminder_days_before ?? 3} day${Number(occurrence.item.reminder_days_before ?? 3) === 1 ? "" : "s"} before</span></div>
          ${withAction ? `<div class="row-actions"><button type="button" data-edit-obligation="${occurrence.item.id}">Edit</button>${occurrence.status !== "paid" ? `<button class="primary" type="button" data-record-payment="${occurrence.key}">Record payment</button>` : '<span class="paid-label">Paid in full</span>'}</div>` : ""}
        </div>
      </div>
    `;
    return article;
  }
  article.className = "record-card";
  article.innerHTML = `
    <div class="date-chip">
      <strong>${parseDate(occurrence.dueDate).getDate()}</strong>
      <span>${parseDate(occurrence.dueDate).toLocaleString("en", { month: "short" })}</span>
    </div>
    <div class="record-main">
      <strong class="occurrence-name" title="${escapeHtml(occurrence.item.name)}">${escapeHtml(occurrence.item.name)}</strong>
      <span class="occurrence-meta" title="${escapeHtml(member?.name || "Household account")} · ${escapeHtml(occurrence.item.category)} · ${money(occurrence.outstanding, occurrence.item.currency)} outstanding">${escapeHtml(member?.name || "Household account")} &middot; ${escapeHtml(occurrence.item.category)} &middot; ${money(occurrence.outstanding, occurrence.item.currency)} outstanding</span>
      <div class="badge-row">
        ${statusBadge(occurrence.status)}
        <span class="mini-badge">${money(occurrence.paid, occurrence.item.currency)} paid</span>
      </div>
    </div>
    <div class="record-side">
      <strong class="occurrence-amount" data-fit-text data-fit-min="10">${money(occurrence.amount, occurrence.item.currency)}</strong>
      ${withAction ? `<div class="row-actions"><button type="button" data-edit-obligation="${occurrence.item.id}">Edit</button>${occurrence.status !== "paid" ? `<button class="primary" type="button" data-record-payment="${occurrence.key}">Record payment</button>` : '<span class="paid-label">Paid in full</span>'}</div>` : ""}
    </div>
  `;
  return article;
}

function renderMembers() {
  const list = $("#membersList");
  if (!state.members.length) {
    list.innerHTML = emptyState("No family members yet", "Invite registered users and they will appear here after accepting.");
    return;
  }
  list.innerHTML = "";
  state.members.forEach((member) => {
    const assignedCount = state.paymentItems.filter((item) => item.responsible_member_id === member.id).length;
    const isOwner = member.role === "Owner" || member.user_id === state.family?.owner_id;
    const isSignedInUser =
      member.user_id === state.session.user.id ||
      member.email?.toLowerCase() === state.session.user.email?.toLowerCase();
    const canRemove = canAddMembers() && member.status === "active" && !isOwner && !isSignedInUser;
    const item = document.createElement("article");
    item.className = "record-card";
    item.innerHTML = `
      <div class="avatar" style="background:${escapeHtml(member.avatar_color || "#2563EB")}">${memberInitials(member.name)}</div>
      <div class="record-main">
        <strong>${escapeHtml(member.name)}</strong>
        <span>${escapeHtml(member.role)} &middot; ${escapeHtml(member.email || "No email")} &middot; ${escapeHtml(member.phone || "No phone")}</span>
        <div class="badge-row">${statusBadge(member.status === "inactive" ? "removed" : "active")}<span class="mini-badge">${assignedCount} assigned</span></div>
      </div>
      <div class="record-side">
        ${canRemove ? `<button type="button" data-remove-member="${member.id}">Remove from family</button>` : ""}
      </div>
    `;
    list.append(item);
  });
}

function renderInvitations() {
  const list = $("#invitationsList");
  if (!list) return;
  if (!state.familyInvitations.length) {
    list.innerHTML = emptyState("No family invitations", "Invites you send or receive will appear here.");
    return;
  }
  list.innerHTML = "";
  state.familyInvitations.forEach((invite) => {
    const incoming = invite.invitee_email?.toLowerCase() === state.session.user.email?.toLowerCase();
    const article = document.createElement("article");
    article.className = "record-card";
    article.innerHTML = `
      <div class="record-main">
        <strong>${escapeHtml(invite.families?.name || state.family?.name || "Family")}</strong>
        <span>${incoming ? "You were invited" : `Invited ${escapeHtml(invite.invitee_email)}`} &middot; ${escapeHtml(invite.role)} &middot; ${new Date(invite.created_at).toLocaleDateString()}</span>
        <div class="badge-row">${statusBadge(invite.status)}</div>
      </div>
      <div class="record-side">
        ${incoming && invite.status === "pending" ? `<div class="row-actions"><button class="primary" type="button" data-accept-invite="${invite.id}">Accept</button><button type="button" data-reject-invite="${invite.id}">Reject</button></div>` : ""}
      </div>
    `;
    list.append(article);
  });
}

function renderSettings() {
  const entitlement = state.workspaceEntitlement;
  const plan = entitlement
    ? `${entitlement.plan_name} - ${titleCase(entitlement.effective_status)}`
    : hasJoinableFamilyInvitation() ? "Family member - Free" : "Active - Free";
  const paymentCount = userCreatedPersonalPaymentCount();
  const canManageAnyFamily = ownedFamilies().some((family) => canManageMembersForFamily(family.id));
  $("#settingsPlanBadge").textContent = plan;
  $("#settingsPlanBadge").className = `mini-badge ${badgeClass(plan)}`;
  $("#settingsPaymentLimit").textContent = entitlement?.active_payment_limit == null
    ? "Unlimited payments in this workspace"
    : `${paymentCount}/${entitlement.active_payment_limit} active personal payments used`;
  $("#settingsMemberAccess").textContent = canManageAnyFamily ? "Can invite family members" : "Can join invited families";
  $("#settingsEmail").textContent = state.session.user.email || "-";
  renderWorkspaceCurrencySettings();
}

function currencyCatalogue() {
  return state.supportedCurrencies.length
    ? state.supportedCurrencies.map((item) => [item.code, item.name])
    : PAYMENT_CURRENCIES;
}

function populateCurrencySelect(select, selectedValues, allowedCodes = null) {
  if (!select) return;
  const selected = new Set(Array.isArray(selectedValues) ? selectedValues : [selectedValues].filter(Boolean));
  const allowed = allowedCodes ? new Set(allowedCodes) : null;
  select.innerHTML = "";
  currencyCatalogue().forEach(([code, name]) => {
    if (allowed && !allowed.has(code)) return;
    const option = new Option(`${code} — ${name}`, code);
    option.selected = selected.has(code);
    select.append(option);
  });
}

function canManageCurrentWorkspaceCurrencies() {
  const workspace = currentBudgetWorkspace();
  if (!workspace) return false;
  if (workspace.owner_id === state.session?.user?.id) return true;
  return state.workspaceMembers.some((member) =>
    member.workspace_id === workspace.id && member.user_id === state.session?.user?.id && member.status === "active" &&
    ["business_owner", "business_admin", "finance_manager"].includes(member.role)
  );
}

function renderWorkspaceCurrencySettings() {
  const settings = state.workspaceSettings || {
    default_payment_currency: "USD",
    enabled_currencies: ["USD"],
    reporting_currency: "USD",
    conversion_enabled: false
  };
  populateCurrencySelect($("#workspaceEnabledCurrencies"), settings.enabled_currencies);
  populateCurrencySelect($("#workspaceDefaultCurrency"), settings.default_payment_currency, settings.enabled_currencies);
  populateCurrencySelect($("#workspaceReportingCurrency"), settings.reporting_currency, settings.enabled_currencies);
  $("#workspaceConversionEnabled").checked = Boolean(settings.conversion_enabled);
  const canManage = canManageCurrentWorkspaceCurrencies();
  $("#workspaceCurrencySettingsForm").querySelectorAll("input, select, button").forEach((field) => {
    field.disabled = !canManage;
  });
  $("#saveWorkspaceCurrencyButton").title = canManage ? "" : "Only an authorized workspace finance manager can change these settings.";
  const presentation = rateStatusPresentation();
  $("#workspaceRateStatus").textContent = presentation.text;
  $("#workspaceRateStatus").dataset.level = presentation.level;
}

function selectedOptions(select) {
  return [...select.selectedOptions].map((option) => option.value);
}

function refreshWorkspaceCurrencyDependentOptions() {
  const enabled = selectedOptions($("#workspaceEnabledCurrencies"));
  const defaultValue = $("#workspaceDefaultCurrency").value;
  const reportingValue = $("#workspaceReportingCurrency").value;
  populateCurrencySelect($("#workspaceDefaultCurrency"), enabled.includes(defaultValue) ? defaultValue : enabled[0], enabled);
  populateCurrencySelect($("#workspaceReportingCurrency"), enabled.includes(reportingValue) ? reportingValue : enabled[0], enabled);
}

async function saveWorkspaceCurrencySettings(event) {
  event.preventDefault();
  const workspace = currentBudgetWorkspace();
  const button = event.submitter || $("#saveWorkspaceCurrencyButton");
  if (!workspace) return;
  try {
    setSubmitting(button, true, "Saving...");
    await query("workspace currency settings save", supabase.rpc("save_workspace_currency_settings", {
      p_workspace_id: workspace.id,
      p_default_payment_currency: $("#workspaceDefaultCurrency").value,
      p_enabled_currencies: selectedOptions($("#workspaceEnabledCurrencies")),
      p_reporting_currency: $("#workspaceReportingCurrency").value,
      p_conversion_enabled: $("#workspaceConversionEnabled").checked
    }));
    if ($("#workspaceConversionEnabled").checked) {
      await query("workspace historical conversion backfill", supabase.rpc("backfill_workspace_currency_conversions", {
        p_workspace_id: workspace.id
      }));
    }
    await loadWorkspaceSubscriptionData();
    renderFamilyApp();
    showToast("Workspace currency settings saved. Existing amounts were not changed.");
  } catch (error) {
    showToast(error.message);
  } finally {
    setSubmitting(button, false, "Save currency settings");
  }
}

function titleCase(value) {
  return `${value || ""}`.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function activePriceFor(planId, billingPeriod, currency = null) {
  return state.planPrices.find((price) =>
    price.plan_id === planId &&
    price.billing_period === billingPeriod &&
    price.is_active &&
    (!currency || price.currency === currency)
  ) || null;
}

function includedMemberSeats(plan) {
  const configured = state.planLimits.find((limit) =>
    limit.plan_id === plan?.id && limit.limit_code === "included_member_seats"
  );
  if (configured?.limit_value != null) return Math.max(1, Number(configured.limit_value));
  return plan?.code === "household" ? 4 : plan?.code === "business" ? 6 : 1;
}

function extraMemberBillingMonths(price) {
  return price?.billing_period === "annual" ? 12 : 1;
}

function planInvoiceTotal(plan, price, memberCountOverride = null) {
  if (!plan || !price) return 0;
  const includedSeats = includedMemberSeats(plan);
  const selectedWorkspace = currentBudgetWorkspace();
  const relevantMemberCount = memberCountOverride == null
    ? selectedWorkspace?.workspace_type === plan.workspace_type
      ? Math.max(
        Number(state.billableMemberCount || 1),
        Number(state.memberUsage?.member_limit || state.workspaceSubscription?.member_limit || 1)
      )
      : includedSeats
    : Math.max(includedSeats, Number(memberCountOverride || includedSeats));
  const extraSeats = ["household", "business"].includes(plan.code)
    ? Math.max(0, relevantMemberCount - includedSeats)
    : 0;
  return Number(price.amount || 0)
    + extraSeats * Number(price.extra_member_amount || 0) * extraMemberBillingMonths(price);
}

function renderSubscription() {
  const workspace = currentBudgetWorkspace();
  const entitlement = state.workspaceEntitlement;
  if (!workspace || !entitlement) return;
  const activeItems = state.paymentItems.filter((item) => item.workspace_id === workspace.id && item.status !== "inactive").length;
  const tracksMemberPlaces = ["household", "business"].includes(workspace.workspace_type);
  const memberLimit = Math.max(1, Number(state.memberUsage?.member_limit || state.workspaceSubscription?.member_limit || 1));
  const memberUsage = Number(state.memberUsage?.used_member_count || state.billableMemberCount || 1);
  const limitText = tracksMemberPlaces
    ? `${memberUsage} / ${memberLimit}`
    : entitlement.active_payment_limit == null
      ? `${activeItems} active`
      : `${activeItems} / ${entitlement.active_payment_limit}`;
  $("#subscriptionPlanName").textContent = entitlement.plan_name;
  $("#subscriptionStatusText").textContent = titleCase(entitlement.effective_status);
  $("#subscriptionWorkspaceName").textContent = workspace.name;
  $("#subscriptionWorkspaceType").textContent = titleCase(workspace.workspace_type);
  $("#subscriptionPaidThrough").textContent = entitlement.paid_through_at
    ? new Date(entitlement.paid_through_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "No expiry";
  $("#subscriptionUsage").textContent = limitText;
  $("#subscriptionUsageCaption").textContent = tracksMemberPlaces
    ? `${Number(state.memberUsage?.active_member_count || 1)} active · ${Number(state.memberUsage?.pending_invitation_count || 0)} pending · ${Number(state.memberUsage?.available_member_count || 0)} available`
    : "Active payment items";
  $("#openRenewalButton").disabled = !currentWorkspaceIsOwned();

  const notice = $("#subscriptionAccessNotice");
  notice.classList.toggle("hidden", entitlement.effective_status === "active" && !entitlement.read_only);
  if (!notice.classList.contains("hidden")) {
    notice.innerHTML = entitlement.effective_status === "suspended"
      ? "<strong>Workspace suspended.</strong><span>Access can only be restored by an authorized Mushavo Budget administrator. A payment submission does not automatically remove a suspension.</span>"
      : "<strong>Subscription expired.</strong><span>Your data remains stored. This shared workspace is read-only until its owner renews it.</span>";
  }
  renderWorkspacePlans();
  renderRenewalHistory();
  renderEntitlementHistory();
}

function renderWorkspacePlans() {
  const list = $("#workspacePlanList");
  const workspace = currentBudgetWorkspace();
  const comparableWorkspaceTypes = workspace?.workspace_type === "business"
    ? new Set(["business"])
    : new Set(["personal", "household"]);
  const plans = state.plans.filter((plan) => comparableWorkspaceTypes.has(plan.workspace_type));
  list.innerHTML = "";
  plans.forEach((plan) => {
    const monthly = activePriceFor(plan.id, "monthly");
    const annual = activePriceFor(plan.id, "annual", monthly?.currency) || activePriceFor(plan.id, "annual");
    const appliesToSelectedWorkspace = plan.workspace_type === workspace?.workspace_type;
    const current = appliesToSelectedWorkspace && plan.code === state.workspaceEntitlement?.plan_code;
    const startsNewFamily = workspace?.workspace_type === "personal" && plan.workspace_type === "household";
    const familyPlanPending = startsNewFamily && state.renewalRequests.some((request) =>
      request.provision_workspace_on_approval && request.status === "pending_review"
    );
    const canSelect = currentWorkspaceIsOwned() && plan.code !== "free" && (appliesToSelectedWorkspace || startsNewFamily);
    const workspaceTypeLabel = plan.workspace_type === "household" ? "Family" : titleCase(plan.workspace_type);
    const availabilityMessage = plan.workspace_type === "household"
      ? "Select a Family workspace to choose this plan."
      : "Select Personal budget to choose this plan.";
    const card = document.createElement("article");
    card.className = `plan-card${current ? " current" : ""}`;
    card.innerHTML = `
      <div class="plan-card-heading"><span class="mini-badge ${current ? "active" : ""}">${current ? "Current" : workspaceTypeLabel}</span><h4>${escapeHtml(plan.display_name)}</h4></div>
      <p>${escapeHtml(plan.description)}</p>
      <dl>
        <div><dt>Monthly</dt><dd>${monthly ? money(planInvoiceTotal(plan, monthly), monthly.currency) : plan.code === "free" ? "Free" : "Not configured"}</dd></div>
        <div><dt>Annual</dt><dd>${annual ? money(planInvoiceTotal(plan, annual), annual.currency) : plan.code === "free" ? "Free" : "Not configured"}</dd></div>
      </dl>
      ${canSelect ? `<button type="button" data-select-renewal-plan="${plan.code}" ${(monthly || annual) && !familyPlanPending ? "" : "disabled"}>${familyPlanPending ? "Awaiting approval" : current ? "Renew plan" : startsNewFamily ? "Choose Family plan" : "Choose plan"}</button>` : ""}
      ${!appliesToSelectedWorkspace && !startsNewFamily ? `<small class="plan-availability-note">${availabilityMessage}</small>` : ""}
    `;
    list.append(card);
  });
}

function renderRenewalHistory() {
  const list = $("#renewalHistoryList");
  if (!state.renewalRequests.length) {
    list.innerHTML = emptyState("No payment requests", "Submitted payments and review decisions will appear here.");
    return;
  }
  list.innerHTML = "";
  state.renewalRequests.forEach((request) => {
    const invoice = state.subscriptionInvoices.find((item) => item.id === request.invoice_id);
    const payment = state.subscriptionPayments.find((item) => item.renewal_request_id === request.id);
    const memberLimitSummary = ["household", "business"].includes(invoice?.plan_code)
      ? `<small>${request.provision_workspace_on_approval ? `New family: ${escapeHtml(request.requested_workspace_name || "Family workspace")} &middot; ` : ""}${Number(invoice?.billable_member_count || 1)} total paid place${Number(invoice?.billable_member_count || 1) === 1 ? "" : "s"}</small>`
      : "";
    const article = document.createElement("article");
    article.className = "record-card";
    article.innerHTML = `<div class="record-main"><strong>${escapeHtml(invoice?.plan_name || "Subscription")}</strong><span>${escapeHtml(invoice?.invoice_number || "Invoice pending")} &middot; ${titleCase(invoice?.billing_period)} &middot; ${new Date(request.created_at).toLocaleDateString()}</span>${memberLimitSummary}${request.rejection_reason ? `<small>${escapeHtml(request.rejection_reason)}</small>` : ""}<div class="badge-row">${statusBadge(request.status)}</div></div><div class="record-side"><strong>${invoice ? money(invoice.total_amount, invoice.currency) : ""}</strong>${payment?.receipt_number ? `<small>Receipt ${escapeHtml(payment.receipt_number)}</small>` : ""}</div>`;
    list.append(article);
  });
}

function renderEntitlementHistory() {
  const list = $("#entitlementHistoryList");
  if (!state.entitlementHistory.length) {
    list.innerHTML = emptyState("No plan history", "The initial entitlement will appear after the complete schema is applied.");
    return;
  }
  list.innerHTML = "";
  state.entitlementHistory.forEach((entry) => {
    const article = document.createElement("article");
    article.className = "record-card";
    article.innerHTML = `<div class="record-main"><strong>${escapeHtml(entry.plans?.display_name || "Plan")}</strong><span>${escapeHtml(entry.reason)} &middot; ${new Date(entry.effective_from).toLocaleDateString()}</span><div class="badge-row">${statusBadge(entry.status)}</div></div><div class="record-side">${entry.effective_until ? `<small>Through ${new Date(entry.effective_until).toLocaleDateString()}</small>` : "<small>No expiry</small>"}</div>`;
    list.append(article);
  });
}

function renderNotifications() {
  const unreadCount = state.notifications.filter((item) => !item.read_at).length;
  const dueReminderCount = notificationDueOccurrences().length;
  const alertCount = unreadCount + dueReminderCount;
  if ($("#notificationCount")) $("#notificationCount").textContent = alertCount;
  document.querySelectorAll("[data-notification-count]").forEach((badge) => {
    badge.textContent = alertCount > 99 ? "99+" : alertCount;
    badge.classList.toggle("hidden", alertCount === 0);
  });
  document.querySelectorAll("[data-open-notifications]").forEach((button) => {
    button.setAttribute("aria-label", alertCount ? `Open notifications, ${alertCount} alerts` : "Open notifications");
  });

  renderNotificationList($("#notificationsList"));
  renderNotificationList($("#notificationDialogList"), true);
}

function renderNotificationList(list, compact = false) {
  if (!list) return;
  const dueReminders = notificationDueOccurrences();
  if (!state.notifications.length && !dueReminders.length) {
    list.innerHTML = emptyState("No notifications", "Invites and payment reminders will appear here.");
    return;
  }
  list.innerHTML = "";
  dueReminders.forEach((occurrence) => {
    const article = document.createElement("article");
    article.className = `record-card${compact ? " notification-card" : ""}`;
    article.innerHTML = `
      <div class="record-main">
        <strong>${escapeHtml(occurrence.item.name)}</strong>
        <span>${money(occurrence.outstanding, occurrence.item.currency)} outstanding &middot; due ${occurrence.dueDate}</span>
        <div class="badge-row">${statusBadge(occurrence.status)}<span class="mini-badge">Payment reminder</span></div>
      </div>
      <div class="record-side"><button class="primary" type="button" data-record-payment="${occurrence.key}">Record payment</button></div>
    `;
    list.append(article);
  });
  state.notifications.forEach((notification) => {
    const invitation = notification.invitation_id
      ? state.familyInvitations.find((item) => item.id === notification.invitation_id)
      : null;
    const isPendingInvite = invitation
      && invitation.status === "pending"
      && invitation.invitee_email?.toLowerCase() === state.session.user.email?.toLowerCase();
    const article = document.createElement("article");
    article.className = `record-card${compact ? " notification-card" : ""}`;
    article.innerHTML = `
      <div class="record-main">
        <strong>${escapeHtml(notification.title)}</strong>
        <span>${escapeHtml(notification.body)}</span>
        <small>${new Date(notification.created_at).toLocaleString()}</small>
        <div class="badge-row">${statusBadge(notification.read_at ? "read" : "new")}</div>
      </div>
      <div class="record-side">
        ${isPendingInvite ? `<div class="row-actions"><button class="primary" type="button" data-accept-invite="${invitation.id}">Accept</button><button type="button" data-reject-invite="${invitation.id}">Reject</button></div>` : ""}
        ${notification.url ? `<button type="button" data-open-notification="${notification.id}">Open</button>` : ""}
        ${notification.read_at ? "" : `<button type="button" data-read-notification="${notification.id}">Mark read</button>`}
      </div>
    `;
    list.append(article);
  });
}

function notificationDueOccurrences() {
  const currentMonth = toMonthValue(new Date());
  const todayValue = toDateValue(new Date());
  const todayDate = parseDate(todayValue);
  return [
    ...generateOccurrences(state.paymentItems, state.paymentRecords, currentMonth),
    ...generateOccurrences(state.paymentItems, state.paymentRecords, offsetMonthValue(currentMonth, 1))
  ]
    .filter((occurrence) => {
      if (occurrence.outstanding <= 0) return false;
      const daysUntilDue = Math.ceil((parseDate(occurrence.dueDate) - todayDate) / 86400000);
      return daysUntilDue >= 0 && daysUntilDue <= Number(occurrence.item.reminder_days_before ?? 3);
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 8);
}

function openInviteMemberDialog() {
  const button = $("#inviteMemberButton");
  if (button.disabled) {
    showToast("Only an active family owner with member access can send invitations.");
    return;
  }
  const dialog = $("#inviteMemberDialog");
  if (!dialog.open) dialog.showModal();
  window.setTimeout(() => $("#inviteEmail").focus(), 0);
}

function openNotificationDialog() {
  renderNotifications();
  const dialog = $("#notificationDialog");
  if (dialog && !dialog.open) dialog.showModal();
}

function eligibleRenewalPlans() {
  const workspace = currentBudgetWorkspace();
  return state.plans.filter((plan) => {
    if (plan.code === "free" || plan.available_for_purchase === false) return false;
    if (plan.workspace_type === workspace?.workspace_type) return true;
    return workspace?.workspace_type === "personal" && plan.workspace_type === "household";
  });
}

function openRenewalDialog(planCode = null) {
  if (!currentWorkspaceIsOwned()) {
    showToast("Only the workspace owner can submit a subscription payment.");
    return;
  }
  const plans = eligibleRenewalPlans();
  if (!plans.length) {
    showToast("No paid plan is available for this workspace yet.");
    return;
  }
  const select = $("#renewalPlan");
  select.innerHTML = "";
  plans.forEach((plan) => select.append(new Option(plan.display_name, plan.code)));
  select.value = plans.some((plan) => plan.code === planCode)
    ? planCode
    : plans.some((plan) => plan.code === state.workspaceEntitlement?.plan_code)
      ? state.workspaceEntitlement.plan_code
      : plans[0].code;
  const selectedPlan = plans.find((plan) => plan.code === select.value);
  const selectedWorkspace = currentBudgetWorkspace();
  const startsNewFamily = selectedWorkspace?.workspace_type === "personal" && selectedPlan?.workspace_type === "household";
  const managesMemberLimit = startsNewFamily || selectedWorkspace?.workspace_type === selectedPlan?.workspace_type && ["household", "business"].includes(selectedPlan?.workspace_type);
  if (managesMemberLimit) {
    $("#renewalFamilyMemberCount").value = `${startsNewFamily
      ? includedMemberSeats(selectedPlan)
      : Math.max(
        includedMemberSeats(selectedPlan),
        Number(state.memberUsage?.member_limit || state.workspaceSubscription?.member_limit || state.billableMemberCount || 1)
      )}`;
  }
  $("#renewalPaymentDate").value = toDateValue(new Date());
  updateRenewalQuote();
  const dialog = $("#renewalDialog");
  if (!dialog.open) dialog.showModal();
}

function updateRenewalQuote() {
  const plan = state.plans.find((item) => item.code === $("#renewalPlan").value);
  const workspace = currentBudgetWorkspace();
  const startsNewFamily = workspace?.workspace_type === "personal" && plan?.workspace_type === "household";
  const managesMemberLimit = startsNewFamily || (
    workspace?.workspace_type === plan?.workspace_type && ["household", "business"].includes(plan?.workspace_type)
  );
  const period = $("#renewalPeriod").value;
  const availablePrices = state.planPrices.filter((price) => price.plan_id === plan?.id && price.billing_period === period && price.is_active);
  const currencySelect = $("#renewalCurrency");
  const previousCurrency = currencySelect.value;
  currencySelect.innerHTML = "";
  availablePrices.forEach((price) => currencySelect.append(new Option(price.currency, price.currency)));
  if (availablePrices.some((price) => price.currency === previousCurrency)) currencySelect.value = previousCurrency;
  const price = availablePrices.find((item) => item.currency === currencySelect.value) || availablePrices[0] || null;
  if (price) currencySelect.value = price.currency;
  const includedSeats = includedMemberSeats(plan);
  const memberCountInput = $("#renewalFamilyMemberCount");
  const minimumMemberCount = startsNewFamily
    ? includedSeats
    : Math.max(includedSeats, Number(state.memberUsage?.used_member_count || state.billableMemberCount || 1));
  memberCountInput.min = `${minimumMemberCount}`;
  if (managesMemberLimit && Number(memberCountInput.value || 0) < minimumMemberCount) {
    memberCountInput.value = `${Math.max(minimumMemberCount, Number(state.memberUsage?.member_limit || state.workspaceSubscription?.member_limit || minimumMemberCount))}`;
  }
  const requestedMemberCount = managesMemberLimit
    ? Math.max(minimumMemberCount, Number(memberCountInput.value || minimumMemberCount))
    : null;
  const total = planInvoiceTotal(plan, price, requestedMemberCount);
  $("#renewalFamilyNameField").classList.toggle("hidden", !startsNewFamily);
  $("#renewalFamilyMembersField").classList.toggle("hidden", !managesMemberLimit);
  $("#renewalFamilyName").required = startsNewFamily;
  memberCountInput.required = managesMemberLimit;
  $("#renewalDialogTitle").textContent = startsNewFamily ? "Start a Family plan" : "Submit payment for review";
  $("#renewalDialogDescription").textContent = startsNewFamily
    ? `Enter the family name and the total number of people. The base plan includes ${includedSeats} people, including the Family Head.`
    : managesMemberLimit
      ? "Choose the total number of paid places for this workspace. Active members and pending invitations cannot be removed from the calculation."
      : "Submitting payment does not activate access automatically. Authorized finance staff will review it.";
  $("#renewalAmount").value = price ? total.toFixed(2) : "";
  $("#renewalSubmitButton").disabled = !price;
  const extraSeats = managesMemberLimit
    ? Math.max(0, requestedMemberCount - includedSeats)
    : Math.max(0, Number(state.billableMemberCount || 1) - includedSeats);
  const extraMemberPeriodPrice = Number(price?.extra_member_amount || 0) * extraMemberBillingMonths(price);
  $("#renewalFamilyMembersHelp").textContent = price
    ? period === "annual"
      ? `The base price includes ${includedSeats} people: 1 Family Head and ${Math.max(0, includedSeats - 1)} other members. Each additional person costs ${money(price.extra_member_amount, price.currency)} per month, which is ${money(extraMemberPeriodPrice, price.currency)} for one year.`
      : `The base price includes ${includedSeats} people: 1 Family Head and ${Math.max(0, includedSeats - 1)} other members. Each additional person costs ${money(price.extra_member_amount, price.currency)} per month.`
    : `The base price includes ${includedSeats} people in total, including the Family Head.`;
  const totalPeopleOnPlan = managesMemberLimit
    ? requestedMemberCount
    : Math.max(includedSeats, Number(state.billableMemberCount || 1));
  $("#renewalInvoiceSummary").innerHTML = price
    ? `<div><span>Total people on this plan</span><strong>${totalPeopleOnPlan}</strong></div><div><span>Included in base price</span><strong>${includedSeats} people</strong></div><div><span>Base plan</span><strong>${money(price.amount, price.currency)}</strong></div><div><span>Additional people (${extraSeats})</span><strong>${money(extraSeats * extraMemberPeriodPrice, price.currency)}</strong></div><div class="invoice-total"><span>Total submitted</span><strong>${money(total, price.currency)}</strong></div>`
    : `<strong>Price not configured.</strong><span>An administrator must publish a ${period} price before this plan can be purchased.</span>`;
}

async function uploadSubscriptionProof(file, workspaceId) {
  validateProofFile(file);
  const extension = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `workspaces/${workspaceId}/${state.session.user.id}/${crypto.randomUUID()}.${extension || "bin"}`;
  const { error } = await supabase.storage.from(SUBSCRIPTION_PROOF_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false
  });
  if (error) throw new Error(error.message);
  return path;
}

async function submitSubscriptionRenewal(event) {
  event.preventDefault();
  const workspace = currentBudgetWorkspace();
  const plan = state.plans.find((item) => item.code === $("#renewalPlan").value);
  const period = $("#renewalPeriod").value;
  const currency = $("#renewalCurrency").value;
  const price = activePriceFor(plan?.id, period, currency);
  const proof = $("#renewalProof").files[0] || null;
  const submitButton = $("#renewalSubmitButton");
  const startsNewFamily = workspace?.workspace_type === "personal" && plan?.workspace_type === "household";
  const managesMemberLimit = startsNewFamily || (
    workspace?.workspace_type === plan?.workspace_type && ["household", "business"].includes(plan?.code)
  );
  const includedSeats = includedMemberSeats(plan);
  const requestedMemberCount = Number($("#renewalFamilyMemberCount").value || includedSeats);
  const minimumMemberCount = startsNewFamily
    ? includedSeats
    : Math.max(includedSeats, Number(state.memberUsage?.used_member_count || state.billableMemberCount || 1));
  const amount = planInvoiceTotal(plan, price, managesMemberLimit ? requestedMemberCount : null);
  const familyName = $("#renewalFamilyName").value.trim();
  let proofPath = null;
  try {
    if (!workspace || !plan || !price) throw new Error("Choose a plan with an active price.");
    if (startsNewFamily && !familyName) throw new Error("FAMILY_NAME_REQUIRED");
    if (managesMemberLimit && (!Number.isInteger(requestedMemberCount) || requestedMemberCount < minimumMemberCount || requestedMemberCount > 100)) {
      throw new Error("INVALID_FAMILY_MEMBER_COUNT");
    }
    setSubmitting(submitButton, true, "Submitting...");
    if (proof) proofPath = await uploadSubscriptionProof(proof, workspace.id);
    const request = startsNewFamily
      ? supabase.rpc("submit_family_plan_request", {
        p_personal_workspace_id: workspace.id,
        p_family_name: familyName,
        p_total_member_count: requestedMemberCount,
        p_plan_code: plan.code,
        p_billing_period: period,
        p_currency: currency,
        p_amount: amount,
        p_payment_method: $("#renewalMethod").value,
        p_payment_date: $("#renewalPaymentDate").value,
        p_reference_number: $("#renewalReference").value.trim(),
        p_notes: $("#renewalNotes").value.trim() || null,
        p_proof_path: proofPath,
        p_proof_name: proof?.name || null,
        p_proof_mime_type: proof?.type || null,
        p_proof_size_bytes: proof?.size || null
      })
      : supabase.rpc("submit_subscription_renewal", {
      p_workspace_id: workspace.id,
      p_plan_code: plan.code,
      p_total_member_count: managesMemberLimit ? requestedMemberCount : null,
      p_billing_period: period,
      p_currency: currency,
      p_amount: amount,
      p_payment_method: $("#renewalMethod").value,
      p_payment_date: $("#renewalPaymentDate").value,
      p_reference_number: $("#renewalReference").value.trim(),
      p_notes: $("#renewalNotes").value.trim() || null,
      p_proof_path: proofPath,
      p_proof_name: proof?.name || null,
      p_proof_mime_type: proof?.type || null,
      p_proof_size_bytes: proof?.size || null
      });
    await query("subscription payment submit", request);
    $("#renewalForm").reset();
    $("#renewalDialog").close();
    await loadWorkspaceSubscriptionData();
    renderSubscription();
    showToast(startsNewFamily
      ? "Family plan submitted for review. The family will be created after approval."
      : "Payment submitted for review. Access changes only after approval.");
  } catch (error) {
    if (proofPath) await supabase.storage.from(SUBSCRIPTION_PROOF_BUCKET).remove([proofPath]).catch(() => {});
    showToast(error.message);
  } finally {
    setSubmitting(submitButton, false, "Submit for review");
    updateRenewalQuote();
  }
}

async function inviteMember(event) {
  event.preventDefault();
  assertSupabase();
  const familyId = $("#inviteFamily").value;
  if (!familyId) {
    showToast("Choose the family you want this user to join.");
    return;
  }
  if (!canManageMembersForFamily(familyId)) {
    showToast("Your active membership must include member access before you can send invitations.");
    return;
  }
  const email = $("#inviteEmail").value.trim().toLowerCase();
  if (!email) {
    showToast("Enter the member email address.");
    return;
  }
  try {
    await query(
      "family invitation create",
      supabase.rpc("invite_family_member", {
        p_family_id: familyId,
        p_email: email,
        p_role: $("#inviteRole").value
      })
    );
    $("#inviteForm").reset();
    $("#inviteMemberDialog").close();
    await loadFamilyData();
    await loadWorkspaceSubscriptionData();
    renderFamilyApp();
    showToast("Invitation sent.");
  } catch (error) {
    showToast(error.message);
  }
}

async function respondToInvitation(invitationId, status) {
  const invitation = state.familyInvitations.find((item) => item.id === invitationId);
  if (!invitation) return;
  try {
    await query(
      "invitation response",
      supabase.rpc("respond_to_family_invitation", {
        p_invitation_id: invitationId,
        p_accept: status === "accepted"
      })
    );
    if (status === "accepted") {
      window.localStorage.setItem(selectedFamilyStorageKey(), invitation.family_id);
    }
    await loadAccess();
    await loadFamily();
    await loadFamilyData();
    await loadWorkspaceSubscriptionData();
    renderFamilyApp();
    showToast(status === "accepted" ? "Family invitation accepted." : "Family invitation rejected.");
  } catch (error) {
    showToast(error.message);
  }
}

async function createFamilyWorkspace(name, monthlyBudget, currency) {
  if (!canCreateFamily()) {
    showToast(hasActiveMembership()
      ? "You have reached your family limit. Ask the admin to increase it."
      : "An active subscription is required to create a family.");
    return null;
  }
  const familyId = await query(
    "family create",
    supabase.rpc("create_family_workspace", {
      p_name: name,
      p_monthly_budget: Number(monthlyBudget || 0),
      p_currency: currency
    })
  );
  window.localStorage.setItem(selectedFamilyStorageKey(), familyId);
  return familyId;
}

function paymentItemsForReportWorkspace() {
  const workspace = currentBudgetWorkspace();
  if (!workspace) return [];
  return state.paymentItems.filter((item) => {
    if (item.workspace_id) return item.workspace_id === workspace.id;
    if (workspace.workspace_type === "personal") {
      return item.visibility === "personal" && item.owner_id === state.session?.user?.id;
    }
    return item.visibility === "family" && item.family_id === workspace.legacy_family_id;
  });
}

function paymentRecordsForReportWorkspace(items) {
  const workspace = currentBudgetWorkspace();
  if (!workspace) return [];
  const paymentItemIds = new Set(items.map((item) => item.id));
  return state.paymentRecords.filter((record) => {
    if (record.workspace_id) return record.workspace_id === workspace.id;
    return paymentItemIds.has(record.payment_item_id);
  });
}

function renderReports() {
  const workspace = currentBudgetWorkspace();
  const hasAnalytics = Boolean(
    state.workspaceEntitlement?.finance_analytics &&
    state.workspaceEntitlement?.effective_status === "active" &&
    !state.workspaceEntitlement?.read_only
  );
  const workspaceLabel = workspace?.name || (state.family ? state.family.name : "Personal budget");
  const workspaceTypeLabel = workspace?.workspace_type === "household" ? "Family" : titleCase(workspace?.workspace_type || "personal");
  const periodLabel = parseDate(monthStart(state.filterMonth)).toLocaleString("en", { month: "long", year: "numeric" });
  $("#reportMonthFilter").value = state.filterMonth;
  $("#reportPeriodLabel").textContent = hasAnalytics
    ? `${workspaceLabel} payment performance for ${periodLabel}.`
    : `${workspaceLabel} report access for ${periodLabel}.`;
  $("#reportsLockEyebrow").textContent = `${workspaceTypeLabel} reports`;
  $("#reportsLockTitle").textContent = `${workspaceLabel} reports are locked`;
  $("#reportsLockText").textContent = `The selected ${workspaceTypeLabel.toLowerCase()} workspace does not have an active analytics plan. Choose another workspace above or upgrade this workspace.`;
  $("#reportsLockNotice").classList.toggle("hidden", hasAnalytics);
  document.querySelector(".report-summary-grid").classList.toggle("hidden", !hasAnalytics);
  document.querySelector(".report-analysis-grid").classList.toggle("hidden", !hasAnalytics);
  $("#reportRatePanel").classList.toggle("hidden", !hasAnalytics);
  if (!hasAnalytics) return;
  const allReportItems = paymentItemsForReportWorkspace();
  const availableCurrencies = [...new Set(allReportItems.map((item) => item.currency || "USD"))].sort();
  const currencyFilter = $("#reportCurrencyFilter");
  const currentFilter = availableCurrencies.includes(state.reportCurrencyFilter) ? state.reportCurrencyFilter : "all";
  currencyFilter.innerHTML = '<option value="all">All currencies</option>';
  availableCurrencies.forEach((currency) => currencyFilter.append(new Option(currency, currency)));
  state.reportCurrencyFilter = currentFilter;
  currencyFilter.value = currentFilter;
  const conversionAvailable = Boolean(state.workspaceSettings?.conversion_enabled);
  $("#reportViewMode").disabled = !conversionAvailable;
  if (!conversionAvailable) state.reportViewMode = "original";
  $("#reportViewMode").value = state.reportViewMode;
  const enabledReportingCurrencies = activeWorkspaceCurrencies();
  const configuredReportingCurrency = state.workspaceSettings?.reporting_currency || "USD";
  if (!enabledReportingCurrencies.includes(state.reportReportingCurrency)) {
    state.reportReportingCurrency = configuredReportingCurrency;
  }
  populateCurrencySelect($("#reportReportingCurrency"), state.reportReportingCurrency, enabledReportingCurrencies);
  $("#reportReportingCurrency").disabled = !conversionAvailable || state.reportViewMode !== "converted";
  const reportItems = allReportItems.filter((item) => currentFilter === "all" || item.currency === currentFilter);
  const reportRecords = paymentRecordsForReportWorkspace(reportItems);
  const occurrences = generateOccurrences(reportItems, reportRecords, state.filterMonth);
  const paid = occurrences.filter((item) => item.status === "paid").length;
  const partial = occurrences.filter((item) => item.status === "partial").length;
  const overdue = occurrences.filter((item) => item.status === "overdue").length;
  const paidRate = occurrences.length ? Math.round((paid / occurrences.length) * 100) : 0;
  $("#paidRate").textContent = `${paidRate}%`;
  $("#reportCompletionCaption").textContent = `${paid} of ${occurrences.length} payments completed`;
  const dueRows = occurrences.map((item) => ({ currency: item.item.currency, amount: item.amount }));
  const paidRows = occurrences.map((item) => ({ currency: item.item.currency, amount: item.paid }));
  const outstandingRows = occurrences.map((item) => ({ currency: item.item.currency, amount: item.outstanding }));
  $("#reportDueTotal").textContent = formatReportMoney(dueRows);
  $("#reportPaidTotal").textContent = formatReportMoney(paidRows);
  $("#reportOutstandingTotal").textContent = formatReportMoney(outstandingRows);
  $("#reportOverdueCaption").textContent = `${overdue} overdue payment${overdue === 1 ? "" : "s"}`;
  $("#partialCount").textContent = partial;
  $("#activeObligationCount").textContent = reportItems.filter((item) => item.status !== "inactive").length;
  $("#yearExpected").textContent = formatReportMoney(estimateYearTotals(reportItems));
  $("#collectionProgressRing").style.setProperty("--progress", `${paidRate * 3.6}deg`);
  $("#collectionProgressValue").textContent = `${paidRate}%`;
  $("#collectionProgressTitle").textContent = !occurrences.length
    ? "No payments due"
    : paidRate === 100
      ? "Everything is paid"
      : paidRate >= 70
        ? "Good progress this month"
        : "Payments need attention";
  $("#collectionProgressText").textContent = !occurrences.length
    ? "Add a payment to begin tracking monthly reliability."
    : `${occurrences.length - paid} payment${occurrences.length - paid === 1 ? " remains" : "s remain"}; ${partial} partial and ${overdue} overdue.`;
  renderStatusAnalysis(occurrences);
  renderReportTrend(reportItems, reportRecords);
  renderCategoryReport(occurrences);
  renderPaymentRecordList(reportRecords);
  renderReportRatePanel();
}

function formatReportMoney(rows) {
  if (state.reportViewMode !== "converted") return formatCurrencyTotals(rows);
  return formatConvertedTotal(rows, reportReportingCurrency()) || "Rate unavailable";
}

function reportReportingCurrency() {
  return state.reportReportingCurrency || selectedReportingCurrency();
}

function renderReportRatePanel() {
  const presentation = rateStatusPresentation();
  const converted = state.reportViewMode === "converted";
  $("#reportRateTitle").textContent = converted
    ? `Converted estimates in ${reportReportingCurrency()}`
    : "Original currency totals";
  $("#reportRateText").textContent = converted
    ? `${presentation.text} Completed payment conversions are locked; unpaid balances use the latest stored rate.`
    : "Amounts are grouped by their original currency. Change Money view to compare them in one reporting currency.";
  $("#reportRatePanel").dataset.level = converted ? presentation.level : "original";
}

function renderStatusAnalysis(occurrences) {
  const list = $("#reportStatusList");
  const rows = [
    { label: "Paid", className: "paid", count: occurrences.filter((item) => item.status === "paid").length },
    { label: "Partial", className: "partial", count: occurrences.filter((item) => item.status === "partial").length },
    { label: "Overdue", className: "overdue", count: occurrences.filter((item) => item.status === "overdue").length },
    { label: "Upcoming", className: "upcoming", count: occurrences.filter((item) => ["due-soon", "upcoming"].includes(item.status)).length }
  ];
  list.innerHTML = rows.map((row) => {
    const percentage = occurrences.length ? Math.round((row.count / occurrences.length) * 100) : 0;
    return `<div class="status-analysis-row ${row.className}"><div><span>${row.label}</span><strong>${row.count}</strong></div><div class="meter"><span style="width:${percentage}%"></span></div><small>${percentage}%</small></div>`;
  }).join("");
}

function renderReportTrend(reportItems, reportRecords) {
  const list = $("#reportTrendList");
  const months = Array.from({ length: 6 }, (_, index) => offsetMonthValue(state.filterMonth, index - 5));
  list.innerHTML = months.map((monthValue) => {
    const occurrences = generateOccurrences(reportItems, reportRecords, monthValue);
    const completed = occurrences.filter((item) => item.status === "paid").length;
    const percentage = occurrences.length ? Math.round((completed / occurrences.length) * 100) : 0;
    const label = parseDate(monthStart(monthValue)).toLocaleString("en", { month: "short", year: "2-digit" });
    return `<div class="trend-row"><span>${label}</span><div class="meter"><span style="width:${percentage}%"></span></div><strong>${percentage}%</strong><small>${completed}/${occurrences.length}</small></div>`;
  }).join("");
}

function estimateYearTotals(items) {
  return items.filter((item) => item.status !== "inactive").reduce((rows, item) => {
    let multiplier = 12;
    if (item.recurrence_type === "once") multiplier = 1;
    if (item.recurrence_type === "quarterly") multiplier = 4;
    if (item.recurrence_type === "yearly") multiplier = 1;
    if (item.recurrence_type === "custom") multiplier = Math.ceil(12 / Math.max(Number(item.recurrence_interval || 1), 1));
    rows.push({ currency: item.currency, amount: Number(item.amount || 0) * multiplier });
    return rows;
  }, []);
}

function renderCategoryReport(occurrences) {
  const list = $("#categoryReportList");
  const rows = Object.values(occurrences.reduce((acc, occurrence) => {
    const target = state.reportViewMode === "converted" ? reportReportingCurrency() : occurrence.item.currency;
    const due = state.reportViewMode === "converted"
      ? convertAmountScaled(occurrence.amount, occurrence.item.currency, target)
      : decimalToScaled(occurrence.amount);
    const outstanding = state.reportViewMode === "converted"
      ? convertAmountScaled(occurrence.outstanding, occurrence.item.currency, target)
      : decimalToScaled(occurrence.outstanding);
    const key = `${occurrence.item.category}:${target}`;
    acc[key] ||= { name: occurrence.item.category, amount: 0n, outstanding: 0n, currency: target, missingRate: false };
    if (due == null || outstanding == null) acc[key].missingRate = true;
    else {
      acc[key].amount += due;
      acc[key].outstanding += outstanding;
    }
    return acc;
  }, {}));
  if (!rows.length) {
    list.innerHTML = emptyState("No category data", "Reports update when monthly obligations exist.");
    return;
  }
  const max = rows.reduce((largest, row) => row.amount > largest ? row.amount : largest, 1n);
  list.innerHTML = "";
  rows.forEach((row) => {
    const item = document.createElement("article");
    item.className = "breakdown-item";
    item.innerHTML = `
      <div class="category-chip">${escapeHtml(row.name.slice(0, 2).toUpperCase())}</div>
      <div>
        <strong>${escapeHtml(row.name)}</strong>
        <span>${row.missingRate ? "Rate unavailable" : `${money(scaledToDecimal(row.amount), row.currency)} due &middot; ${money(scaledToDecimal(row.outstanding), row.currency)} outstanding`}</span>
        <div class="meter small-meter"><span style="width:${Number((row.amount * 100n) / max)}%"></span></div>
      </div>
    `;
    list.append(item);
  });
}

function renderPaymentRecordList(reportRecords) {
  const list = $("#paymentRecordsList");
  if (!reportRecords.length) {
    list.innerHTML = emptyState("No payment records", "Partial and full payments will appear here after they are saved.");
    return;
  }
  list.innerHTML = "";
  reportRecords.slice(0, 20).forEach((record) => list.append(renderFamilyPaymentRecord(record)));
}

function renderFamilyPaymentRecord(record) {
  const item = state.paymentItems.find((paymentItem) => paymentItem.id === record.payment_item_id);
  const member = memberById(record.paid_by_member_id);
  const article = document.createElement("article");
  const recordCurrency = record.currency || item?.currency || familyCurrency();
  const locked = lockedConversionFor("payment_record", record.id, reportReportingCurrency());
  article.className = "record-card";
  article.innerHTML = `
    <div class="date-chip"><strong>${parseDate(record.payment_date).getDate()}</strong><span>${parseDate(record.payment_date).toLocaleString("en", { month: "short" })}</span></div>
    <div class="record-main">
      <strong>${escapeHtml(item?.name || "Payment")}</strong>
      <span>${escapeHtml(member?.name || "Household account")} &middot; ${escapeHtml(record.payment_method || "Method not set")} &middot; ${escapeHtml(record.reference_number || "No reference")}</span>
      ${record.notes ? `<small>${escapeHtml(record.notes)}</small>` : ""}
      ${record.proof_name ? `<small>Proof: ${escapeHtml(record.proof_name)}${record.proof_size_bytes ? ` &middot; ${formatFileSize(record.proof_size_bytes)}` : ""}</small>` : ""}
    </div>
    <div class="record-side">
      <strong>${money(record.amount, recordCurrency)}</strong>
      ${locked ? `<small>${money(locked.converted_amount, locked.reporting_currency)} at locked rate ${escapeHtml(locked.exchange_rate)}</small>` : ""}
      <div class="row-actions">
        ${record.proof_path ? `<button type="button" data-open-proof="${record.id}">View proof</button>` : ""}
        <button type="button" data-delete-record="${record.id}">Delete</button>
      </div>
    </div>
  `;
  return article;
}

function renderAdmin() {
  renderAdminTabs();
  renderAdminEnquiryBadge();
  if (state.adminTab === "dashboard") renderAdminSummary();
  if (state.adminTab === "households") renderAdminFamilies();
  if (state.adminTab === "users") renderHeads();
  if (state.adminTab === "plans") renderAdminPlans();
  if (state.adminTab === "finance") {
    renderAdminFinanceCurrencyPanel();
    renderPaymentHeadOptions();
    renderPlatformPayments();
    renderSubscriptionReviews();
    renderSubscriptionPaymentHistory();
  }
  if (state.adminTab === "enquiries") renderAdminEnquiries();
  if (state.adminTab === "support") {
    renderAdminNoteOptions();
    renderAdminNotes();
  }
}

function adminReportingCurrency() {
  return state.adminFinanceSettings?.reporting_currency || "USD";
}

function approvedAdminPaymentRows() {
  return [
    ...state.payments.filter((payment) => adminFinanceRecordVisible(payment, "platform_payment")).map((payment) => ({
      entity_type: "platform_payment", entity_id: payment.id, amount: payment.amount,
      currency: payment.currency, at: payment.payment_date
    })),
    ...state.adminSubscriptionPayments.filter((payment) => payment.status === "approved" && adminFinanceRecordVisible(payment, "subscription_payment")).map((payment) => ({
      entity_type: "subscription_payment", entity_id: payment.id, amount: payment.amount,
      currency: payment.currency, at: payment.reviewed_at || payment.payment_date
    }))
  ];
}

function adminFinanceFilterValues() {
  return {
    currency: $("#adminFinanceCurrencyFilter")?.value || "all",
    status: $("#adminFinanceStatusFilter")?.value || "all",
    type: $("#adminFinanceTypeFilter")?.value || "all",
    from: $("#adminFinanceFromDate")?.value || "",
    to: $("#adminFinanceToDate")?.value || "",
    search: ($("#adminFinanceSearch")?.value || "").trim().toLowerCase()
  };
}

function adminFinanceRecordVisible(payment, type) {
  const filters = adminFinanceFilterValues();
  const status = type === "platform_payment" ? "approved" : payment.status;
  const date = payment.payment_date || payment.created_at?.slice(0, 10) || "";
  if (filters.type !== "all" && filters.type !== type) return false;
  if (filters.currency !== "all" && payment.currency !== filters.currency) return false;
  if (filters.status !== "all" && status !== filters.status) return false;
  if (filters.from && date < filters.from) return false;
  if (filters.to && date > filters.to) return false;
  if (filters.search) {
    const workspace = state.adminWorkspaces.find((row) => row.id === payment.workspace_id);
    const owner = state.adminProfiles.find((row) => row.id === workspace?.owner_id);
    const haystack = [payment.reference_number, workspace?.name, owner?.email,
      payment.family_heads?.full_name, payment.family_heads?.email].filter(Boolean).join(" ").toLowerCase();
    if (!haystack.includes(filters.search)) return false;
  }
  return true;
}

function lockedConversionFor(entityType, entityId, reportingCurrency) {
  const source = state.isAdmin ? state.adminPaymentConversions : state.paymentConversions;
  return source.find((row) =>
    row.entity_type === entityType && row.entity_id === entityId && row.reporting_currency === reportingCurrency
  ) || null;
}

function adminConvertedPaymentTotal(rows, targetCurrency) {
  let total = 0n;
  for (const row of rows) {
    const locked = lockedConversionFor(row.entity_type, row.entity_id, targetCurrency);
    if (locked) total += decimalToScaled(locked.converted_amount);
    else {
      const converted = convertAmountScaled(row.amount, row.currency, targetCurrency, row.at);
      if (converted == null) return null;
      total += converted;
    }
  }
  return total;
}

function renderAdminFinanceCurrencyPanel() {
  const settings = state.adminFinanceSettings || {
    reporting_currency: "USD",
    enabled_receipt_currencies: ["USD"],
    conversion_enabled: true
  };
  populateCurrencySelect($("#adminEnabledCurrencies"), settings.enabled_receipt_currencies);
  populateCurrencySelect($("#adminReportingCurrency"), settings.reporting_currency, settings.enabled_receipt_currencies);
  $("#adminConversionEnabled").checked = Boolean(settings.conversion_enabled);
  populateCurrencySelect($("#paymentCurrency"), $("#paymentCurrency").value || settings.reporting_currency, settings.enabled_receipt_currencies);
  const filterSelect = $("#adminFinanceCurrencyFilter");
  const filterValue = filterSelect.value || "all";
  filterSelect.innerHTML = '<option value="all">All currencies</option>';
  settings.enabled_receipt_currencies.forEach((currency) => filterSelect.append(new Option(currency, currency)));
  filterSelect.value = settings.enabled_receipt_currencies.includes(filterValue) ? filterValue : "all";

  const status = state.adminRateStatus || {};
  const presentation = rateStatusPresentation(status);
  $("#adminRateProvider").textContent = "CurrencyAPI";
  $("#adminRateLastSuccess").textContent = status.last_success_at ? new Date(status.last_success_at).toLocaleString() : "Never";
  $("#adminRateEffectiveAt").textContent = status.provider_effective_at ? new Date(status.provider_effective_at).toLocaleString() : "Unavailable";
  $("#adminRateCurrencyCount").textContent = Number(status.currencies_updated || 0);
  $("#adminRateLastAttempt").textContent = status.last_attempt_at
    ? `${new Date(status.last_attempt_at).toLocaleString()} · ${titleCase(status.last_attempt_status || "unknown")}`
    : "Never";
  $("#adminRateAlert").classList.remove("hidden");
  $("#adminRateAlert").dataset.level = presentation.level;
  $("#adminRateAlert").textContent = status.safe_error_summary
    ? `${presentation.text} Last safe error: ${status.safe_error_summary}`
    : presentation.text;

  const rows = approvedAdminPaymentRows();
  $("#adminOriginalCurrencyTotals").textContent = rows.length
    ? formatCurrencyTotals(rows)
    : "No received payments";
  const converted = settings.conversion_enabled ? adminConvertedPaymentTotal(rows, settings.reporting_currency) : null;
  $("#adminConvertedCurrencyTotal").textContent = !settings.conversion_enabled
    ? "Consolidated conversion is disabled"
    : converted == null
      ? "Converted total unavailable until matching rates exist"
      : `${money(scaledToDecimal(converted), settings.reporting_currency)} locked reporting total`;
}

function refreshAdminCurrencyDependentOptions() {
  const enabled = selectedOptions($("#adminEnabledCurrencies"));
  const reporting = $("#adminReportingCurrency").value;
  populateCurrencySelect($("#adminReportingCurrency"), enabled.includes(reporting) ? reporting : enabled[0], enabled);
}

async function saveAdminFinanceCurrencySettings(event) {
  event.preventDefault();
  const button = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
  try {
    setSubmitting(button, true, "Saving...");
    await query("admin finance currency settings save", supabase.rpc("save_admin_finance_currency_settings", {
      p_reporting_currency: $("#adminReportingCurrency").value,
      p_enabled_receipt_currencies: selectedOptions($("#adminEnabledCurrencies")),
      p_conversion_enabled: $("#adminConversionEnabled").checked
    }));
    if ($("#adminConversionEnabled").checked) {
      await query("admin historical conversion backfill", supabase.rpc("backfill_currency_conversions"));
    }
    await loadAdminData("finance");
    renderAdmin();
    showToast("Finance currency settings saved.");
  } catch (error) {
    showToast(friendlyMessage(error.message));
  } finally {
    setSubmitting(button, false, "Save Finance currencies");
  }
}

async function syncExchangeRates() {
  const button = $("#syncExchangeRatesButton");
  try {
    setSubmitting(button, true, "Syncing...");
    const { data, error } = await supabase.functions.invoke("sync-exchange-rates", { body: { source: "admin_manual" } });
    if (error) throw error;
    if (!data || !["success", "partial_failure"].includes(data.status)) throw new Error(data?.error || "RATE_SYNC_FAILED");
    await loadAdminData("finance");
    renderAdmin();
    showToast(`${Number(data.rates_stored || 0)} exchange rates stored.`);
  } catch (error) {
    showToast(friendlyMessage(error.message || "Exchange-rate sync failed."));
  } finally {
    setSubmitting(button, false, "Sync rates now");
  }
}

function renderAdminPlans() {
  const list = $("#adminPlanList");
  const priceSelect = $("#planPricePlan");
  const selectedPricePlan = priceSelect.value;
  priceSelect.innerHTML = state.adminPlans
    .filter((plan) => plan.code !== "free")
    .map((plan) => `<option value="${escapeHtml(plan.code)}">${escapeHtml(plan.display_name)} (${titleCase(plan.workspace_type)})</option>`)
    .join("");
  if ([...priceSelect.options].some((option) => option.value === selectedPricePlan)) priceSelect.value = selectedPricePlan;
  list.innerHTML = "";
  state.adminPlans.forEach((plan) => {
    const activePrices = state.adminPlanPrices.filter((price) => price.plan_id === plan.id && price.is_active);
    const includedSeats = state.adminPlanLimits.find((limit) => limit.plan_id === plan.id && limit.limit_code === "included_member_seats")?.limit_value || 1;
    const enabledFeatures = state.adminPlanFeatures.filter((feature) => feature.plan_id === plan.id && feature.enabled).length;
    const card = document.createElement("article");
    card.className = "plan-card";
    card.innerHTML = `
      <div class="plan-card-heading"><div><span class="mini-badge">${titleCase(plan.workspace_type)}</span>${plan.is_public ? '<span class="mini-badge active">Public</span>' : '<span class="mini-badge">Hidden</span>'}${plan.is_featured ? '<span class="mini-badge active">Recommended</span>' : ""}</div><h4>${escapeHtml(plan.display_name)}</h4></div>
      <p>${escapeHtml(plan.marketing_summary || plan.description)}</p>
      <small>${Number(includedSeats)} ${Number(includedSeats) === 1 ? "person" : "people"} included &middot; ${enabledFeatures} enabled features &middot; ${plan.is_active ? "Active" : "Archived"}</small>
      <div class="plan-price-list">
        ${activePrices.length ? activePrices.map((price) => `<div><strong>${titleCase(price.billing_period)}</strong><span>${money(price.amount, price.currency)} base${Number(price.extra_member_amount) ? ` &middot; ${money(price.extra_member_amount, price.currency)} per extra member/month` : ""}</span></div>`).join("") : "<span>No active prices configured.</span>"}
      </div>
      <button type="button" data-edit-plan-definition="${plan.id}">Edit plan</button>
    `;
    list.append(card);
  });
}

function resetPlanDefinitionForm() {
  const form = $("#planDefinitionForm");
  form.reset();
  $("#planDefinitionId").value = "";
  $("#planDefinitionCode").readOnly = false;
  $("#planDefinitionSeats").value = "1";
  $("#planDefinitionSort").value = "0";
  $("#planDefinitionCta").value = "Choose plan";
  $("#planDefinitionActive").checked = true;
  $("#planDefinitionPurchasable").checked = true;
  $("#planDefinitionTitle").textContent = "Add a plan";
  $("#planDefinitionSubmit").textContent = "Save plan";
  $("#cancelPlanEditButton").classList.add("hidden");
}

function editPlanDefinition(planId) {
  const plan = state.adminPlans.find((item) => item.id === planId);
  if (!plan) return;
  const includedSeats = state.adminPlanLimits.find((limit) => limit.plan_id === plan.id && limit.limit_code === "included_member_seats")?.limit_value || 1;
  const paymentLimit = state.adminPlanLimits.find((limit) => limit.plan_id === plan.id && limit.limit_code === "active_planned_payments")?.limit_value;
  const features = new Set(state.adminPlanFeatures.filter((feature) => feature.plan_id === plan.id && feature.enabled).map((feature) => feature.feature_code));
  $("#planDefinitionId").value = plan.id;
  $("#planDefinitionName").value = plan.display_name || "";
  $("#planDefinitionCode").value = plan.code || "";
  $("#planDefinitionCode").readOnly = true;
  $("#planDefinitionType").value = plan.workspace_type;
  $("#planDefinitionSeats").value = String(includedSeats);
  $("#planDefinitionPaymentLimit").value = paymentLimit == null ? "" : String(paymentLimit);
  $("#planDefinitionSort").value = String(plan.sort_order || 0);
  $("#planDefinitionDescription").value = plan.description || "";
  $("#planDefinitionMarketing").value = plan.marketing_summary || plan.description || "";
  $("#planDefinitionCta").value = plan.cta_label || "Choose plan";
  $("#planDefinitionActive").checked = Boolean(plan.is_active);
  $("#planDefinitionPublic").checked = Boolean(plan.is_public);
  $("#planDefinitionFeatured").checked = Boolean(plan.is_featured);
  $("#planDefinitionPurchasable").checked = plan.available_for_purchase !== false;
  document.querySelectorAll('[name="planFeature"]').forEach((input) => { input.checked = features.has(input.value); });
  $("#planDefinitionTitle").textContent = `Edit ${plan.display_name}`;
  $("#planDefinitionSubmit").textContent = "Save plan changes";
  $("#cancelPlanEditButton").classList.remove("hidden");
  $("#planDefinitionForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function savePlanDefinition(event) {
  event.preventDefault();
  const button = event.submitter || $("#planDefinitionSubmit");
  const paymentLimitValue = $("#planDefinitionPaymentLimit").value.trim();
  const featureCodes = [...document.querySelectorAll('[name="planFeature"]:checked')].map((input) => input.value);
  try {
    setSubmitting(button, true, "Saving...");
    await query("plan definition save", supabase.rpc("save_plan_definition", {
      p_plan_id: $("#planDefinitionId").value || null,
      p_code: $("#planDefinitionCode").value.trim().toLowerCase(),
      p_display_name: $("#planDefinitionName").value.trim(),
      p_description: $("#planDefinitionDescription").value.trim(),
      p_marketing_summary: $("#planDefinitionMarketing").value.trim(),
      p_workspace_type: $("#planDefinitionType").value,
      p_included_member_seats: Number($("#planDefinitionSeats").value),
      p_active_payment_limit: paymentLimitValue ? Number(paymentLimitValue) : null,
      p_is_active: $("#planDefinitionActive").checked,
      p_is_public: $("#planDefinitionPublic").checked,
      p_is_featured: $("#planDefinitionFeatured").checked,
      p_available_for_purchase: $("#planDefinitionPurchasable").checked,
      p_cta_label: $("#planDefinitionCta").value.trim(),
      p_sort_order: Number($("#planDefinitionSort").value || 0),
      p_feature_codes: featureCodes
    }));
    resetPlanDefinitionForm();
    await loadAdminData("plans");
    renderAdminPlans();
    showToast("Plan saved. Published changes now appear on the public Pricing page.");
  } catch (error) {
    showToast(friendlyMessage(error.message));
  } finally {
    setSubmitting(button, false, $("#planDefinitionId").value ? "Save plan changes" : "Save plan");
  }
}

function renderSubscriptionReviews() {
  const list = $("#subscriptionReviewList");
  const pending = state.adminSubscriptionPayments.filter((payment) =>
    payment.status === "pending_review" && adminFinanceRecordVisible(payment, "subscription_payment")
  );
  if (!pending.length) {
    list.innerHTML = emptyState("No payments waiting", "New user proof submissions will appear here for finance review.");
    return;
  }
  list.innerHTML = "";
  pending.forEach((payment) => {
    const request = state.adminRenewalRequests.find((item) => item.id === payment.renewal_request_id);
    const invoice = state.adminSubscriptionInvoices.find((item) => item.id === request?.invoice_id);
    const workspace = state.adminWorkspaces.find((item) => item.id === payment.workspace_id);
    const proof = state.adminSubscriptionProofs.find((item) => item.payment_id === payment.id);
    const canReview = ["super_admin", "admin_staff", "finance_staff"].includes(state.adminRole);
    const article = document.createElement("article");
    article.className = "record-card subscription-review-card";
    article.innerHTML = `
      <div class="record-main"><strong>${escapeHtml(request?.provision_workspace_on_approval ? request.requested_workspace_name || "New Family workspace" : workspace?.name || "Workspace")}</strong><span>${escapeHtml(invoice?.plan_name || "Plan")} &middot; ${titleCase(invoice?.billing_period)} &middot; reference ${escapeHtml(payment.reference_number)}</span><small>${request?.provision_workspace_on_approval ? `Creates a new Family workspace for ${Number(invoice?.billable_member_count || 1)} people after approval.` : "Renews or changes the selected workspace plan."} Submitted ${new Date(payment.created_at).toLocaleString()} by an authenticated workspace owner.</small><div class="badge-row">${statusBadge(payment.status)}${request?.provision_workspace_on_approval ? '<span class="mini-badge">new family</span>' : ""}${proof ? '<span class="mini-badge">proof attached</span>' : ""}</div></div>
      <div class="record-side"><strong>${money(payment.amount, payment.currency)}</strong><div class="row-actions"><button type="button" data-view-subscription-payment="${payment.id}">View details</button>${proof ? `<button type="button" data-open-subscription-proof="${proof.id}">View proof</button>` : ""}${canReview ? `<button class="primary" type="button" data-review-subscription="${payment.id}" data-review-decision="approved">Approve</button><button type="button" data-review-subscription="${payment.id}" data-review-decision="rejected">Reject</button>` : '<span class="mini-badge">Read only</span>'}</div></div>
    `;
    list.append(article);
  });
}

function renderSubscriptionPaymentHistory() {
  const list = $("#subscriptionPaymentHistoryList");
  if (!list) return;
  const history = state.adminSubscriptionPayments.filter((payment) =>
    payment.status !== "pending_review" && adminFinanceRecordVisible(payment, "subscription_payment")
  );
  if (!history.length) {
    list.innerHTML = emptyState("No reviewed subscription payments", "Approved and rejected payments will remain here after review.");
    return;
  }
  list.innerHTML = "";
  history.forEach((payment) => {
    const request = state.adminRenewalRequests.find((item) => item.id === payment.renewal_request_id);
    const invoice = state.adminSubscriptionInvoices.find((item) => item.id === request?.invoice_id);
    const workspace = state.adminWorkspaces.find((item) => item.id === payment.workspace_id);
    const owner = state.adminProfiles.find((profile) => profile.id === workspace?.owner_id);
    const proof = state.adminSubscriptionProofs.find((item) => item.payment_id === payment.id);
    const locked = lockedConversionFor("subscription_payment", payment.id, adminReportingCurrency());
    const article = document.createElement("article");
    article.className = "record-card";
    article.innerHTML = `
      <div class="record-main">
        <strong>${escapeHtml(workspace?.name || request?.requested_workspace_name || "Subscription")}</strong>
        <span>${escapeHtml(owner?.email || "Owner unavailable")} &middot; ${escapeHtml(invoice?.plan_name || "Plan")} &middot; ${titleCase(invoice?.billing_period)}</span>
        <small>${escapeHtml(payment.reference_number || "No reference")} &middot; ${new Date(payment.payment_date || payment.created_at).toLocaleDateString()}${invoice ? ` &middot; ${Number(invoice.billable_member_count || 1)} paid place${Number(invoice.billable_member_count || 1) === 1 ? "" : "s"}` : ""}</small>
        <div class="badge-row">${statusBadge(payment.status)}${payment.receipt_number ? `<span class="mini-badge">${escapeHtml(payment.receipt_number)}</span>` : ""}${proof ? '<span class="mini-badge">proof attached</span>' : ""}</div>
      </div>
      <div class="record-side"><strong>${money(payment.amount, payment.currency)}</strong>${locked ? `<small>${money(locked.converted_amount, locked.reporting_currency)} at locked rate ${escapeHtml(locked.exchange_rate)}</small>` : ""}<div class="row-actions"><button type="button" data-view-subscription-payment="${payment.id}">View details</button>${proof ? `<button type="button" data-open-subscription-proof="${proof.id}">View proof</button>` : ""}${payment.status === "approved" && !locked ? `<button type="button" data-manual-conversion="${payment.id}" data-conversion-entity="subscription_payment">Enter manual rate</button>` : ""}</div></div>
    `;
    list.append(article);
  });
}

async function saveManualConversion(entityType, entityId) {
  const payment = entityType === "subscription_payment"
    ? state.adminSubscriptionPayments.find((row) => row.id === entityId)
    : state.payments.find((row) => row.id === entityId);
  if (!payment) return;
  const target = adminReportingCurrency();
  const raw = window.prompt(`Enter how many ${target} equal 1 ${payment.currency}. This locked rate will be used only for this completed payment:`);
  if (raw == null) return;
  const rate = Number(raw);
  if (!Number.isFinite(rate) || rate <= 0) {
    showToast("Enter a positive exchange rate.");
    return;
  }
  try {
    await query("manual payment conversion save", supabase.rpc("save_manual_payment_conversion", {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_reporting_currency: target,
      p_exchange_rate: rate,
      p_converted_amount: Number(payment.amount) * rate
    }));
    await loadAdminData("finance");
    renderAdmin();
    showToast("Manual exchange rate saved and locked to this payment.");
  } catch (error) {
    showToast(friendlyMessage(error.message));
  }
}

function adminMonitorForWorkspace(workspaceId) {
  return state.adminSubscriptionMonitor.find((row) => row.workspace_id === workspaceId) || null;
}

function formatAdminDate(value, fallback = "Not set") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
}

function adminDetailRows(rows) {
  return `<dl class="admin-detail-list">${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`).join("")}</dl>`;
}

function showAdminDetails({ eyebrow, title, subtitle = "", body }) {
  $("#adminDetailsEyebrow").textContent = eyebrow;
  $("#adminDetailsDialogTitle").textContent = title;
  $("#adminDetailsSubtitle").textContent = subtitle;
  $("#adminDetailsBody").innerHTML = body;
  const dialog = $("#adminDetailsDialog");
  if (!dialog.open) dialog.showModal();
}

function openAdminUserDetails(profileId, emailValue = "") {
  const email = `${emailValue || ""}`.toLowerCase();
  const profile = state.adminProfiles.find((item) => item.id === profileId)
    || state.adminProfiles.find((item) => (item.email || "").toLowerCase() === email)
    || null;
  const head = state.heads.find((item) => item.user_id === profile?.id)
    || state.heads.find((item) => (item.email || "").toLowerCase() === (profile?.email || email).toLowerCase())
    || null;
  const ownerId = profile?.id || head?.user_id || null;
  const ownerEmail = profile?.email || head?.email || email || "Email unavailable";
  const monitors = state.adminSubscriptionMonitor.filter((row) =>
    row.owner_id === ownerId || (row.owner_email || "").toLowerCase() === ownerEmail.toLowerCase()
  );
  const ownedFamilyRows = monitors.filter((row) => row.workspace_type === "household");
  const workspaceIds = new Set(monitors.map((row) => row.workspace_id));
  const payments = state.adminSubscriptionPayments.filter((payment) => workspaceIds.has(payment.workspace_id));
  const fullName = profile?.full_name || head?.full_name || ownerEmail.split("@")[0] || "Mushavo user";
  const workspaceHtml = monitors.length
    ? monitors.map((row) => `<article class="admin-detail-card"><div><strong>${escapeHtml(row.workspace_name)}</strong><span>${escapeHtml(row.plan_name || "Plan not set")} &middot; ${titleCase(row.subscription_status || "not set")}</span>${row.workspace_type === "household" ? `<small>${Number(row.active_member_count || 0)} active + ${Number(row.pending_invitation_count || 0)} pending / ${Number(row.member_limit || 1)} paid places &middot; ${Number(row.available_member_count || 0)} available</small>` : ""}</div><button type="button" data-view-admin-workspace="${row.workspace_id}">View workspace</button></article>`).join("")
    : emptyState("No workspaces", "This user does not currently own a workspace visible to the subscription monitor.");
  const paymentsHtml = payments.length
    ? payments.slice(0, 10).map((payment) => `<article class="admin-detail-card"><div><strong>${money(payment.amount, payment.currency)}</strong><span>${titleCase(payment.status)} &middot; ${escapeHtml(payment.reference_number || "No reference")}</span><small>${formatAdminDate(payment.created_at)}</small></div><button type="button" data-view-subscription-payment="${payment.id}">View payment</button></article>`).join("")
    : emptyState("No subscription payments", "This user has no submitted subscription payments.");
  showAdminDetails({
    eyebrow: "User monitoring",
    title: fullName,
    subtitle: ownerEmail,
    body: `<section class="admin-detail-section"><h4>Account and access</h4>${adminDetailRows([
      ["Registered", escapeHtml(formatAdminDate(profile?.created_at, profile ? "Registered" : "Login not registered"))],
      ["Account status", statusBadge(head?.status || "free signup")],
      ["Family workspaces", `<strong>${ownedFamilyRows.length} / ${Number(head?.family_limit ?? 0)}</strong>`],
      ["Member management", statusBadge(head?.can_add_members ? "unlocked" : "locked")]
    ])}</section><section class="admin-detail-section"><h4>Workspaces and paid places</h4><div class="admin-detail-stack">${workspaceHtml}</div></section><section class="admin-detail-section"><h4>Subscription payments</h4><div class="admin-detail-stack">${paymentsHtml}</div></section>`
  });
}

function openAdminWorkspaceDetails(workspaceId) {
  const workspace = state.adminWorkspaces.find((item) => item.id === workspaceId);
  const monitor = adminMonitorForWorkspace(workspaceId);
  if (!workspace && !monitor) return;
  const familyId = workspace?.legacy_family_id || monitor?.family_id;
  const workspaceType = monitor?.workspace_type || workspace?.workspace_type || "personal";
  const owner = state.adminProfiles.find((profile) => profile.id === (workspace?.owner_id || monitor?.owner_id));
  const workspaceMembers = state.adminWorkspaceMembers.filter((member) => member.workspace_id === workspaceId);
  const familyMembers = state.adminMembers.filter((member) => member.family_id === familyId);
  const payments = state.adminSubscriptionPayments.filter((payment) => payment.workspace_id === workspaceId);
  const itemCount = state.adminPaymentItems.filter((item) =>
    item.status !== "inactive" && (item.workspace_id === workspaceId || (familyId && item.family_id === familyId))
  ).length;
  const membersHtml = workspaceMembers.length
    ? workspaceMembers.map((member) => {
      const profile = state.adminProfiles.find((item) => item.id === member.user_id);
      const name = profile?.full_name || profile?.email?.split("@")[0] || "Workspace member";
      const email = profile?.email || "Email unavailable";
      return `<article class="admin-detail-card"><div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(email)} &middot; ${escapeHtml(titleCase(member.role))}</span><small>Joined ${formatAdminDate(member.joined_at || member.created_at)}</small></div><div class="row-actions">${statusBadge(member.status)}<button type="button" data-view-admin-user="${member.user_id}" data-view-admin-user-email="${escapeHtml(email)}">View member</button></div></article>`;
    }).join("")
    : familyMembers.length
      ? familyMembers.map((member) => `<article class="admin-detail-card"><div><strong>${escapeHtml(member.name)}</strong><span>${escapeHtml(member.email || "No email")} &middot; ${escapeHtml(member.role)}</span></div><div class="row-actions">${statusBadge(member.status)}<button type="button" data-view-admin-user="${member.user_id || ""}" data-view-admin-user-email="${escapeHtml(member.email || "")}">View member</button></div></article>`).join("")
      : owner
        ? `<article class="admin-detail-card"><div><strong>${escapeHtml(owner.full_name || owner.email?.split("@")[0] || "Account owner")}</strong><span>${escapeHtml(owner.email || "Email unavailable")} &middot; Owner</span></div><div class="row-actions">${statusBadge("active")}<button type="button" data-view-admin-user="${owner.id}" data-view-admin-user-email="${escapeHtml(owner.email || "")}">View owner</button></div></article>`
        : emptyState("No member directory", "No account members are connected to this workspace.");
  const paymentsHtml = payments.length
    ? payments.map((payment) => `<article class="admin-detail-card"><div><strong>${money(payment.amount, payment.currency)}</strong><span>${titleCase(payment.status)} &middot; ${escapeHtml(payment.reference_number || "No reference")}</span></div><button type="button" data-view-subscription-payment="${payment.id}">View payment</button></article>`).join("")
    : emptyState("No subscription payments", "No subscription payments are connected to this workspace.");
  const subscriptionRows = [
    ["Plan", escapeHtml(monitor?.plan_name || "Not set")],
    ["Subscription status", statusBadge(monitor?.subscription_status || "not set")],
    ["Billing period", escapeHtml(titleCase(monitor?.billing_period || "not set"))],
    ["Paid through", escapeHtml(formatAdminDate(monitor?.paid_through_at))]
  ];
  if (workspaceType !== "personal") {
    subscriptionRows.push(
      ["Paid places", `<strong>${Number(monitor?.member_limit || 1)}</strong>`],
      ["Active members", `<strong>${Number(monitor?.active_member_count || 0)}</strong>`],
      ["Pending invitations", `<strong>${Number(monitor?.pending_invitation_count || 0)}</strong>`],
      ["Available places", `<strong>${Number(monitor?.available_member_count || 0)}</strong>`]
    );
  }
  showAdminDetails({
    eyebrow: "Workspace monitoring",
    title: monitor?.workspace_name || workspace?.name || "Workspace",
    subtitle: owner?.email || monitor?.owner_email || "Owner email unavailable",
    body: `<section class="admin-detail-section"><h4>Workspace account</h4>${adminDetailRows([
      ["Workspace type", escapeHtml(adminWorkspaceTypeLabel(workspaceType))],
      ["Workspace status", statusBadge(workspace?.status || "active")],
      ["Owner", escapeHtml(owner?.full_name || owner?.email || monitor?.owner_email || "Unavailable")],
      ["Active payment items", `<strong>${itemCount}</strong>`],
      ["Created", escapeHtml(formatAdminDate(workspace?.created_at))],
      ["Last updated", escapeHtml(formatAdminDate(workspace?.updated_at))]
    ])}</section><section class="admin-detail-section"><h4>Subscription${workspaceType === "personal" ? "" : " and capacity"}</h4>${adminDetailRows(subscriptionRows)}</section><section class="admin-detail-section"><h4>${workspaceType === "personal" ? "Account member" : "Members"}</h4><div class="admin-detail-stack">${membersHtml}</div></section><section class="admin-detail-section"><h4>Subscription payment history</h4><div class="admin-detail-stack">${paymentsHtml}</div></section>`
  });
}

function openAdminLegacyFamilyDetails(familyId) {
  const family = state.adminFamilies.find((item) => item.id === familyId);
  if (!family) return;
  const head = findHeadForFamily(family);
  const members = state.adminMembers.filter((member) => member.family_id === familyId);
  const itemCount = state.adminPaymentItems.filter((item) => item.family_id === familyId && item.status !== "inactive").length;
  const membersHtml = members.length
    ? members.map((member) => `<article class="admin-detail-card"><div><strong>${escapeHtml(member.name)}</strong><span>${escapeHtml(member.email || "No email")} &middot; ${escapeHtml(member.role)}</span></div><div class="row-actions">${statusBadge(member.status)}<button type="button" data-view-admin-user="${member.user_id || ""}" data-view-admin-user-email="${escapeHtml(member.email || "")}">View member</button></div></article>`).join("")
    : emptyState("No members", "No members are connected to this legacy family record.");
  showAdminDetails({
    eyebrow: "Legacy family record",
    title: family.name,
    subtitle: family.owner_email || "Owner email unavailable",
    body: `<section class="admin-detail-section"><h4>Workspace status</h4>${adminDetailRows([
      ["Record type", "Family awaiting workspace migration"],
      ["Owner", escapeHtml(head?.full_name || family.owner_email || "Unavailable")],
      ["Account status", statusBadge(head?.status || "not set")],
      ["Billing status", statusBadge(head?.billing_status || "not set")],
      ["Active payment items", `<strong>${itemCount}</strong>`],
      ["Created", escapeHtml(formatAdminDate(family.created_at))]
    ])}</section><section class="admin-detail-section"><h4>Members</h4><div class="admin-detail-stack">${membersHtml}</div></section>`
  });
}

function openSubscriptionPaymentDetails(paymentId) {
  const payment = state.adminSubscriptionPayments.find((item) => item.id === paymentId);
  if (!payment) return;
  const request = state.adminRenewalRequests.find((item) => item.id === payment.renewal_request_id);
  const invoice = state.adminSubscriptionInvoices.find((item) => item.id === request?.invoice_id);
  const workspace = state.adminWorkspaces.find((item) => item.id === payment.workspace_id);
  const owner = state.adminProfiles.find((profile) => profile.id === workspace?.owner_id);
  const proof = state.adminSubscriptionProofs.find((item) => item.payment_id === payment.id);
  const review = state.adminSubscriptionReviews.find((item) => item.payment_id === payment.id);
  const reviewer = state.adminProfiles.find((profile) => profile.id === review?.reviewer_id);
  showAdminDetails({
    eyebrow: "Subscription payment",
    title: invoice?.invoice_number || "Payment details",
    subtitle: `${workspace?.name || request?.requested_workspace_name || "Workspace"} · ${owner?.email || "Owner unavailable"}`,
    body: `<section class="admin-detail-section"><h4>Invoice</h4>${adminDetailRows([
      ["Plan", escapeHtml(invoice?.plan_name || "Not set")],
      ["Billing period", escapeHtml(titleCase(invoice?.billing_period || "not set"))],
      ["Base amount", invoice ? `<strong>${money(invoice.base_amount, invoice.currency)}</strong>` : "Not available"],
      ["Paid places", `<strong>${Number(invoice?.billable_member_count || 1)}</strong>`],
      ["Included places", `<strong>${Number(invoice?.included_member_count || 1)}</strong>`],
      ["Additional places", `<strong>${Number(invoice?.extra_member_count || 0)}</strong>`],
      ["Total", `<strong>${money(payment.amount, payment.currency)}</strong>`]
    ])}</section><section class="admin-detail-section"><h4>Payment and review</h4>${adminDetailRows([
      ["Status", statusBadge(payment.status)],
      ["Method", escapeHtml(payment.payment_method || "Not set")],
      ["Payment date", escapeHtml(formatAdminDate(payment.payment_date))],
      ["Reference", escapeHtml(payment.reference_number || "Not set")],
      ["Receipt", escapeHtml(payment.receipt_number || "Not issued")],
      ["Submitted", escapeHtml(formatAdminDate(payment.created_at))],
      ["Reviewed", escapeHtml(formatAdminDate(review?.created_at))],
      ["Reviewer", escapeHtml(reviewer?.email || review?.reviewer_id || "Not reviewed")],
      ["Decision reason", escapeHtml(review?.reason || request?.rejection_reason || "No reason recorded")]
    ])}${payment.notes ? `<p class="admin-detail-note"><strong>Notes</strong><span>${escapeHtml(payment.notes)}</span></p>` : ""}${proof ? `<div class="admin-detail-actions"><button type="button" data-open-subscription-proof="${proof.id}">View payment proof</button></div>` : ""}</section>`
  });
}

async function savePlanPrice(event) {
  event.preventDefault();
  const submitButton = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
  const currency = $("#planPriceCurrency").value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    showToast("Enter a three-letter ISO currency code, such as USD, ZAR, or ZWG.");
    return;
  }
  try {
    setSubmitting(submitButton, true, "Saving...");
    await query("plan price save", supabase.rpc("save_plan_price", {
      p_plan_code: $("#planPricePlan").value,
      p_billing_period: $("#planPricePeriod").value,
      p_currency: currency,
      p_amount: Number($("#planPriceAmount").value),
      p_extra_member_amount: Number($("#planPriceExtra").value || 0)
    }));
    $("#planPriceForm").reset();
    $("#planPriceCurrency").value = currency;
    $("#planPriceExtra").value = "0";
    await loadAdminData("plans");
    renderAdminPlans();
    showToast("Plan price published. Earlier invoices keep their original price snapshots.");
  } catch (error) {
    showToast(error.message);
  } finally {
    setSubmitting(submitButton, false, "Save active price");
  }
}

async function reviewSubscriptionPayment(paymentId, decision) {
  let reason = null;
  if (decision === "rejected") {
    reason = window.prompt("Reason shown to the workspace owner:");
    if (!reason?.trim()) return;
  }
  try {
    await query("subscription payment review", supabase.rpc("review_subscription_payment", {
      p_payment_id: paymentId,
      p_decision: decision,
      p_reason: reason
    }));
    await loadAdminData("finance");
    renderAdmin();
    showToast(decision === "approved"
      ? "Payment approved. Reports, subscription access, and purchased member places are now active."
      : "Payment rejected with the supplied reason.");
  } catch (error) {
    showToast(error.message);
  }
}

async function openSubscriptionProof(proofId) {
  const proof = state.adminSubscriptionProofs.find((item) => item.id === proofId);
  if (!proof) return;
  try {
    const signed = await query("subscription proof link", supabase.storage.from(SUBSCRIPTION_PROOF_BUCKET).createSignedUrl(proof.storage_path, 60));
    window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
  } catch (error) {
    showToast(error.message);
  }
}

function renderAdminTabs() {
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    if (button.dataset.adminTab === "plans") {
      button.classList.toggle("hidden", !["super_admin", "admin_staff"].includes(state.adminRole));
    }
    if (button.dataset.adminTab === "enquiries") {
      button.classList.toggle("hidden", !["super_admin", "admin_staff", "support_staff"].includes(state.adminRole));
    }
    button.classList.toggle("active", button.dataset.adminTab === state.adminTab);
  });
  document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.adminPanel !== state.adminTab);
  });
}

function renderAdminEnquiryBadge() {
  const badge = $("#adminEnquiryBadge");
  if (!badge) return;
  const count = state.adminEnquiries.filter((enquiry) => ["new", "in_progress"].includes(enquiry.status)).length;
  badge.textContent = String(count);
  badge.classList.toggle("hidden", count === 0);
}

function renderAdminSummary() {
  const occurrences = generateOccurrences(state.adminPaymentItems, state.adminPaymentRecords, state.filterMonth);
  $("#adminEmail").textContent = state.session.user.email || "-";
  $("#adminFamilyCount").textContent = state.adminWorkspaces.length;
  $("#adminOverdueCount").textContent = occurrences.filter((item) => item.status === "overdue").length;
  $("#adminDueTotal").textContent = formatOccurrenceCurrencyTotals(occurrences);
  const approvedSubscriptionPayments = state.adminSubscriptionPayments.filter((payment) => payment.status === "approved");
  $("#adminRevenueTotal").textContent = formatCurrencyTotals([...state.payments, ...approvedSubscriptionPayments]);
  $("#adminPaymentCount").textContent = `${state.payments.length + approvedSubscriptionPayments.length} payments`;
  renderAdminAttention(occurrences);
  renderRecentPlatformPayments();
}

function renderAdminAttention(occurrences) {
  const list = $("#adminAttentionList");
  const rows = state.adminFamilies.map((family) => {
    const familyOccurrences = occurrences.filter((occurrence) => occurrence.item.family_id === family.id);
    return {
      family,
      overdue: familyOccurrences.filter((occurrence) => occurrence.status === "overdue").length,
      partial: familyOccurrences.filter((occurrence) => occurrence.status === "partial").length,
      outstanding: familyOccurrences.reduce((sum, occurrence) => sum + occurrence.outstanding, 0)
    };
  }).filter((row) => row.overdue || row.partial);

  if (!rows.length) {
    list.innerHTML = emptyState("No urgent household issues", "Overdue and partially paid dues will appear here.");
    return;
  }
  list.innerHTML = "";
  rows.forEach((row) => {
    const article = document.createElement("article");
    article.className = "record-card";
    article.innerHTML = `
      <div class="record-main"><strong>${escapeHtml(row.family.name)}</strong><span>${escapeHtml(row.family.owner_email || "No owner email")} &middot; ${row.overdue} overdue &middot; ${row.partial} partial</span></div>
      <div class="record-side"><strong>${money(row.outstanding, row.family.currency)}</strong><button type="button" data-admin-open-family="${row.family.id}">Open</button></div>
    `;
    list.append(article);
  });
}

function adminWorkspaceTypeLabel(type) {
  if (type === "household") return "Family";
  return titleCase(type || "workspace");
}

function adminWorkspaceStatusKey(workspace, monitor, planCode) {
  if (workspace.status === "closed") return "closed";
  if (workspace.status === "suspended") return "suspended";
  if (monitor?.subscription_status === "suspended") return "suspended";
  if (monitor?.subscription_status === "expired") return "expired";
  if (planCode === "free") return "free";
  if (monitor?.subscription_status === "active") return "active";
  return "unconfigured";
}

function adminWorkspaceDirectoryRows() {
  const ownerWorkspaceCounts = new Map();
  state.adminWorkspaces.forEach((workspace) => {
    ownerWorkspaceCounts.set(workspace.owner_id, (ownerWorkspaceCounts.get(workspace.owner_id) || 0) + 1);
  });

  const rows = state.adminWorkspaces.map((workspace) => {
    const monitor = adminMonitorForWorkspace(workspace.id);
    const subscription = state.adminSubscriptions.find((item) => item.workspace_id === workspace.id);
    const plan = state.adminPlans.find((item) => item.id === subscription?.plan_id);
    const owner = state.adminProfiles.find((profile) => profile.id === workspace.owner_id);
    const family = state.adminFamilies.find((item) => item.id === workspace.legacy_family_id);
    const type = workspace.workspace_type || monitor?.workspace_type || "personal";
    const planCode = monitor?.plan_code || plan?.code || (type === "personal" ? "free" : "unconfigured");
    const planName = monitor?.plan_name || plan?.display_name || (type === "personal" ? "Free" : "Plan not set");
    const memberLimit = Math.max(1, Number(monitor?.member_limit || 1));
    const activeMembers = Number(monitor?.active_member_count || 0);
    const pendingInvitations = Number(monitor?.pending_invitation_count || 0);
    const usedMembers = Number(monitor?.used_member_count ?? activeMembers + pendingInvitations);
    const itemCount = state.adminPaymentItems.filter((item) =>
      item.status !== "inactive" && (item.workspace_id === workspace.id || (family && item.family_id === family.id))
    ).length;
    const ownerName = owner?.full_name || family?.owner_name || owner?.email?.split("@")[0] || "Account owner";
    const ownerEmail = owner?.email || family?.owner_email || monitor?.owner_email || "Email unavailable";
    return {
      workspace,
      monitor,
      family,
      id: workspace.id,
      type,
      typeLabel: adminWorkspaceTypeLabel(type),
      name: workspace.name,
      ownerId: workspace.owner_id,
      ownerName,
      ownerEmail,
      ownerWorkspaceCount: ownerWorkspaceCounts.get(workspace.owner_id) || 1,
      planCode,
      planName,
      subscriptionStatus: monitor?.subscription_status || subscription?.status || "not set",
      statusKey: adminWorkspaceStatusKey(workspace, monitor, planCode),
      billingPeriod: monitor?.billing_period || subscription?.billing_period,
      paidThroughAt: monitor?.paid_through_at || subscription?.paid_through_at,
      memberLimit,
      activeMembers,
      pendingInvitations,
      usedMembers,
      itemCount,
      createdAt: workspace.created_at
    };
  });

  const mappedFamilyIds = new Set(state.adminWorkspaces.map((workspace) => workspace.legacy_family_id).filter(Boolean));
  state.adminFamilies.filter((family) => !mappedFamilyIds.has(family.id)).forEach((family) => {
    const head = findHeadForFamily(family);
    const memberCount = state.adminMembers.filter((member) => member.family_id === family.id && member.status !== "inactive").length;
    rows.push({
      workspace: { status: head?.status === "suspended" ? "suspended" : "active" },
      monitor: null,
      family,
      id: null,
      type: "household",
      typeLabel: "Family",
      name: family.name,
      ownerId: family.owner_id,
      ownerName: head?.full_name || family.owner_email?.split("@")[0] || "Account owner",
      ownerEmail: family.owner_email || head?.email || "Email unavailable",
      ownerWorkspaceCount: state.adminFamilies.filter((item) => item.owner_id === family.owner_id).length || 1,
      planCode: "legacy",
      planName: head?.billing_status || "Legacy family",
      subscriptionStatus: head?.status || "not set",
      statusKey: head?.status === "suspended" ? "suspended" : "unconfigured",
      billingPeriod: null,
      paidThroughAt: null,
      memberLimit: Math.max(1, memberCount),
      activeMembers: memberCount,
      pendingInvitations: 0,
      usedMembers: memberCount,
      itemCount: state.adminPaymentItems.filter((item) => item.family_id === family.id && item.status !== "inactive").length,
      createdAt: family.created_at
    });
  });
  return rows;
}

function renderAdminWorkspaceSummary(rows) {
  $("#adminWorkspaceTotal").textContent = rows.length;
  $("#adminWorkspacePersonal").textContent = rows.filter((row) => row.type === "personal").length;
  $("#adminWorkspaceFamily").textContent = rows.filter((row) => row.type === "household").length;
  $("#adminWorkspaceBusiness").textContent = rows.filter((row) => row.type === "business").length;
  $("#adminWorkspacePaid").textContent = rows.filter((row) =>
    row.statusKey === "active" && !["free", "unconfigured", "legacy"].includes(row.planCode)
  ).length;
}

function syncAdminWorkspacePlanFilter(rows) {
  const select = $("#adminWorkspacePlanFilter");
  const previousValue = select.value || "all";
  const plans = [...new Map(rows.map((row) => [row.planCode, row.planName])).entries()]
    .filter(([code]) => code && code !== "unconfigured")
    .sort((left, right) => left[1].localeCompare(right[1]));
  select.innerHTML = '<option value="all">All plans</option>';
  plans.forEach(([code, name]) => select.append(new Option(name, code)));
  select.value = plans.some(([code]) => code === previousValue) ? previousValue : "all";
}

function renderAdminFamilies() {
  const list = $("#adminFamiliesList");
  const allRows = adminWorkspaceDirectoryRows();
  renderAdminWorkspaceSummary(allRows);
  syncAdminWorkspacePlanFilter(allRows);

  const search = ($("#adminHouseholdSearch").value || "").trim().toLowerCase();
  const typeFilter = $("#adminWorkspaceTypeFilter").value;
  const statusFilter = $("#adminWorkspaceStatusFilter").value;
  const planFilter = $("#adminWorkspacePlanFilter").value;
  const sort = $("#adminWorkspaceSort").value;
  const rows = allRows.filter((row) => {
    const searchText = `${row.name} ${row.typeLabel} ${row.ownerName} ${row.ownerEmail} ${row.planName} ${row.planCode}`.toLowerCase();
    return (!search || searchText.includes(search))
      && (typeFilter === "all" || row.type === typeFilter)
      && (statusFilter === "all" || row.statusKey === statusFilter)
      && (planFilter === "all" || row.planCode === planFilter);
  });

  rows.sort((left, right) => {
    if (sort === "oldest") return new Date(left.createdAt || 0) - new Date(right.createdAt || 0);
    if (sort === "name") return left.name.localeCompare(right.name);
    if (sort === "owner") return left.ownerName.localeCompare(right.ownerName);
    if (sort === "type") return left.typeLabel.localeCompare(right.typeLabel) || left.name.localeCompare(right.name);
    return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
  });

  $("#adminWorkspaceDirectoryMeta").textContent = rows.length === allRows.length
    ? `${allRows.length} ${allRows.length === 1 ? "workspace" : "workspaces"}`
    : `${rows.length} of ${allRows.length} workspaces`;

  if (!rows.length) {
    list.innerHTML = emptyState("No matching workspaces", "Change or reset the directory filters to see more results.");
    return;
  }

  list.innerHTML = rows.map((row) => {
    const isShared = row.type !== "personal";
    const usagePercent = isShared ? Math.min(100, Math.round((row.usedMembers / row.memberLimit) * 100)) : 0;
    const workspaceStatus = row.workspace.status || "active";
    const planStatus = row.statusKey === "free" ? "free" : row.subscriptionStatus;
    const billingCopy = row.billingPeriod
      ? `${titleCase(row.billingPeriod)} billing${row.paidThroughAt ? ` &middot; Paid through ${new Date(row.paidThroughAt).toLocaleDateString()}` : ""}`
      : row.statusKey === "free" ? "No paid subscription required" : "Billing not configured";
    const typeInitial = row.type === "personal" ? "P" : row.type === "household" ? "F" : "B";
    const ownerWorkspaceCopy = `${row.ownerWorkspaceCount} ${row.ownerWorkspaceCount === 1 ? "workspace" : "workspaces"} on this account`;
    const usageHtml = isShared
      ? `<strong>${row.usedMembers} of ${row.memberLimit} places used</strong><small>${row.activeMembers} active${row.pendingInvitations ? ` &middot; ${row.pendingInvitations} pending` : ""}</small><div class="admin-workspace-meter" aria-label="${usagePercent}% of paid places used"><span style="width:${usagePercent}%"></span></div>`
      : `<strong>${row.itemCount} active ${row.itemCount === 1 ? "payment" : "payments"}</strong><small>Personal workspace usage</small>`;
    const action = row.id
      ? `<button type="button" data-view-admin-workspace="${row.id}">View details</button>`
      : `<button type="button" data-view-admin-legacy-family="${row.family.id}">View details</button>`;
    return `<article class="admin-workspace-row workspace-type-${row.type}">
      <div class="admin-workspace-identity">
        <span class="admin-workspace-type-mark" aria-hidden="true">${typeInitial}</span>
        <div><span class="admin-workspace-field-label">${escapeHtml(row.typeLabel)} workspace</span><strong>${escapeHtml(row.name)}</strong><div class="badge-row">${statusBadge(workspaceStatus)}${statusBadge(planStatus)}</div></div>
      </div>
      <div class="admin-workspace-owner">
        <span class="admin-workspace-field-label">Owner</span>
        <strong>${escapeHtml(row.ownerName)}</strong>
        <small>${escapeHtml(row.ownerEmail)}</small>
        <small>${escapeHtml(ownerWorkspaceCopy)}</small>
      </div>
      <div class="admin-workspace-plan">
        <span class="admin-workspace-field-label">Plan</span>
        <strong>${escapeHtml(row.planName)}</strong>
        <small>${billingCopy}</small>
      </div>
      <div class="admin-workspace-usage">
        <span class="admin-workspace-field-label">Usage</span>
        ${usageHtml}
      </div>
      <div class="admin-workspace-row-action">
        <small>Created ${row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "date unavailable"}</small>
        ${action}
      </div>
    </article>`;
  }).join("");
}

function renderHeads() {
  const list = $("#headsList");
  const directoryUsers = adminDirectoryUsers();
  $("#adminUserDirectoryMeta").textContent = `${directoryUsers.length} total · ${state.adminProfiles.length} registered`;
  if (!directoryUsers.length) {
    list.innerHTML = emptyState("No users yet", "Registered accounts and users added by an administrator will appear here.");
    return;
  }
  list.innerHTML = "";
  directoryUsers.forEach(({ profile, head, fullName, email }) => {
    const ownedCount = state.adminFamilies.filter((family) =>
      (family.owner_email || "").toLowerCase() === email.toLowerCase()
    ).length;
    const ownedWorkspaces = profile ? state.adminWorkspaces.filter((workspace) => workspace.owner_id === profile.id) : [];
    const joinedWorkspaceIds = new Set(profile ? state.adminWorkspaceMembers.filter((member) => member.user_id === profile.id && member.status === "active").map((member) => member.workspace_id) : []);
    const joinedCount = state.adminWorkspaces.filter((workspace) => joinedWorkspaceIds.has(workspace.id) && workspace.owner_id !== profile?.id).length;
    const planNames = ownedWorkspaces.map((workspace) => {
      const subscription = state.adminSubscriptions.find((item) => item.workspace_id === workspace.id);
      const plan = state.adminPlans.find((item) => item.id === subscription?.plan_id);
      return `${workspace.name}: ${plan?.display_name || "Not set"}`;
    });
    const ownedMonitors = state.adminSubscriptionMonitor.filter((row) =>
      row.owner_id === profile?.id || (row.owner_email || "").toLowerCase() === email.toLowerCase()
    );
    const familySeatUsage = ownedMonitors
      .filter((row) => row.workspace_type === "household")
      .reduce((totals, row) => ({ used: totals.used + Number(row.used_member_count || 0), limit: totals.limit + Number(row.member_limit || 0) }), { used: 0, limit: 0 });
    const article = document.createElement("article");
    article.className = "record-card";
    article.innerHTML = `
      <div class="record-main">
        <strong>${escapeHtml(fullName)}</strong>
        <span>${escapeHtml(email)}${profile?.created_at ? ` &middot; registered ${new Date(profile.created_at).toLocaleDateString()}` : " &middot; login not registered yet"}</span>
        ${profile ? `<small>${ownedWorkspaces.length} owned workspace${ownedWorkspaces.length === 1 ? "" : "s"} &middot; ${joinedCount} joined${planNames.length ? ` &middot; ${escapeHtml(planNames.join("; "))}` : ""}</small>` : ""}
        <div class="badge-row">
          ${statusBadge(profile ? "registered" : "not registered")}
          ${statusBadge(head?.status || "free signup")}
          ${head ? statusBadge(head.can_add_members ? "members unlocked" : "members locked") : ""}
          <span class="mini-badge">${ownedCount}/${Number(head?.family_limit ?? 0)} families</span>
          ${familySeatUsage.limit ? `<span class="mini-badge">${familySeatUsage.used}/${familySeatUsage.limit} family places</span>` : ""}
        </div>
      </div>
      <div class="record-side">
        <button type="button" data-view-admin-user="${profile?.id || ""}" data-view-admin-user-email="${escapeHtml(email)}">View details</button>
        ${head ? `<div class="row-actions">
          <label class="inline-number-control">Family limit<input data-family-limit-input="${head.id}" type="number" min="0" max="100" step="1" value="${Number(head.family_limit ?? 1)}" /></label>
          <button type="button" data-save-family-limit="${head.id}">Save limit</button>
          <button type="button" data-toggle-member-access="${head.id}" data-next-member-access="${head.can_add_members ? "false" : "true"}">${head.can_add_members ? "Lock members" : "Unlock members"}</button>
          <button type="button" data-toggle-head="${head.id}" data-next-status="${head.status === "active" ? "suspended" : "active"}">${head.status === "active" ? "Suspend" : "Reactivate"}</button>
          <button type="button" data-delete-head="${head.id}">Revoke access</button>
        </div>` : `<button type="button" data-configure-profile="${profile.id}">Configure access</button>`}
      </div>
    `;
    list.append(article);
  });
}

function adminDirectoryUsers() {
  const headsByUserId = new Map(
    state.heads.filter((head) => head.user_id).map((head) => [head.user_id, head])
  );
  const headsByEmail = new Map(
    state.heads.map((head) => [(head.email || "").toLowerCase(), head])
  );
  const includedHeadIds = new Set();
  const rows = state.adminProfiles.map((profile) => {
    const email = (profile.email || "").toLowerCase();
    const head = headsByUserId.get(profile.id) || headsByEmail.get(email) || null;
    if (head) includedHeadIds.add(head.id);
    return {
      profile,
      head,
      fullName: profile.full_name || head?.full_name || email.split("@")[0] || "Mushavo user",
      email,
      createdAt: profile.created_at
    };
  });

  state.heads
    .filter((head) => !includedHeadIds.has(head.id))
    .forEach((head) => rows.push({
      profile: null,
      head,
      fullName: head.full_name,
      email: (head.email || "").toLowerCase(),
      createdAt: head.created_at
    }));

  return rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function renderPaymentHeadOptions() {
  const select = $("#paymentHead");
  select.innerHTML = `<option value="">Choose user</option>`;
  state.heads.forEach((head) => {
    const option = document.createElement("option");
    option.value = head.id;
    option.textContent = `${head.full_name} - ${head.email}`;
    option.dataset.amount = head.monthly_fee || 0;
    option.dataset.currency = head.fee_currency || "USD";
    select.append(option);
  });
}

function renderRecentPlatformPayments() {
  const list = $("#recentPaymentsList");
  const recent = state.payments.slice(0, 5);
  if (!recent.length) {
    list.innerHTML = emptyState("No platform payments", "Record subscription payments in Finance.");
    return;
  }
  list.innerHTML = "";
  recent.forEach((payment) => list.append(renderPlatformPayment(payment)));
}

function renderPlatformPayments() {
  const list = $("#paymentsList");
  const payments = state.payments.filter((payment) => adminFinanceRecordVisible(payment, "platform_payment"));
  if (!payments.length) {
    list.innerHTML = emptyState("No legacy payment notes", "New subscription payments are submitted by workspace owners and reviewed above.");
    return;
  }
  list.innerHTML = "";
  payments.forEach((payment) => list.append(renderPlatformPayment(payment, true)));
}

function renderPlatformPayment(payment, withActions = false) {
  const article = document.createElement("article");
  const locked = lockedConversionFor("platform_payment", payment.id, adminReportingCurrency());
  article.className = "record-card";
  article.innerHTML = `
    <div class="date-chip"><strong>${parseDate(payment.payment_date).getDate()}</strong><span>${parseDate(payment.payment_date).toLocaleString("en", { month: "short" })}</span></div>
    <div class="record-main"><strong>${escapeHtml(payment.family_heads?.full_name || "Unknown user")}</strong><span>${escapeHtml(payment.family_heads?.email || "")} &middot; ${escapeHtml(payment.payment_method)} &middot; ${escapeHtml(payment.reference_number || "No reference")}</span></div>
    <div class="record-side"><strong>${money(payment.amount, payment.currency)}</strong>${locked ? `<small>${money(locked.converted_amount, locked.reporting_currency)} locked</small>` : ""}${withActions ? `<div class="row-actions">${!locked ? `<button type="button" data-manual-conversion="${payment.id}" data-conversion-entity="platform_payment">Enter manual rate</button>` : ""}<button type="button" data-delete-payment="${payment.id}">Delete</button></div>` : ""}</div>
  `;
  return article;
}

function renderAdminNoteOptions() {
  const select = $("#adminNoteFamily");
  select.innerHTML = `<option value="">Choose household</option>`;
  state.adminFamilies.forEach((family) => {
    const option = document.createElement("option");
    option.value = family.id;
    option.textContent = `${family.name} - ${family.owner_email || "No email"}`;
    select.append(option);
  });
}

function renderAdminNotes() {
  const list = $("#adminNotesList");
  if (!state.adminNotes.length) {
    list.innerHTML = emptyState("No support notes", "Notes about access, payments, or reminder issues will appear here.");
    return;
  }
  list.innerHTML = "";
  state.adminNotes.forEach((note) => {
    const family = state.adminFamilies.find((item) => item.id === note.family_id);
    const article = document.createElement("article");
    article.className = "record-card";
    article.innerHTML = `
      <div class="record-main"><strong>${escapeHtml(family?.name || "Household")}</strong><span>${new Date(note.created_at).toLocaleString()}</span><small>${escapeHtml(note.note)}</small></div>
      <div class="record-side"><button type="button" data-delete-admin-note="${note.id}">Delete</button></div>
    `;
    list.append(article);
  });
}

function enquiryLabel(value) {
  const labels = {
    subscription_renewal: "Subscription renewal", setup_help: "Setup help",
    country_availability: "Country availability", in_progress: "In progress"
  };
  return labels[value] || titleCase(value);
}

function syncAdminEnquiryCountryFilter() {
  const field = $("#adminEnquiryCountry");
  if (!field) return;
  const selected = field.value || "all";
  const countries = [...new Set(state.adminEnquiries.map((item) => item.country_name).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
  field.innerHTML = '<option value="all">All countries</option>' + countries
    .map((country) => `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`).join("");
  field.value = countries.includes(selected) ? selected : "all";
}

function filteredAdminEnquiries() {
  const search = ($("#adminEnquirySearch")?.value || "").trim().toLowerCase();
  const status = $("#adminEnquiryStatus")?.value || "all";
  const country = $("#adminEnquiryCountry")?.value || "all";
  return state.adminEnquiries.filter((enquiry) => {
    const haystack = `${enquiry.full_name} ${enquiry.email} ${enquiry.message}`.toLowerCase();
    return (!search || haystack.includes(search))
      && (status === "all" || enquiry.status === status)
      && (country === "all" || enquiry.country_name === country);
  });
}

function renderAdminEnquiries() {
  $("#adminEnquiryNew").textContent = String(state.adminEnquiries.filter((item) => item.status === "new").length);
  $("#adminEnquiryProgress").textContent = String(state.adminEnquiries.filter((item) => item.status === "in_progress").length);
  $("#adminEnquiryResolved").textContent = String(state.adminEnquiries.filter((item) => item.status === "resolved").length);
  $("#adminEnquiryArchived").textContent = String(state.adminEnquiries.filter((item) => item.status === "archived").length);
  renderAdminEnquiryBadge();
  syncAdminEnquiryCountryFilter();
  const rows = filteredAdminEnquiries();
  $("#adminEnquiryMeta").textContent = `${rows.length} of ${state.adminEnquiries.length} enquiries`;
  const list = $("#adminEnquiryList");
  if (!rows.length) {
    list.innerHTML = emptyState("No matching enquiries", "New messages from the public Contact page will appear here.");
    return;
  }
  list.innerHTML = "";
  rows.forEach((enquiry) => {
    const article = document.createElement("article");
    article.className = "record-card enquiry-card";
    const replySubject = encodeURIComponent(`Mushavo Budget ${enquiryLabel(enquiry.enquiry_type)} enquiry`);
    const safeMessage = escapeHtml(enquiry.message).replace(/\n/g, "<br />");
    article.innerHTML = `
      <div class="record-main">
        <div class="badge-row"><span class="mini-badge ${badgeClass(enquiry.status)}">${escapeHtml(enquiryLabel(enquiry.status))}</span><span class="mini-badge">${escapeHtml(enquiryLabel(enquiry.enquiry_type))}</span></div>
        <strong>${escapeHtml(enquiry.full_name)}</strong>
        <a class="enquiry-email" href="mailto:${encodeURIComponent(enquiry.email)}?subject=${replySubject}">${escapeHtml(enquiry.email)}</a>
        <span>${escapeHtml(enquiry.country_name || "Country not provided")}</span>
        <p class="enquiry-message">${safeMessage}</p>
        <small>Submitted ${escapeHtml(formatAdminDate(enquiry.created_at))}</small>
      </div>
      <div class="record-side enquiry-actions">
        <div class="enquiry-status-actions" aria-label="Update enquiry status">
          ${[["new", "Mark New"], ["in_progress", "In Progress"], ["resolved", "Resolved"], ["archived", "Archive"]].map(([value, label]) => `<button type="button" data-enquiry-status="${enquiry.id}" data-status="${value}"${enquiry.status === value ? ' class="active" disabled aria-current="true"' : ""}>${label}</button>`).join("")}
        </div>
        <a class="button-link" href="mailto:${encodeURIComponent(enquiry.email)}?subject=${replySubject}">Reply by email</a>
      </div>`;
    article.querySelectorAll("[data-enquiry-status]").forEach((button) => button.addEventListener("click", () => updateEnquiry(enquiry.id, { status: button.dataset.status })));
    list.append(article);
  });
}

async function updateEnquiry(enquiryId, changes) {
  try {
    await query("enquiry update", supabase.from("enquiries").update(changes).eq("id", enquiryId));
    await loadAdminData("enquiries");
    renderAdminEnquiries();
    showToast("Enquiry updated.");
  } catch (error) {
    showToast(friendlyMessage(error.message));
  }
}

async function signIn(event) {
  event.preventDefault();
  assertSupabase();
  const email = $("#email").value.trim();
  const password = $("#password").value;
  if (!email || !password) {
    showToast("Enter an email and password.");
    return;
  }
  const submitButton = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Signing in...";
    }
    showLoading("Signing you in", "Verifying your account...");
    const authData = await query("sign in", supabase.auth.signInWithPassword({ email, password }));
    if (!authData.session) throw new Error("Sign-in completed without a session. Please try again.");
    await openAuthenticatedSession(authData.session);
    showToast("Signed in.");
  } catch (error) {
    setView("auth");
    showToast(error.message);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Sign in";
    }
  }
}

async function createFamily(event) {
  event.preventDefault();
  assertSupabase();
  const name = $("#familyName").value.trim();
  if (!name) return;
  try {
    const created = await createFamilyWorkspace(
      name,
      $("#familyBudget").value,
      $("#familyCurrency").value
    );
    if (!created) return;
    await loadApp();
    showToast("Household created.");
  } catch (error) {
    showToast(error.message);
  }
}

async function createFamilyFromMembers(event) {
  event.preventDefault();
  assertSupabase();
  const name = $("#memberFamilyName").value.trim();
  if (!name) return;
  try {
    const created = await createFamilyWorkspace(
      name,
      $("#memberFamilyBudget").value,
      $("#memberFamilyCurrency").value
    );
    if (!created) return;
    $("#memberFamilyForm").reset();
    await loadApp();
    showToast("Family created.");
  } catch (error) {
    showToast(error.message);
  }
}

function openFamilyNameDialog() {
  if (!state.family || state.family.owner_id !== state.session?.user?.id) {
    showToast("Only the Family Head can edit the family name.");
    return;
  }
  $("#editableFamilyName").value = state.family.name || "";
  const dialog = $("#familyNameDialog");
  if (!dialog.open) dialog.showModal();
  window.setTimeout(() => $("#editableFamilyName").focus(), 0);
}

async function saveFamilyName(event) {
  event.preventDefault();
  const familyName = $("#editableFamilyName").value.trim();
  const submitButton = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
  if (!state.family || state.family.owner_id !== state.session?.user?.id) {
    showToast("Only the Family Head can edit the family name.");
    return;
  }
  if (!familyName) {
    showToast("Enter a family name.");
    return;
  }
  try {
    setSubmitting(submitButton, true, "Saving...");
    await query("family name update", supabase.from("families").update({ name: familyName }).eq("id", state.family.id));
    $("#familyNameDialog").close();
    await Promise.all([loadFamily(), loadWorkspaceSubscriptionData()]);
    await loadFamilyData();
    renderFamilyApp();
    showToast("Family name updated.");
  } catch (error) {
    showToast(error.message);
  } finally {
    setSubmitting(submitButton, false, "Save family name");
  }
}

async function saveObligation(event) {
  event.preventDefault();
  assertSupabase();
  const amount = Number($("#obligationAmount").value);
  const scope = $("#paymentScope").value;
  if (!amount || amount <= 0) {
    showToast("Enter an amount due above zero.");
    return;
  }
  if (scope === "family" && !state.family) {
    showToast("Create or join a family before saving a family payment.");
    return;
  }
  const editingItem = state.paymentItems.find((item) => item.id === state.editingObligationId);
  const usesNewPersonalSlot = scope === "personal" && (
    !editingItem || editingItem.visibility !== "personal" || editingItem.status === "inactive"
  );
  if (!hasPaidPlan() && usesNewPersonalSlot && userCreatedPersonalPaymentCount() >= 5) {
    showToast("Free accounts can keep up to 5 active personal payments. Family payments remain unlimited.");
    return;
  }
  const payload = {
    family_id: scope === "family" ? state.family.id : null,
    owner_id: state.session.user.id,
    visibility: scope,
    name: $("#obligationName").value.trim(),
    category: $("#obligationCategory").value,
    amount,
    currency: $("#obligationCurrency").value,
    responsible_member_id: scope === "family" ? $("#obligationMember").value || null : null,
    recurrence_type: $("#recurrenceType").value,
    recurrence_interval: Number($("#recurrenceInterval").value || 1),
    due_day: Number($("#dueDay").value || 1),
    start_date: $("#startDate").value,
    reminder_days_before: Number($("#reminderDays").value || 0),
    notes: $("#obligationNotes").value.trim() || null,
    status: "active",
    created_by: state.session.user.id
  };
  if (!payload.name) {
    showToast("Enter a payment name.");
    return;
  }
  try {
    if (state.editingObligationId) {
      await query("payment item update", supabase.from("payment_items").update(payload).eq("id", state.editingObligationId));
      showToast("Payment updated.");
    } else {
      await query("payment item create", supabase.from("payment_items").insert(payload));
      showToast("Payment saved.");
    }
    $("#paymentItemDialog").close();
    resetObligationForm();
    await loadFamilyData();
    await loadWorkspaceSubscriptionData();
    renderFamilyApp();
  } catch (error) {
    showToast(error.message);
  }
}

function openPaymentItemDialog() {
  if (state.workspaceEntitlement?.read_only || state.workspaceEntitlement?.effective_status === "suspended") {
    showToast("This shared workspace is read-only. The owner must renew it before payments can be changed.");
    return;
  }
  resetObligationForm();
  const dialog = $("#paymentItemDialog");
  if (!dialog.open) dialog.showModal();
  window.setTimeout(() => $("#obligationName").focus(), 0);
}

function startEditObligation(itemId) {
  const item = state.paymentItems.find((paymentItem) => paymentItem.id === itemId);
  if (!item) return;
  state.editingObligationId = item.id;
  state.familyTab = "payments";
  setRoute("family", "payments");
  renderFamilyApp();
  $("#obligationTitle").textContent = "Edit payment";
  $("#obligationSubmitButton").textContent = "Save changes";
  $("#obligationName").value = item.name;
  $("#obligationAmount").value = item.amount;
  $("#obligationCurrencySearch").value = "";
  renderPaymentCurrencyOptions("", item.currency);
  $("#paymentScope").value = item.visibility || (item.family_id ? "family" : "personal");
  $("#obligationCategory").value = item.category;
  $("#obligationMember").value = item.responsible_member_id || "";
  $("#recurrenceType").value = item.recurrence_type;
  $("#recurrenceInterval").value = item.recurrence_interval || 1;
  $("#dueDay").value = item.due_day || 1;
  $("#startDate").value = item.start_date;
  $("#reminderDays").value = item.reminder_days_before || 0;
  $("#obligationNotes").value = item.notes || "";
  const dialog = $("#paymentItemDialog");
  if (!dialog.open) dialog.showModal();
}

function resetObligationForm() {
  state.editingObligationId = null;
  $("#obligationForm").reset();
  $("#startDate").value = toDateValue(new Date());
  $("#recurrenceInterval").value = 1;
  $("#dueDay").value = 1;
  $("#reminderDays").value = 3;
  $("#obligationCurrencySearch").value = "";
  renderPaymentCurrencyOptions("", state.workspaceSettings?.default_payment_currency || state.family?.currency || "USD");
  $("#paymentScope").value = state.family ? "family" : "personal";
  $("#obligationTitle").textContent = "Add payment";
  $("#obligationSubmitButton").textContent = "Add payment";
  renderPaymentScope();
}

function hasPaidPlan() {
  return Boolean(
    state.workspaceEntitlement &&
    state.workspaceEntitlement.plan_code !== "free" &&
    state.workspaceEntitlement.effective_status === "active" &&
    !state.workspaceEntitlement.read_only
  );
}

function userCreatedPersonalPaymentCount() {
  const userId = state.session?.user?.id;
  return state.paymentItems.filter((item) =>
    item.created_by === userId &&
    item.visibility === "personal" &&
    item.status !== "inactive"
  ).length;
}

function openRecordPayment(key) {
  if (state.workspaceEntitlement?.read_only || state.workspaceEntitlement?.effective_status === "suspended") {
    showToast("This shared workspace is read-only. The owner must renew it before payments can be recorded.");
    return;
  }
  const periodStart = key.slice(key.lastIndexOf(":") + 1);
  const occurrences = generateOccurrences(state.paymentItems, state.paymentRecords, periodStart.slice(0, 7));
  const occurrence = occurrences.find((item) => item.key === key);
  if (!occurrence) return;
  $("#recordItemId").value = occurrence.item.id;
  $("#recordPeriodStart").value = occurrence.periodStart;
  $("#recordDueDate").value = occurrence.dueDate;
  $("#recordPaymentTitle").textContent = `Record ${occurrence.item.name}`;
  $("#recordPaymentMeta").textContent = `${money(occurrence.outstanding, occurrence.item.currency)} outstanding, due ${occurrence.dueDate}`;
  $("#recordOutstanding").value = occurrence.outstanding.toFixed(2);
  $("#recordCurrency").value = occurrence.item.currency;
  $("#recordPaymentType").value = "full";
  $("#recordAmount").value = occurrence.outstanding.toFixed(2);
  $("#recordAmount").max = occurrence.outstanding.toFixed(2);
  $("#recordAmount").readOnly = true;
  $("#recordPaidBy").value = occurrence.item.responsible_member_id || "";
  $("#recordPaymentDate").value = toDateValue(new Date());
  $("#recordReference").value = "";
  $("#recordNotes").value = "";
  $("#recordProof").value = "";
  $("#recordPaymentDialog").showModal();
}

async function savePaymentRecord(event) {
  event.preventDefault();
  const item = state.paymentItems.find((paymentItem) => paymentItem.id === $("#recordItemId").value);
  const amount = Number($("#recordAmount").value || 0);
  const outstanding = Number($("#recordOutstanding").value || 0);
  const proofFile = $("#recordProof").files?.[0] || null;
  if (!item || amount <= 0) {
    showToast("Choose a payment and enter an amount.");
    return;
  }
  if (amount > outstanding + 0.005) {
    showToast(`The payment cannot be more than the ${money(outstanding, item.currency)} outstanding balance.`);
    return;
  }
  if (proofFile && !PAYMENT_PROOF_TYPES.has(proofFile.type)) {
    showToast("Proof must be a JPG, PNG, WebP, or PDF file.");
    return;
  }
  if (proofFile && proofFile.size > PAYMENT_PROOF_MAX_BYTES) {
    showToast("Proof of payment must be 10 MB or smaller.");
    return;
  }

  let uploadedProof = null;
  try {
    if (proofFile) uploadedProof = await uploadPaymentProof(item, proofFile);
    await query(
      "payment record create",
      supabase.from("payment_records").insert({
        family_id: item.family_id || null,
        owner_id: state.session.user.id,
        visibility: item.visibility || (item.family_id ? "family" : "personal"),
        payment_item_id: item.id,
        period_start: $("#recordPeriodStart").value,
        due_date: $("#recordDueDate").value,
        paid_by_member_id: item.visibility === "family" ? $("#recordPaidBy").value || null : null,
        amount,
        currency: item.currency,
        payment_date: $("#recordPaymentDate").value,
        payment_method: $("#recordMethod").value,
        reference_number: $("#recordReference").value.trim() || null,
        notes: $("#recordNotes").value.trim() || null,
        proof_path: uploadedProof?.path || null,
        proof_name: uploadedProof?.name || null,
        proof_mime_type: uploadedProof?.type || null,
        proof_size_bytes: uploadedProof?.size || null,
        recorded_by: state.session.user.id
      })
    );
    $("#recordPaymentDialog").close();
    $("#recordPaymentForm").reset();
    await loadPaymentRecords();
    renderFamilyApp();
    showToast(amount + 0.005 >= outstanding ? "Payment recorded as paid in full." : "Partial payment recorded.");
  } catch (error) {
    if (uploadedProof?.path) {
      await supabase.storage.from(PAYMENT_PROOF_BUCKET).remove([uploadedProof.path]).catch(() => {});
    }
    showToast(error.message);
  }
}

async function uploadPaymentProof(item, file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "receipt";
  const userId = state.session.user.id;
  const path = item.visibility === "family"
    ? `families/${item.family_id}/${state.family.owner_id}/${userId}/${crypto.randomUUID()}-${safeName}`
    : `personal/${userId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false
  });
  if (error) throw error;
  return { path, name: file.name, type: file.type, size: file.size };
}

async function openPaymentProof(recordId) {
  const record = state.paymentRecords.find((item) => item.id === recordId);
  if (!record?.proof_path) return;
  try {
    const { data, error } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).createSignedUrl(record.proof_path, 60);
    if (error) throw error;
    const link = document.createElement("a");
    link.href = data.signedUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  } catch (error) {
    showToast(error.message);
  }
}

async function deletePaymentRecord(recordId) {
  const record = state.paymentRecords.find((item) => item.id === recordId);
  try {
    await query("payment_records delete", supabase.from("payment_records").delete().eq("id", recordId));
    let proofCleanupFailed = false;
    if (record?.proof_path) {
      const { error } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).remove([record.proof_path]);
      proofCleanupFailed = Boolean(error);
    }
    await loadPaymentRecords();
    renderFamilyApp();
    showToast(proofCleanupFailed ? "Payment deleted. The receipt file still needs admin cleanup." : "Payment record deleted.");
  } catch (error) {
    showToast(error.message);
  }
}

async function deletePaymentItem(itemId) {
  const proofPaths = state.paymentRecords
    .filter((record) => record.payment_item_id === itemId && record.proof_path)
    .map((record) => record.proof_path);
  try {
    await query("payment item delete", supabase.from("payment_items").delete().eq("id", itemId));
    let proofCleanupFailed = false;
    if (proofPaths.length) {
      const { error } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).remove(proofPaths);
      proofCleanupFailed = Boolean(error);
    }
    await loadFamilyData();
    renderFamilyApp();
    showToast(proofCleanupFailed
      ? "Payment deleted. Some receipt files still need admin cleanup."
      : "Payment and its receipt files were deleted.");
  } catch (error) {
    showToast(error.message);
  }
}

async function addHead(event) {
  event.preventDefault();
  const email = $("#headEmail").value.trim().toLowerCase();
  const matchingProfile = state.adminProfiles.find((profile) => (profile.email || "").toLowerCase() === email);
  const payload = {
    user_id: matchingProfile?.id || null,
    full_name: $("#headName").value.trim(),
    email,
    created_by: state.session.user.id,
    family_limit: Math.max(0, Number($("#headFamilyLimit").value || 0)),
    can_add_members: $("#headCanAddMembers").checked,
    status: "active"
  };
  if (!payload.full_name || !email) return;
  if (!Number.isInteger(payload.family_limit) || payload.family_limit < 0 || payload.family_limit > 100) {
    showToast("Enter a whole-number family limit between 0 and 100.");
    return;
  }
  try {
    const existingRows = await query("head duplicate check", supabase.from("family_heads").select("id").ilike("email", email).limit(1));
    if (existingRows[0]) {
      await query("head update", supabase.from("family_heads").update(payload).eq("id", existingRows[0].id));
    } else {
      await query("head create", supabase.from("family_heads").insert(payload));
    }
    $("#headForm").reset();
    await loadAdminData();
    renderAdmin();
    showToast("User access saved.");
  } catch (error) {
    showToast(error.message);
  }
}

function configureProfileAccess(profileId) {
  const profile = state.adminProfiles.find((item) => item.id === profileId);
  if (!profile) return;
  $("#headForm").reset();
  $("#headName").value = profile.full_name || "";
  $("#headEmail").value = profile.email || "";
  $("#headFamilyLimit").value = 1;
  $("#headForm").scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => $("#headFamilyLimit").focus(), 250);
}

async function addPlatformPayment(event) {
  event.preventDefault();
  const head = state.heads.find((item) => item.id === $("#paymentHead").value);
  const amount = Number($("#paymentAmount").value);
  if (!head || amount <= 0) {
    showToast("Choose a user and enter a payment amount.");
    return;
  }
  const matchingFamily = findFamilyForHead(head);
  try {
    await query(
      "platform payment create",
      supabase.from("payments").insert({
        family_head_id: head.id,
        family_id: matchingFamily?.id || null,
        recorded_by: state.session.user.id,
        amount,
        currency: $("#paymentCurrency").value,
        payment_method: $("#paymentMethod").value,
        payment_date: $("#paymentDate").value,
        reference_number: $("#paymentReference").value.trim() || null,
        notes: $("#paymentNotes").value.trim() || null
      })
    );
    $("#paymentForm").reset();
    $("#paymentDate").value = toDateValue(new Date());
    await loadAdminData();
    renderAdmin();
    showToast("Legacy payment note recorded. Subscription access changes only through an approved review request.");
  } catch (error) {
    showToast(error.message);
  }
}

async function saveAdminNote(event) {
  event.preventDefault();
  try {
    await query(
      "admin note create",
      supabase.from("admin_support_notes").insert({
        family_id: $("#adminNoteFamily").value,
        note: $("#adminNoteText").value.trim(),
        created_by: state.session.user.id
      })
    );
    $("#adminNoteForm").reset();
    await loadAdminData();
    renderAdmin();
    showToast("Support note saved.");
  } catch (error) {
    showToast(error.message);
  }
}

async function updateHeadStatus(headId, nextStatus) {
  try {
    await query("head status update", supabase.from("family_heads").update({ status: nextStatus }).eq("id", headId));
    await loadAdminData();
    renderAdmin();
    showToast(nextStatus === "active" ? "User reactivated." : "User suspended.");
  } catch (error) {
    showToast(error.message);
  }
}

async function updateHeadMemberAccess(headId, nextValue) {
  try {
    await query("member access update", supabase.from("family_heads").update({ can_add_members: nextValue === "true" }).eq("id", headId));
    await loadAdminData();
    renderAdmin();
    showToast(nextValue === "true" ? "Family-member access unlocked." : "Family-member access locked.");
  } catch (error) {
    showToast(error.message);
  }
}

async function updateHeadFamilyLimit(headId) {
  const input = document.querySelector(`[data-family-limit-input="${headId}"]`);
  const familyLimitValue = Number(input?.value);
  if (!Number.isInteger(familyLimitValue) || familyLimitValue < 0 || familyLimitValue > 100) {
    showToast("Enter a whole-number family limit between 0 and 100.");
    return;
  }
  try {
    await query("family limit update", supabase.from("family_heads").update({ family_limit: familyLimitValue }).eq("id", headId));
    await loadAdminData();
    renderAdmin();
    showToast("Family limit updated.");
  } catch (error) {
    showToast(error.message);
  }
}

async function updateFamilyMemberAccess(familyId, nextValue) {
  const family = state.adminFamilies.find((item) => item.id === familyId);
  if (!family?.owner_email) {
    showToast("This household does not have an owner email saved.");
    return;
  }
  const allowMembers = nextValue === "true";
  const existingHead = findHeadForFamily(family);
  try {
    if (existingHead) {
      await query("household member access update", supabase.from("family_heads").update({ can_add_members: allowMembers }).eq("id", existingHead.id));
    } else if (allowMembers) {
      await query(
        "household member access create",
        supabase.from("family_heads").insert({
          full_name: `${family.name} owner`,
          email: family.owner_email.toLowerCase(),
          created_by: state.session.user.id,
          monthly_fee: 0,
          fee_currency: family.currency || "USD",
          billing_status: "unpaid",
          family_limit: 1,
          can_add_members: true,
          status: "active"
        })
      );
    }
    await loadAdminData();
    renderAdmin();
    showToast(allowMembers ? "Family-member access unlocked." : "Family-member access locked.");
  } catch (error) {
    showToast(error.message);
  }
}

async function updateFamilyStatus(familyId, nextStatus) {
  const family = state.adminFamilies.find((item) => item.id === familyId);
  const existingHead = family ? findHeadForFamily(family) : null;
  if (!existingHead) {
    showToast("Unlock member access first, then you can suspend this household.");
    return;
  }
  await updateHeadStatus(existingHead.id, nextStatus);
}

async function removeFamilyMember(memberId) {
  if (!state.family) return;
  try {
    await query(
      "family member remove",
      supabase.rpc("remove_family_member", {
        p_family_id: state.family.id,
        p_member_id: memberId
      })
    );
    await loadFamilyData();
    await loadWorkspaceSubscriptionData();
    renderFamilyApp();
    showToast("Member removed from the family. Their membership record was retained as inactive.");
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteSelectedFamily() {
  if (!state.family) return;
  const familyId = state.family.id;
  const proofPaths = state.paymentRecords
    .filter((record) => record.family_id === familyId && record.proof_path)
    .map((record) => record.proof_path);
  try {
    await query(
      "family delete",
      supabase.rpc("delete_family_workspace", { p_family_id: familyId })
    );
    let proofCleanupFailed = false;
    if (proofPaths.length) {
      const { error } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).remove(proofPaths);
      proofCleanupFailed = Boolean(error);
    }
    window.localStorage.removeItem(selectedFamilyStorageKey());
    state.family = null;
    await loadFamily();
    await loadFamilyData();
    await loadWorkspaceSubscriptionData();
    renderFamilyApp();
    showToast(proofCleanupFailed
      ? "Family deleted from the database. Some receipt files still need admin cleanup."
      : "Family and its receipt files were permanently deleted.");
  } catch (error) {
    showToast(error.message);
  }
}

async function updateObligationStatus(itemId, nextStatus) {
  try {
    await query("payment item status update", supabase.from("payment_items").update({ status: nextStatus }).eq("id", itemId));
    await loadPaymentItems();
    renderFamilyApp();
    showToast(nextStatus === "active" ? "Obligation reactivated." : "Obligation paused.");
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteRow(table, id, reload, message) {
  try {
    await query(`${table} delete`, supabase.from(table).delete().eq("id", id));
    await reload();
    showToast(message);
  } catch (error) {
    showToast(error.message);
  }
}

function memberById(id) {
  return state.members.find((member) => member.id === id);
}

function findFamilyForHead(head) {
  return state.adminFamilies.find((family) => (family.owner_email || "").toLowerCase() === head.email.toLowerCase());
}

function findHeadForFamily(family) {
  return state.heads.find((head) => head.email.toLowerCase() === (family.owner_email || "").toLowerCase());
}

function recurrenceLabel(item) {
  if (item.recurrence_type === "once") return "Once-off";
  if (item.recurrence_type === "quarterly") return "Every 3 months";
  if (item.recurrence_type === "yearly") return "Yearly";
  if (item.recurrence_type === "custom") return `Every ${item.recurrence_interval || 1} months`;
  return "Monthly";
}

function formatOccurrenceCurrencyTotals(occurrences) {
  return formatCurrencyTotals(occurrences.map((occurrence) => ({ currency: occurrence.item.currency, amount: occurrence.amount })));
}

function formatCurrencyTotals(rows) {
  if (!rows.length) return money(0, "USD");
  const totals = rows.reduce((acc, row) => {
    const currency = row.currency || "USD";
    acc[currency] = (acc[currency] || 0n) + decimalToScaled(row.amount || 0);
    return acc;
  }, {});
  return Object.entries(totals).map(([currency, amount]) => money(scaledToDecimal(amount), currency)).join(" / ");
}

function latestBaseRate(currency, at = null) {
  const code = `${currency || "USD"}`.toUpperCase();
  if (code === "USD") return { rate: "1", provider_effective_at: at || new Date().toISOString(), provider: "identity" };
  const cutoff = at ? new Date(at).getTime() : Number.POSITIVE_INFINITY;
  return state.exchangeRates.find((row) =>
    row.quote_currency === code && new Date(row.provider_effective_at).getTime() <= cutoff
  ) || null;
}

function crossRateScaled(sourceCurrency, targetCurrency, at = null) {
  const sourceCode = `${sourceCurrency || "USD"}`.toUpperCase();
  const targetCode = `${targetCurrency || "USD"}`.toUpperCase();
  if (sourceCode === targetCode) return DECIMAL_SCALE;
  const source = latestBaseRate(sourceCode, at);
  const target = latestBaseRate(targetCode, at);
  if (!source || !target) return null;
  const sourceRate = decimalToScaled(source.rate);
  const targetRate = decimalToScaled(target.rate);
  if (sourceRate <= 0n || targetRate <= 0n) return null;
  return (targetRate * DECIMAL_SCALE) / sourceRate;
}

function convertAmountScaled(amount, sourceCurrency, targetCurrency, at = null) {
  const rate = crossRateScaled(sourceCurrency, targetCurrency, at);
  return rate == null ? null : multiplyScaled(decimalToScaled(amount), rate);
}

function formatConvertedTotal(rows, targetCurrency) {
  const total = convertedTotalScaled(rows, targetCurrency);
  if (total == null) return null;
  return money(scaledToDecimal(total), targetCurrency);
}

function convertedTotalScaled(rows, targetCurrency) {
  let total = 0n;
  for (const row of rows) {
    const converted = convertAmountScaled(row.amount, row.currency || "USD", targetCurrency, row.at || null);
    if (converted == null) return null;
    total += converted;
  }
  return total;
}

function selectedReportingCurrency() {
  return state.workspaceSettings?.reporting_currency || "USD";
}

function selectedDashboardCurrency() {
  return state.workspaceSettings?.default_payment_currency || selectedReportingCurrency();
}

function dashboardAmountSummary(rows) {
  const currency = selectedDashboardCurrency();
  const scaled = convertedTotalScaled(rows, currency);
  if (scaled != null) {
    return {
      scaled,
      currency,
      converted: rows.some((row) => `${row.currency || "USD"}`.toUpperCase() !== currency.toUpperCase()),
      text: money(scaledToDecimal(scaled), currency)
    };
  }
  return {
    scaled: null,
    currency: null,
    converted: false,
    text: formatCurrencyTotals(rows)
  };
}

function compareScaledDescending(left, right) {
  if (left == null || right == null || left === right) return 0;
  return left > right ? -1 : 1;
}

function rateStatusPresentation(status = state.exchangeRateStatus) {
  const lastSuccess = status?.last_success_at ? new Date(status.last_success_at) : null;
  const hours = Number(status?.stale_hours);
  if (!lastSuccess || Number.isNaN(lastSuccess.getTime())) {
    return { level: "missing", text: "No successful exchange-rate sync is available. Original currencies remain visible separately." };
  }
  const updated = lastSuccess.toLocaleString();
  if (hours > 36) return { level: "danger", text: `Rates are more than 36 hours old. Last successful CurrencyAPI sync: ${updated}.` };
  if (hours > 18) return { level: "warning", text: `Rates may be stale. Last successful CurrencyAPI sync: ${updated}.` };
  return { level: "current", text: `CurrencyAPI rates last updated ${updated}.` };
}

function csvCell(value) {
  const text = `${value ?? ""}`.replaceAll('"', '""');
  return `"${text}"`;
}

function downloadCsv(filename, headings, rows) {
  const csv = [headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function exportReportCsv() {
  const items = paymentItemsForReportWorkspace().filter((item) =>
    state.reportCurrencyFilter === "all" || item.currency === state.reportCurrencyFilter
  );
  const records = paymentRecordsForReportWorkspace(items);
  const target = reportReportingCurrency();
  const rows = records.map((record) => {
    const item = items.find((candidate) => candidate.id === record.payment_item_id);
    const source = record.currency || item?.currency || "USD";
    const locked = lockedConversionFor("payment_record", record.id, target);
    return [
      record.payment_date, item?.name || "Payment", record.amount, source,
      locked?.converted_amount || "", locked?.reporting_currency || "",
      locked?.exchange_rate || "", locked?.rate_effective_at || "",
      locked?.rate_source || "", record.payment_method || "", record.reference_number || ""
    ];
  });
  downloadCsv(`mushavo-report-${state.filterMonth}.csv`, [
    "Payment date", "Payment", "Original amount", "Original currency", "Converted amount",
    "Reporting currency", "Exchange rate", "Rate effective at (UTC)", "Rate source", "Method", "Reference"
  ], rows);
}

function exportAdminFinanceCsv() {
  const target = adminReportingCurrency();
  const records = [
    ...state.payments.filter((payment) => adminFinanceRecordVisible(payment, "platform_payment")).map((payment) => ({
      entity_type: "platform_payment", entity_id: payment.id, at: payment.payment_date,
      amount: payment.amount, currency: payment.currency, status: "approved", reference: payment.reference_number
    })),
    ...state.adminSubscriptionPayments.filter((payment) => adminFinanceRecordVisible(payment, "subscription_payment")).map((payment) => ({
      entity_type: "subscription_payment", entity_id: payment.id, at: payment.payment_date,
      amount: payment.amount, currency: payment.currency, status: payment.status, reference: payment.reference_number
    }))
  ];
  const rows = records.map((payment) => {
    const locked = lockedConversionFor(payment.entity_type, payment.entity_id, target);
    return [payment.entity_type, payment.entity_id, payment.status, payment.reference, payment.at, payment.amount, payment.currency,
      locked?.converted_amount || "", locked?.reporting_currency || "", locked?.exchange_rate || "",
      locked?.rate_effective_at || "", locked?.rate_source || ""];
  });
  downloadCsv(`mushavo-finance-${toDateValue(new Date())}.csv`, [
    "Record type", "Record ID", "Status", "Reference", "Payment date", "Original amount", "Original currency",
    "Converted amount", "Reporting currency", "Exchange rate", "Rate effective at (UTC)", "Rate source"
  ], rows);
}

function printCurrentView(kind) {
  document.body.dataset.printView = kind;
  window.print();
  delete document.body.dataset.printView;
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function validateProofFile(file) {
  if (!PAYMENT_PROOF_TYPES.has(file.type)) {
    throw new Error("Proof must be a JPG, PNG, WebP, or PDF file.");
  }
  if (file.size > PAYMENT_PROOF_MAX_BYTES) {
    throw new Error("Proof files must be 10 MB or smaller.");
  }
}

function statusBadge(status) {
  return `<span class="mini-badge ${badgeClass(status)}">${escapeHtml(status)}</span>`;
}

function badgeClass(status) {
  return `${status}`.toLowerCase().replaceAll(" ", "-");
}

function emptyState(title, text) {
  return `<div class="empty-ledger"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`;
}

function memberInitials(name) {
  return `${name || "?"}`.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function escapeHtml(value) {
  return `${value ?? ""}`.replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[char];
  });
}

document.addEventListener("click", async (event) => {
  if (event.target.dataset.closePaymentDialog !== undefined) $("#recordPaymentDialog").close();
  if (event.target.closest("[data-open-payment-item-dialog]")) openPaymentItemDialog();
  if (event.target.closest("[data-close-payment-item-dialog]")) $("#paymentItemDialog").close();
  if (event.target.closest("[data-open-invite-dialog]")) openInviteMemberDialog();
  if (event.target.closest("[data-close-invite-dialog]")) $("#inviteMemberDialog").close();
  if (event.target.dataset.closeConfirmDialog !== undefined) $("#confirmDialog").close();
  if (event.target.closest("[data-close-notifications]")) $("#notificationDialog").close();
  if (event.target.dataset.openDrawer !== undefined) openDrawer();
  if (event.target.dataset.closeDrawer !== undefined) closeDrawer();
  if (event.target.closest("[data-open-notifications]")) openNotificationDialog();
  if (event.target.closest("[data-open-renewal-dialog]")) openRenewalDialog();
  if (event.target.closest("[data-close-renewal-dialog]")) $("#renewalDialog").close();
  if (event.target.closest("[data-edit-family-name]")) openFamilyNameDialog();
  if (event.target.closest("[data-close-family-name-dialog]")) $("#familyNameDialog").close();
  if (event.target.closest("[data-close-admin-details]")) $("#adminDetailsDialog").close();

  const planDefinitionEdit = event.target.closest("[data-edit-plan-definition]");
  if (planDefinitionEdit) editPlanDefinition(planDefinitionEdit.dataset.editPlanDefinition);


  const adminUserDetails = event.target.closest("[data-view-admin-user]");
  if (adminUserDetails) openAdminUserDetails(adminUserDetails.dataset.viewAdminUser, adminUserDetails.dataset.viewAdminUserEmail);

  const adminWorkspaceDetails = event.target.closest("[data-view-admin-workspace]");
  if (adminWorkspaceDetails) openAdminWorkspaceDetails(adminWorkspaceDetails.dataset.viewAdminWorkspace);

  const adminLegacyFamilyDetails = event.target.closest("[data-view-admin-legacy-family]");
  if (adminLegacyFamilyDetails) openAdminLegacyFamilyDetails(adminLegacyFamilyDetails.dataset.viewAdminLegacyFamily);

  const subscriptionPaymentDetails = event.target.closest("[data-view-subscription-payment]");
  if (subscriptionPaymentDetails) openSubscriptionPaymentDetails(subscriptionPaymentDetails.dataset.viewSubscriptionPayment);

  const selectedRenewalPlan = event.target.closest("[data-select-renewal-plan]");
  if (selectedRenewalPlan) openRenewalDialog(selectedRenewalPlan.dataset.selectRenewalPlan);

  const subscriptionReview = event.target.closest("[data-review-subscription]");
  if (subscriptionReview) await reviewSubscriptionPayment(subscriptionReview.dataset.reviewSubscription, subscriptionReview.dataset.reviewDecision);

  const subscriptionProof = event.target.closest("[data-open-subscription-proof]");
  if (subscriptionProof) await openSubscriptionProof(subscriptionProof.dataset.openSubscriptionProof);

  const manualConversion = event.target.closest("[data-manual-conversion]");
  if (manualConversion) await saveManualConversion(
    manualConversion.dataset.conversionEntity,
    manualConversion.dataset.manualConversion
  );

  const dueMonthToggle = event.target.closest("[data-toggle-due-month]");
  if (dueMonthToggle) {
    const section = dueMonthToggle.closest(".due-month-group");
    const items = section?.querySelector(".due-month-items");
    if (section && items) {
      const expanded = dueMonthToggle.getAttribute("aria-expanded") === "true";
      dueMonthToggle.setAttribute("aria-expanded", `${!expanded}`);
      items.hidden = expanded;
      section.classList.toggle("expanded", !expanded);
      section.classList.toggle("collapsed", expanded);
      scheduleDashboardTextFit();
    }
  }

  const occurrenceToggle = event.target.closest("[data-toggle-occurrence-details]");
  if (occurrenceToggle) {
    const details = document.getElementById(occurrenceToggle.getAttribute("aria-controls"));
    if (details) {
      const expanded = occurrenceToggle.getAttribute("aria-expanded") === "true";
      occurrenceToggle.setAttribute("aria-expanded", `${!expanded}`);
      details.hidden = expanded;
      occurrenceToggle.closest(".occurrence-card")?.classList.toggle("expanded", !expanded);
      scheduleDashboardTextFit();
    }
  }
  if (event.target.dataset.retryLoad !== undefined) {
    setView("loading");
    await loadApp().catch((error) => {
      console.error(error);
      showToast(error.message);
      showAppError(error);
    });
  }
  if (event.target.dataset.signOutError !== undefined) {
    await supabase.auth.signOut();
  }

  const configureProfileId = event.target.dataset.configureProfile;
  if (configureProfileId) configureProfileAccess(configureProfileId);

  const adminTab = event.target.dataset.adminTab;
  if (adminTab) {
    state.adminTab = adminTab;
    setRoute("admin", adminTab);
    try {
      await loadAdminData(adminTab);
      renderAdmin();
    } catch (error) {
      showToast(`This page could not load: ${friendlyMessage(error?.message)}`);
    }
    closeDrawer();
  }

  const familyTab = event.target.dataset.familyTab;
  if (familyTab) {
    state.familyTab = familyTab;
    setRoute("family", familyTab);
    renderFamilyApp();
    scheduleDashboardTextFit();
    closeDrawer();
  }

  const recordPaymentKey = event.target.dataset.recordPayment;
  if (recordPaymentKey) {
    if ($("#notificationDialog").open) $("#notificationDialog").close();
    openRecordPayment(recordPaymentKey);
  }

  const openProofId = event.target.dataset.openProof;
  if (openProofId) await openPaymentProof(openProofId);

  const workloadToggle = event.target.closest("[data-toggle-workload]");
  if (workloadToggle) {
    const details = $(`#workload-details-${workloadToggle.dataset.toggleWorkload}`);
    if (details) {
      const expanded = workloadToggle.getAttribute("aria-expanded") === "true";
      workloadToggle.setAttribute("aria-expanded", `${!expanded}`);
      workloadToggle.textContent = expanded ? "View payments" : "Hide payments";
      details.classList.toggle("hidden", expanded);
      scheduleDashboardTextFit();
    }
  }

  const editObligationId = event.target.dataset.editObligation;
  if (editObligationId) startEditObligation(editObligationId);

  const toggleObligationId = event.target.dataset.toggleObligation;
  if (toggleObligationId) await updateObligationStatus(toggleObligationId, event.target.dataset.nextStatus);

  const deleteObligationId = event.target.dataset.deleteObligation;
  if (deleteObligationId && await confirmAction({
    title: "Delete payment?",
    message: "This deletes the recurring payment and its saved payment records.",
    action: "Delete"
  })) {
    await deletePaymentItem(deleteObligationId);
  }

  const removeMemberId = event.target.dataset.removeMember;
  if (removeMemberId && await confirmAction({
    title: "Remove this member?",
    message: "They will lose access to this family. Their membership record will remain in the database as inactive and can be restored by inviting them again.",
    action: "Remove"
  })) {
    await removeFamilyMember(removeMemberId);
  }

  if (event.target.dataset.deleteFamily !== undefined && state.family && await confirmAction({
    title: `Delete ${state.family.name}?`,
    message: "This permanently deletes the family and all of its family data from the database. This cannot be undone.",
    action: "Delete family"
  })) {
    await deleteSelectedFamily();
  }

  const deleteRecordId = event.target.dataset.deleteRecord;
  if (deleteRecordId && await confirmAction({
    title: "Delete payment record?",
    message: "This removes the saved payment from the selected period.",
    action: "Delete"
  })) {
    await deletePaymentRecord(deleteRecordId);
  }

  const deleteHeadId = event.target.dataset.deleteHead;
  if (deleteHeadId && await confirmAction({
    title: "Revoke user access?",
    message: "This removes the admin settings row for this user.",
    action: "Revoke"
  })) {
    await deleteRow("family_heads", deleteHeadId, async () => {
      await loadAdminData();
      renderAdmin();
    }, "User access revoked.");
  }

  const toggleHeadId = event.target.dataset.toggleHead;
  if (toggleHeadId) await updateHeadStatus(toggleHeadId, event.target.dataset.nextStatus);

  const toggleMemberAccessId = event.target.dataset.toggleMemberAccess;
  if (toggleMemberAccessId) await updateHeadMemberAccess(toggleMemberAccessId, event.target.dataset.nextMemberAccess);

  const saveFamilyLimitId = event.target.dataset.saveFamilyLimit;
  if (saveFamilyLimitId) await updateHeadFamilyLimit(saveFamilyLimitId);

  const toggleFamilyMemberAccessId = event.target.dataset.toggleFamilyMemberAccess;
  if (toggleFamilyMemberAccessId) await updateFamilyMemberAccess(toggleFamilyMemberAccessId, event.target.dataset.nextMemberAccess);

  const toggleFamilyStatusId = event.target.dataset.toggleFamilyStatus;
  if (toggleFamilyStatusId) await updateFamilyStatus(toggleFamilyStatusId, event.target.dataset.nextStatus);

  const deletePaymentId = event.target.dataset.deletePayment;
  if (deletePaymentId && await confirmAction({
    title: "Delete platform payment?",
    message: "This removes the subscription payment record from admin finance.",
    action: "Delete"
  })) {
    await deleteRow("payments", deletePaymentId, async () => {
      await loadAdminData();
      renderAdmin();
    }, "Platform payment deleted.");
  }

  const deleteAdminNoteId = event.target.dataset.deleteAdminNote;
  if (deleteAdminNoteId && await confirmAction({
    title: "Delete support note?",
    message: "This removes the note from the household support timeline.",
    action: "Delete"
  })) {
    await deleteRow("admin_support_notes", deleteAdminNoteId, async () => {
      await loadAdminData();
      renderAdmin();
    }, "Support note deleted.");
  }

  const acceptInviteId = event.target.dataset.acceptInvite;
  if (acceptInviteId) await respondToInvitation(acceptInviteId, "accepted");

  const rejectInviteId = event.target.dataset.rejectInvite;
  if (rejectInviteId) await respondToInvitation(rejectInviteId, "rejected");

  const readNotificationId = event.target.dataset.readNotification;
  if (readNotificationId) {
    await query("notification read", supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", readNotificationId));
    await loadNotifications();
    renderFamilyApp();
  }

  const openNotificationId = event.target.dataset.openNotification;
  if (openNotificationId) {
    const notification = state.notifications.find((item) => item.id === openNotificationId);
    if (notification?.url) {
      const target = new URL(notification.url, window.location.href);
      if (target.origin === window.location.origin) window.location.assign(target.href);
    }
  }
});

$("#authForm").addEventListener("submit", signIn);
$("#familyForm").addEventListener("submit", createFamily);
$("#memberFamilyForm").addEventListener("submit", createFamilyFromMembers);
$("#familyNameForm").addEventListener("submit", saveFamilyName);
$("#inviteForm").addEventListener("submit", inviteMember);
$("#obligationForm").addEventListener("submit", saveObligation);
$("#recordPaymentForm").addEventListener("submit", savePaymentRecord);
$("#recordPaymentType").addEventListener("change", (event) => {
  const amountInput = $("#recordAmount");
  const outstanding = Number($("#recordOutstanding").value || 0);
  const isFullPayment = event.target.value === "full";
  amountInput.readOnly = isFullPayment;
  amountInput.value = isFullPayment ? outstanding.toFixed(2) : "";
  if (!isFullPayment) amountInput.focus();
});
$("#headForm").addEventListener("submit", addHead);
$("#paymentForm").addEventListener("submit", addPlatformPayment);
$("#adminNoteForm").addEventListener("submit", saveAdminNote);
$("#planDefinitionForm").addEventListener("submit", savePlanDefinition);
$("#cancelPlanEditButton").addEventListener("click", resetPlanDefinitionForm);
$("#planPriceForm").addEventListener("submit", savePlanPrice);
$("#workspaceCurrencySettingsForm").addEventListener("submit", saveWorkspaceCurrencySettings);
$("#workspaceEnabledCurrencies").addEventListener("change", refreshWorkspaceCurrencyDependentOptions);
$("#adminCurrencySettingsForm").addEventListener("submit", saveAdminFinanceCurrencySettings);
$("#adminEnabledCurrencies").addEventListener("change", refreshAdminCurrencyDependentOptions);
document.querySelectorAll("#adminFinanceCurrencyFilter, #adminFinanceStatusFilter, #adminFinanceTypeFilter, #adminFinanceFromDate, #adminFinanceToDate, #adminFinanceSearch").forEach((field) => {
  field.addEventListener(field.type === "search" ? "input" : "change", () => {
    renderAdminFinanceCurrencyPanel();
    renderPlatformPayments();
    renderSubscriptionReviews();
    renderSubscriptionPaymentHistory();
  });
});
document.querySelectorAll("#adminEnquirySearch, #adminEnquiryStatus, #adminEnquiryCountry").forEach((field) => {
  field.addEventListener(field.type === "search" ? "input" : "change", renderAdminEnquiries);
});
$("#syncExchangeRatesButton").addEventListener("click", syncExchangeRates);
$("#exportReportCsvButton").addEventListener("click", exportReportCsv);
$("#printReportButton").addEventListener("click", () => printCurrentView("reports"));
$("#exportAdminFinanceCsvButton").addEventListener("click", exportAdminFinanceCsv);
$("#printAdminFinanceButton").addEventListener("click", () => printCurrentView("admin-finance"));
$("#renewalForm").addEventListener("submit", submitSubscriptionRenewal);
$("#renewalPlan").addEventListener("change", updateRenewalQuote);
$("#renewalPeriod").addEventListener("change", updateRenewalQuote);
$("#renewalCurrency").addEventListener("change", updateRenewalQuote);
$("#renewalFamilyMemberCount").addEventListener("change", updateRenewalQuote);
$("#renewalFamilyMemberCount").addEventListener("input", (event) => {
  const count = Number(event.target.value);
  const minimum = Number(event.target.min || 1);
  const maximum = Number(event.target.max || 100);
  if (Number.isInteger(count) && count >= minimum && count <= maximum) {
    updateRenewalQuote();
  }
});
$("#cancelEditObligationButton").addEventListener("click", () => $("#paymentItemDialog").close());
$("#paymentItemDialog").addEventListener("close", resetObligationForm);
$("#inviteMemberDialog").addEventListener("close", () => {
  $("#inviteEmail").value = "";
  $("#inviteRole").value = "Adult";
});
$("#signOutButton").addEventListener("click", async () => supabase.auth.signOut());
$("#adminSignOutButton").addEventListener("click", async () => supabase.auth.signOut());
$("#suspendedSignOutButton").addEventListener("click", async () => supabase.auth.signOut());
$("#obligationCurrencySearch").addEventListener("input", (event) => {
  renderPaymentCurrencyOptions(event.target.value, $("#obligationCurrency").value);
});
$("#paymentHead").addEventListener("change", (event) => {
  const option = event.target.selectedOptions[0];
  const amount = Number(option?.dataset.amount || 0);
  if (amount > 0) $("#paymentAmount").value = amount.toFixed(2);
  if (option?.dataset.currency) $("#paymentCurrency").value = option.dataset.currency;
});
$("#monthFilter").addEventListener("change", (event) => {
  state.filterMonth = event.target.value;
  renderFamilyApp();
});
$("#reportMonthFilter").addEventListener("change", (event) => {
  state.filterMonth = event.target.value;
  $("#monthFilter").value = state.filterMonth;
  renderReports();
});
$("#reportCurrencyFilter").addEventListener("change", (event) => {
  state.reportCurrencyFilter = event.target.value;
  renderReports();
});
$("#reportViewMode").addEventListener("change", (event) => {
  state.reportViewMode = event.target.value;
  renderReports();
});
$("#reportReportingCurrency").addEventListener("change", (event) => {
  state.reportReportingCurrency = event.target.value;
  renderReports();
});
$("#statusFilter").addEventListener("change", (event) => {
  state.filterStatus = event.target.value;
  renderFamilyApp();
});
$("#adminHouseholdSearch").addEventListener("input", renderAdminFamilies);
document.querySelectorAll("#adminWorkspaceTypeFilter, #adminWorkspaceStatusFilter, #adminWorkspacePlanFilter, #adminWorkspaceSort").forEach((field) => {
  field.addEventListener("change", renderAdminFamilies);
});
$("#adminWorkspaceReset").addEventListener("click", () => {
  $("#adminHouseholdSearch").value = "";
  $("#adminWorkspaceTypeFilter").value = "all";
  $("#adminWorkspaceStatusFilter").value = "all";
  $("#adminWorkspacePlanFilter").value = "all";
  $("#adminWorkspaceSort").value = "newest";
  renderAdminFamilies();
});
document.querySelectorAll("[data-family-selector]").forEach((select) => {
  select.addEventListener("change", (event) => {
    selectFamily(event.target.value).catch((error) => showToast(error.message));
  });
});

window.addEventListener("hashchange", () => {
  applyRouteFromHash();
  if (state.isAdmin) {
    loadAdminData().then(renderAdmin).catch((error) => showToast(friendlyMessage(error?.message)));
  }
  if (state.session && !state.isAdmin) renderFamilyApp();
});

window.addEventListener("beforeunload", stopRealtime);
window.addEventListener("resize", scheduleDashboardTextFit);

init().catch(handleLoadFailure);
