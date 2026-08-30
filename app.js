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
  billableMemberCount: 1,
  plans: [],
  planPrices: [],
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
  adminRenewalRequests: [],
  adminSubscriptionInvoices: [],
  adminSubscriptionPayments: [],
  adminSubscriptionProofs: [],
  adminTab: "dashboard",
  familyTab: "dashboard",
  editingObligationId: null,
  filterMonth: toMonthValue(new Date()),
  filterStatus: "all"
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

const adminTabs = new Set(["dashboard", "households", "users", "plans", "finance", "support"]);
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
    return new Intl.NumberFormat(currencyNames[currency] || "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(Number(amount || 0));
  } catch (_error) {
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }
}

function renderPaymentCurrencyOptions(searchTerm = "", selectedCurrency = "") {
  const select = $("#obligationCurrency");
  if (!select) return;
  const queryText = searchTerm.trim().toLowerCase();
  const currentValue = selectedCurrency || select.value || "USD";
  const matches = PAYMENT_CURRENCIES.filter(([code, name]) =>
    !queryText || code.toLowerCase().includes(queryText) || name.toLowerCase().includes(queryText)
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
    return "A payment for this plan and billing period is already waiting for review.";
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
  return [...sharedTables, "plans", "plan_prices", "payments", "admin_support_notes"];
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

function handleLoadFailure(error) {
  console.error(error);
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
  appLoadPromise = loadApp().finally(() => {
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
  state.billableMemberCount = 1;
  state.plans = [];
  state.planPrices = [];
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
  state.adminRenewalRequests = [];
  state.adminSubscriptionInvoices = [];
  state.adminSubscriptionPayments = [];
  state.adminSubscriptionProofs = [];
  state.adminTab = "dashboard";
  state.familyTab = "dashboard";
  state.editingObligationId = null;
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
  const [workspaces, members, plans, prices] = await Promise.all([
    query("workspace load", supabase.from("budget_workspaces").select("*").order("created_at", { ascending: true })),
    query("workspace membership load", supabase.from("workspace_members").select("*").order("created_at", { ascending: true })),
    query("plan catalogue load", supabase.from("plans").select("*").eq("is_active", true).order("sort_order", { ascending: true })),
    query("plan prices load", supabase.from("plan_prices").select("*").eq("is_active", true).order("effective_from", { ascending: false }))
  ]);
  state.workspaces = workspaces;
  state.workspaceMembers = members;
  state.plans = plans;
  state.planPrices = prices;

  const workspace = currentBudgetWorkspace();
  if (!workspace) throw new Error("Your subscription workspace could not be reconciled. Run the complete Supabase schema again.");

  const [subscriptions, entitlements, billableMemberCount, requests, invoices, payments, history] = await Promise.all([
    query("workspace subscription load", supabase.from("workspace_subscriptions").select("*").eq("workspace_id", workspace.id).limit(1)),
    query("workspace entitlement load", supabase.rpc("effective_workspace_entitlement", { p_workspace_id: workspace.id })),
    query("workspace seat usage load", supabase.rpc("workspace_billable_member_count", { p_workspace_id: workspace.id })),
    query("renewal requests load", supabase.from("subscription_renewal_requests").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false })),
    query("subscription invoices load", supabase.from("subscription_invoices").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false })),
    query("subscription payments load", supabase.from("subscription_payments").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false })),
    query("entitlement history load", supabase.from("subscription_entitlement_history").select("*, plans(display_name, code)").eq("workspace_id", workspace.id).order("created_at", { ascending: false }))
  ]);
  state.workspaceSubscription = subscriptions[0] || null;
  state.workspaceEntitlement = entitlements[0] || null;
  state.billableMemberCount = Number(billableMemberCount || 1);
  state.renewalRequests = requests;
  state.subscriptionInvoices = invoices;
  state.subscriptionPayments = payments;
  state.entitlementHistory = history;
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
  }
  if (tab === "users") {
    add("adminProfiles", "registered users load", supabase.from("profiles").select("*").order("created_at", { ascending: false }));
    add("adminWorkspaces", "user workspaces load", supabase.from("budget_workspaces").select("*").order("created_at", { ascending: false }));
    add("adminWorkspaceMembers", "user workspace membership load", supabase.from("workspace_members").select("*").order("created_at", { ascending: false }));
    add("adminSubscriptions", "user subscriptions load", supabase.from("workspace_subscriptions").select("*").order("updated_at", { ascending: false }));
    add("adminPlans", "user plans load", supabase.from("plans").select("*").order("sort_order", { ascending: true }));
  }
  if (tab === "households") {
    add("adminProfiles", "workspace owner profiles load", supabase.from("profiles").select("*").order("created_at", { ascending: false }));
    add("adminMembers", "admin members load", supabase.from("family_members").select("*").order("created_at", { ascending: true }));
    add("adminWorkspaces", "workspace directory load", supabase.from("budget_workspaces").select("*").order("created_at", { ascending: false }));
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
  if (["plans", "finance"].includes(tab)) {
    add("adminPlans", "admin plans load", supabase.from("plans").select("*").order("sort_order", { ascending: true }));
    add("adminPlanPrices", "admin plan prices load", supabase.from("plan_prices").select("*").order("effective_from", { ascending: false }));
  }
  if (["dashboard", "finance"].includes(tab)) {
    add("adminSubscriptionPayments", "admin subscription payments load", supabase.from("subscription_payments").select("*").order("created_at", { ascending: false }));
  }
  if (tab === "finance") {
    add("adminWorkspaces", "admin workspaces load", supabase.from("budget_workspaces").select("*").order("created_at", { ascending: false }));
    add("adminSubscriptions", "admin subscriptions load", supabase.from("workspace_subscriptions").select("*").order("updated_at", { ascending: false }));
    add("adminRenewalRequests", "admin renewal requests load", supabase.from("subscription_renewal_requests").select("*").order("created_at", { ascending: false }));
    add("adminSubscriptionInvoices", "admin subscription invoices load", supabase.from("subscription_invoices").select("*").order("created_at", { ascending: false }));
    add("adminSubscriptionProofs", "admin subscription proofs load", supabase.from("subscription_payment_proofs").select("*").order("created_at", { ascending: false }));
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
  const allowedToInvite = manageableFamilies.length > 0;
  $("#inviteMemberButton").disabled = !allowedToInvite;
  $("#inviteForm").querySelectorAll("input, select, button").forEach((field) => {
    field.disabled = !allowedToInvite;
  });
  const memberNotice = $("#memberAccessNotice");
  memberNotice.classList.toggle("hidden", allowedToInvite);
  if (!allowedToInvite) {
    memberNotice.innerHTML = owned.length
      ? "<strong>Member management is locked.</strong> The admin must activate member access before you can invite or remove family members."
      : "<strong>Only a family owner can manage members.</strong> You can participate in families you joined, but only their owner can invite or remove members.";
  }

  const selectedFamilyPanel = $("#selectedFamilyPanel");
  const ownsSelectedFamily = state.family?.owner_id === state.session?.user?.id;
  selectedFamilyPanel.classList.toggle("hidden", !ownsSelectedFamily);
  if (ownsSelectedFamily) {
    $("#selectedFamilyTitle").textContent = state.family.name;
    $("#selectedFamilyMeta").textContent = `${money(state.family.monthly_budget, state.family.currency)} expected each month · ${familyCount} of ${limit} family slots used`;
    $("#selectedFamilyMemberCount").textContent = state.members.filter((member) => member.status === "active").length;
    $("#selectedFamilyPaymentCount").textContent = state.paymentItems.filter((item) => item.family_id === state.family.id && item.status !== "inactive").length;
    $("#selectedFamilyInviteCount").textContent = state.familyInvitations.filter((invite) => invite.family_id === state.family.id && invite.status === "pending").length;
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
  const due = occurrences.reduce((sum, item) => sum + item.amount, 0);
  const paid = occurrences.reduce((sum, item) => sum + item.paid, 0);
  const outstanding = occurrences.reduce((sum, item) => sum + item.outstanding, 0);
  const overdue = occurrences.filter((item) => item.status === "overdue");
  const myDue = myOccurrences(occurrences).filter((item) => item.status !== "paid");
  const currency = familyCurrency();
  const percentage = due > 0 ? Math.min((paid / due) * 100, 100) : 0;

  $("#dueAmount").textContent = money(due, currency);
  $("#outstandingAmount").textContent = money(outstanding, currency);
  $("#outstandingText").textContent = outstanding > 0 ? "Still outstanding" : "All clear";
  $("#overdueCount").textContent = overdue.length;
  $("#overdueText").textContent = overdue.length ? "Needs follow-up" : "No overdue dues";
  $("#myDueCount").textContent = myDue.length;
  $("#paidMeter").style.width = `${percentage}%`;
  $("#paidProgressText").textContent = due > 0 ? `${Math.round(percentage)}% paid this month` : "No dues yet";

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
    const totalOutstanding = formatCurrencyTotals(group.occurrences.map((occurrence) => ({
      currency: occurrence.item.currency,
      amount: occurrence.outstanding
    })));
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
      total: assigned.reduce((sum, item) => sum + item.amount, 0),
      paid: assigned.reduce((sum, item) => sum + Math.min(item.paid, item.amount), 0),
      outstanding: assigned.reduce((sum, item) => sum + item.outstanding, 0),
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
      total: householdAssigned.reduce((sum, item) => sum + item.amount, 0),
      paid: householdAssigned.reduce((sum, item) => sum + Math.min(item.paid, item.amount), 0),
      outstanding: householdAssigned.reduce((sum, item) => sum + item.outstanding, 0),
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
    row.progress = row.total > 0 ? Math.min((row.paid / row.total) * 100, 100) : 0;
    row.status = row.overdueCount
      ? "overdue"
      : row.partialCount
        ? "partial"
        : row.dueSoonCount
          ? "due soon"
          : row.outstanding > 0
            ? "on track"
            : "paid";
  });
  rows.sort((a, b) =>
    statusRank[a.status] - statusRank[b.status]
    || b.outstanding - a.outstanding
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
        <div><span>Total due</span><strong data-fit-text data-fit-min="10">${money(row.total, familyCurrency())}</strong></div>
        <div><span>Paid</span><strong data-fit-text data-fit-min="10">${money(row.paid, familyCurrency())}</strong></div>
        <div><span>Outstanding</span><strong data-fit-text data-fit-min="10">${money(row.outstanding, familyCurrency())}</strong></div>
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

function planInvoiceTotal(plan, price) {
  if (!plan || !price) return 0;
  const includedSeats = plan.code === "household" ? 4 : plan.code === "business" ? 6 : 1;
  const extraSeats = Math.max(0, Number(state.billableMemberCount || 1) - includedSeats);
  return Number(price.amount || 0) + extraSeats * Number(price.extra_member_amount || 0);
}

function renderSubscription() {
  const workspace = currentBudgetWorkspace();
  const entitlement = state.workspaceEntitlement;
  if (!workspace || !entitlement) return;
  const activeItems = state.paymentItems.filter((item) => item.workspace_id === workspace.id && item.status !== "inactive").length;
  const limitText = entitlement.active_payment_limit == null
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
  $("#subscriptionUsageCaption").textContent = workspace.workspace_type === "personal"
    ? "Active payment items"
    : `${state.billableMemberCount} billable member${state.billableMemberCount === 1 ? "" : "s"}`;
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
  const plans = state.plans.filter((plan) => plan.workspace_type === workspace?.workspace_type);
  list.innerHTML = "";
  plans.forEach((plan) => {
    const monthly = activePriceFor(plan.id, "monthly");
    const annual = activePriceFor(plan.id, "annual", monthly?.currency) || activePriceFor(plan.id, "annual");
    const current = plan.code === state.workspaceEntitlement?.plan_code;
    const card = document.createElement("article");
    card.className = `plan-card${current ? " current" : ""}`;
    card.innerHTML = `
      <div class="plan-card-heading"><span class="mini-badge ${current ? "active" : ""}">${current ? "Current" : titleCase(plan.workspace_type)}</span><h4>${escapeHtml(plan.display_name)}</h4></div>
      <p>${escapeHtml(plan.description)}</p>
      <dl>
        <div><dt>Monthly</dt><dd>${monthly ? money(planInvoiceTotal(plan, monthly), monthly.currency) : plan.code === "free" ? "Free" : "Not configured"}</dd></div>
        <div><dt>Annual</dt><dd>${annual ? money(planInvoiceTotal(plan, annual), annual.currency) : plan.code === "free" ? "Free" : "Not configured"}</dd></div>
      </dl>
      ${plan.code === "free" || !currentWorkspaceIsOwned() ? "" : `<button type="button" data-select-renewal-plan="${plan.code}" ${monthly || annual ? "" : "disabled"}>${current ? "Renew plan" : "Choose plan"}</button>`}
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
    const article = document.createElement("article");
    article.className = "record-card";
    article.innerHTML = `<div class="record-main"><strong>${escapeHtml(invoice?.plan_name || "Subscription")}</strong><span>${escapeHtml(invoice?.invoice_number || "Invoice pending")} &middot; ${titleCase(invoice?.billing_period)} &middot; ${new Date(request.created_at).toLocaleDateString()}</span>${request.rejection_reason ? `<small>${escapeHtml(request.rejection_reason)}</small>` : ""}<div class="badge-row">${statusBadge(request.status)}</div></div><div class="record-side"><strong>${invoice ? money(invoice.total_amount, invoice.currency) : ""}</strong>${payment?.receipt_number ? `<small>Receipt ${escapeHtml(payment.receipt_number)}</small>` : ""}</div>`;
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
  return state.plans.filter((plan) => plan.workspace_type === workspace?.workspace_type && plan.code !== "free");
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
  $("#renewalPaymentDate").value = toDateValue(new Date());
  updateRenewalQuote();
  const dialog = $("#renewalDialog");
  if (!dialog.open) dialog.showModal();
}

function updateRenewalQuote() {
  const plan = state.plans.find((item) => item.code === $("#renewalPlan").value);
  const period = $("#renewalPeriod").value;
  const availablePrices = state.planPrices.filter((price) => price.plan_id === plan?.id && price.billing_period === period && price.is_active);
  const currencySelect = $("#renewalCurrency");
  const previousCurrency = currencySelect.value;
  currencySelect.innerHTML = "";
  availablePrices.forEach((price) => currencySelect.append(new Option(price.currency, price.currency)));
  if (availablePrices.some((price) => price.currency === previousCurrency)) currencySelect.value = previousCurrency;
  const price = availablePrices.find((item) => item.currency === currencySelect.value) || availablePrices[0] || null;
  if (price) currencySelect.value = price.currency;
  const total = planInvoiceTotal(plan, price);
  $("#renewalAmount").value = price ? total.toFixed(2) : "";
  $("#renewalSubmitButton").disabled = !price;
  const includedSeats = plan?.code === "household" ? 4 : plan?.code === "business" ? 6 : 1;
  const extraSeats = Math.max(0, Number(state.billableMemberCount || 1) - includedSeats);
  $("#renewalInvoiceSummary").innerHTML = price
    ? `<div><span>Base plan</span><strong>${money(price.amount, price.currency)}</strong></div><div><span>Additional members (${extraSeats})</span><strong>${money(extraSeats * Number(price.extra_member_amount || 0), price.currency)}</strong></div><div class="invoice-total"><span>Total submitted</span><strong>${money(total, price.currency)}</strong></div>`
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
  const amount = planInvoiceTotal(plan, price);
  const proof = $("#renewalProof").files[0] || null;
  const submitButton = $("#renewalSubmitButton");
  let proofPath = null;
  try {
    if (!workspace || !plan || !price) throw new Error("Choose a plan with an active price.");
    setSubmitting(submitButton, true, "Submitting...");
    if (proof) proofPath = await uploadSubscriptionProof(proof, workspace.id);
    await query("subscription payment submit", supabase.rpc("submit_subscription_renewal", {
      p_workspace_id: workspace.id,
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
    }));
    $("#renewalForm").reset();
    $("#renewalDialog").close();
    await loadWorkspaceSubscriptionData();
    renderSubscription();
    showToast("Payment submitted for review. Access changes only after approval.");
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

function renderReports() {
  const hasAnalytics = Boolean(
    state.workspaceEntitlement?.finance_analytics &&
    state.workspaceEntitlement?.effective_status === "active" &&
    !state.workspaceEntitlement?.read_only
  );
  $("#reportsLockNotice").classList.toggle("hidden", hasAnalytics);
  document.querySelector(".report-summary-grid").classList.toggle("hidden", !hasAnalytics);
  document.querySelector(".report-analysis-grid").classList.toggle("hidden", !hasAnalytics);
  if (!hasAnalytics) return;
  const occurrences = generateOccurrences(state.paymentItems, state.paymentRecords, state.filterMonth);
  const paid = occurrences.filter((item) => item.status === "paid").length;
  const partial = occurrences.filter((item) => item.status === "partial").length;
  const overdue = occurrences.filter((item) => item.status === "overdue").length;
  const paidRate = occurrences.length ? Math.round((paid / occurrences.length) * 100) : 0;
  const periodLabel = parseDate(monthStart(state.filterMonth)).toLocaleString("en", { month: "long", year: "numeric" });
  $("#reportMonthFilter").value = state.filterMonth;
  $("#reportPeriodLabel").textContent = `Payment performance for ${periodLabel}.`;
  $("#paidRate").textContent = `${paidRate}%`;
  $("#reportCompletionCaption").textContent = `${paid} of ${occurrences.length} payments completed`;
  $("#reportDueTotal").textContent = formatCurrencyTotals(occurrences.map((item) => ({ currency: item.item.currency, amount: item.amount })));
  $("#reportPaidTotal").textContent = formatCurrencyTotals(occurrences.map((item) => ({ currency: item.item.currency, amount: item.paid })));
  $("#reportOutstandingTotal").textContent = formatCurrencyTotals(occurrences.map((item) => ({ currency: item.item.currency, amount: item.outstanding })));
  $("#reportOverdueCaption").textContent = `${overdue} overdue payment${overdue === 1 ? "" : "s"}`;
  $("#partialCount").textContent = partial;
  $("#activeObligationCount").textContent = state.paymentItems.filter((item) => item.status !== "inactive").length;
  $("#yearExpected").textContent = formatCurrencyTotals(estimateYearTotals(state.paymentItems));
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
  renderReportTrend();
  renderCategoryReport(occurrences);
  renderPaymentRecordList();
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

function renderReportTrend() {
  const list = $("#reportTrendList");
  const months = Array.from({ length: 6 }, (_, index) => offsetMonthValue(state.filterMonth, index - 5));
  list.innerHTML = months.map((monthValue) => {
    const occurrences = generateOccurrences(state.paymentItems, state.paymentRecords, monthValue);
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
    const key = `${occurrence.item.category}:${occurrence.item.currency}`;
    acc[key] ||= { name: occurrence.item.category, amount: 0, outstanding: 0, currency: occurrence.item.currency };
    acc[key].amount += occurrence.amount;
    acc[key].outstanding += occurrence.outstanding;
    return acc;
  }, {}));
  if (!rows.length) {
    list.innerHTML = emptyState("No category data", "Reports update when monthly obligations exist.");
    return;
  }
  const max = Math.max(...rows.map((row) => row.amount), 1);
  list.innerHTML = "";
  rows.forEach((row) => {
    const item = document.createElement("article");
    item.className = "breakdown-item";
    item.innerHTML = `
      <div class="category-chip">${escapeHtml(row.name.slice(0, 2).toUpperCase())}</div>
      <div>
        <strong>${escapeHtml(row.name)}</strong>
        <span>${money(row.amount, row.currency)} due &middot; ${money(row.outstanding, row.currency)} outstanding</span>
        <div class="meter small-meter"><span style="width:${Math.min((row.amount / max) * 100, 100)}%"></span></div>
      </div>
    `;
    list.append(item);
  });
}

function renderPaymentRecordList() {
  const list = $("#paymentRecordsList");
  if (!state.paymentRecords.length) {
    list.innerHTML = emptyState("No payment records", "Partial and full payments will appear here after they are saved.");
    return;
  }
  list.innerHTML = "";
  state.paymentRecords.slice(0, 20).forEach((record) => list.append(renderFamilyPaymentRecord(record)));
}

function renderFamilyPaymentRecord(record) {
  const item = state.paymentItems.find((paymentItem) => paymentItem.id === record.payment_item_id);
  const member = memberById(record.paid_by_member_id);
  const article = document.createElement("article");
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
      <strong>${money(record.amount, item?.currency || familyCurrency())}</strong>
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
  if (state.adminTab === "dashboard") renderAdminSummary();
  if (state.adminTab === "households") renderAdminFamilies();
  if (state.adminTab === "users") renderHeads();
  if (state.adminTab === "plans") renderAdminPlans();
  if (state.adminTab === "finance") {
    renderPaymentHeadOptions();
    renderPlatformPayments();
    renderSubscriptionReviews();
  }
  if (state.adminTab === "support") {
    renderAdminNoteOptions();
    renderAdminNotes();
  }
}

function renderAdminPlans() {
  const list = $("#adminPlanList");
  list.innerHTML = "";
  state.adminPlans.forEach((plan) => {
    const activePrices = state.adminPlanPrices.filter((price) => price.plan_id === plan.id && price.is_active);
    const card = document.createElement("article");
    card.className = "plan-card";
    card.innerHTML = `
      <div class="plan-card-heading"><span class="mini-badge">${titleCase(plan.workspace_type)}</span><h4>${escapeHtml(plan.display_name)}</h4></div>
      <p>${escapeHtml(plan.description)}</p>
      <div class="plan-price-list">
        ${activePrices.length ? activePrices.map((price) => `<div><strong>${titleCase(price.billing_period)}</strong><span>${money(price.amount, price.currency)} base${Number(price.extra_member_amount) ? ` &middot; ${money(price.extra_member_amount, price.currency)} per extra member` : ""}</span></div>`).join("") : "<span>No active prices configured.</span>"}
      </div>
    `;
    list.append(card);
  });
}

function renderSubscriptionReviews() {
  const list = $("#subscriptionReviewList");
  const pending = state.adminSubscriptionPayments.filter((payment) => payment.status === "pending_review");
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
      <div class="record-main"><strong>${escapeHtml(workspace?.name || "Workspace")}</strong><span>${escapeHtml(invoice?.plan_name || "Plan")} &middot; ${titleCase(invoice?.billing_period)} &middot; reference ${escapeHtml(payment.reference_number)}</span><small>Submitted ${new Date(payment.created_at).toLocaleString()} by an authenticated workspace owner.</small><div class="badge-row">${statusBadge(payment.status)}${proof ? '<span class="mini-badge">proof attached</span>' : ""}</div></div>
      <div class="record-side"><strong>${money(payment.amount, payment.currency)}</strong><div class="row-actions">${proof ? `<button type="button" data-open-subscription-proof="${proof.id}">View proof</button>` : ""}${canReview ? `<button class="primary" type="button" data-review-subscription="${payment.id}" data-review-decision="approved">Approve</button><button type="button" data-review-subscription="${payment.id}" data-review-decision="rejected">Reject</button>` : '<span class="mini-badge">Read only</span>'}</div></div>
    `;
    list.append(article);
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
    showToast(decision === "approved" ? "Payment approved and entitlement updated." : "Payment rejected with the supplied reason.");
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
    button.classList.toggle("active", button.dataset.adminTab === state.adminTab);
  });
  document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.adminPanel !== state.adminTab);
  });
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

function renderAdminFamilies() {
  const list = $("#adminFamiliesList");
  const search = ($("#adminHouseholdSearch").value || "").toLowerCase();
  const families = state.adminFamilies.filter((family) =>
    `${family.name} ${family.owner_email || ""}`.toLowerCase().includes(search)
  );
  const generalizedWorkspaces = state.adminWorkspaces.filter((workspace) =>
    !workspace.legacy_family_id && `${workspace.name} ${workspace.workspace_type}`.toLowerCase().includes(search)
  );
  if (!families.length && !generalizedWorkspaces.length) {
    list.innerHTML = emptyState("No workspaces found", "Every registered user receives a Personal workspace automatically.");
    return;
  }
  list.innerHTML = "";
  families.forEach((family) => {
    const head = findHeadForFamily(family);
    const ownerFamilyCount = state.adminFamilies.filter((item) =>
      (item.owner_email || "").toLowerCase() === (family.owner_email || "").toLowerCase()
    ).length;
    const itemCount = state.adminPaymentItems.filter((item) => item.family_id === family.id && item.status !== "inactive").length;
    const familyMembers = state.adminMembers.filter((member) => member.family_id === family.id);
    const memberCount = familyMembers.filter((member) => member.status !== "inactive").length;
    const removedMemberCount = familyMembers.filter((member) => member.status === "inactive").length;
    const occurrences = generateOccurrences(
      state.adminPaymentItems.filter((item) => item.family_id === family.id),
      state.adminPaymentRecords.filter((record) => record.family_id === family.id),
      state.filterMonth
    );
    const overdue = occurrences.filter((item) => item.status === "overdue").length;
    const article = document.createElement("article");
    article.className = "record-card admin-household-card";
    article.innerHTML = `
      <div class="record-main">
        <strong>${escapeHtml(family.name)}</strong>
        <span>${escapeHtml(family.owner_email || "Owner email not stored")} &middot; ${memberCount} active members${removedMemberCount ? ` &middot; ${removedMemberCount} removed` : ""} &middot; ${itemCount} obligations</span>
        <div class="badge-row">
          ${statusBadge(head?.can_add_members ? "members unlocked" : "member access locked")}
          ${statusBadge(head?.status || "free signup")}
          ${statusBadge(head?.billing_status || "payment not set")}
          <span class="mini-badge">${ownerFamilyCount}/${Number(head?.family_limit ?? 0)} family limit</span>
          ${overdue ? statusBadge(`${overdue} overdue`) : '<span class="mini-badge active">clear</span>'}
        </div>
      </div>
      <div class="record-side">
        <strong>${formatOccurrenceCurrencyTotals(occurrences)}</strong>
        <div class="row-actions">
          <button type="button" data-toggle-family-member-access="${family.id}" data-next-member-access="${head?.can_add_members ? "false" : "true"}">${head?.can_add_members ? "Lock members" : "Unlock members"}</button>
          ${head ? `<button type="button" data-toggle-family-status="${family.id}" data-next-status="${head.status === "active" ? "suspended" : "active"}">${head.status === "active" ? "Suspend" : "Reactivate"}</button>` : ""}
        </div>
      </div>
    `;
    list.append(article);
  });
  generalizedWorkspaces.forEach((workspace) => {
    const subscription = state.adminSubscriptions.find((item) => item.workspace_id === workspace.id);
    const plan = state.adminPlans.find((item) => item.id === subscription?.plan_id);
    const owner = state.adminProfiles.find((profile) => profile.id === workspace.owner_id);
    const article = document.createElement("article");
    article.className = "record-card admin-household-card";
    article.innerHTML = `
      <div class="record-main"><strong>${escapeHtml(workspace.name)}</strong><span>${escapeHtml(owner?.email || workspace.owner_id)} &middot; ${titleCase(workspace.workspace_type)} workspace</span><div class="badge-row">${statusBadge(workspace.status)}${statusBadge(plan?.display_name || "Plan not set")}</div></div>
      <div class="record-side"><small>Created ${new Date(workspace.created_at).toLocaleDateString()}</small></div>
    `;
    list.append(article);
  });
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
        </div>
      </div>
      <div class="record-side">
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
  if (!state.payments.length) {
    list.innerHTML = emptyState("No legacy payment notes", "New subscription payments are submitted by workspace owners and reviewed above.");
    return;
  }
  list.innerHTML = "";
  state.payments.forEach((payment) => list.append(renderPlatformPayment(payment, true)));
}

function renderPlatformPayment(payment, withActions = false) {
  const article = document.createElement("article");
  article.className = "record-card";
  article.innerHTML = `
    <div class="date-chip"><strong>${parseDate(payment.payment_date).getDate()}</strong><span>${parseDate(payment.payment_date).toLocaleString("en", { month: "short" })}</span></div>
    <div class="record-main"><strong>${escapeHtml(payment.family_heads?.full_name || "Unknown user")}</strong><span>${escapeHtml(payment.family_heads?.email || "")} &middot; ${escapeHtml(payment.payment_method)} &middot; ${escapeHtml(payment.reference_number || "No reference")}</span></div>
    <div class="record-side"><strong>${money(payment.amount, payment.currency)}</strong>${withActions ? `<button type="button" data-delete-payment="${payment.id}">Delete</button>` : ""}</div>
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
  renderPaymentCurrencyOptions("", state.family?.currency || "USD");
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
    acc[row.currency || "USD"] = (acc[row.currency || "USD"] || 0) + Number(row.amount || 0);
    return acc;
  }, {});
  return Object.entries(totals).map(([currency, amount]) => money(amount, currency)).join(" / ");
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

  const selectedRenewalPlan = event.target.closest("[data-select-renewal-plan]");
  if (selectedRenewalPlan) openRenewalDialog(selectedRenewalPlan.dataset.selectRenewalPlan);

  const subscriptionReview = event.target.closest("[data-review-subscription]");
  if (subscriptionReview) await reviewSubscriptionPayment(subscriptionReview.dataset.reviewSubscription, subscriptionReview.dataset.reviewDecision);

  const subscriptionProof = event.target.closest("[data-open-subscription-proof]");
  if (subscriptionProof) await openSubscriptionProof(subscriptionProof.dataset.openSubscriptionProof);

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
$("#planPriceForm").addEventListener("submit", savePlanPrice);
$("#renewalForm").addEventListener("submit", submitSubscriptionRenewal);
$("#renewalPlan").addEventListener("change", updateRenewalQuote);
$("#renewalPeriod").addEventListener("change", updateRenewalQuote);
$("#renewalCurrency").addEventListener("change", updateRenewalQuote);
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
$("#statusFilter").addEventListener("change", (event) => {
  state.filterStatus = event.target.value;
  renderFamilyApp();
});
$("#adminHouseholdSearch").addEventListener("input", renderAdminFamilies);
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
