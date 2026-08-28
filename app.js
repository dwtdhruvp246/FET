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
  headApproval: null,
  families: [],
  family: null,
  members: [],
  paymentItems: [],
  paymentRecords: [],
  familyInvitations: [],
  notifications: [],
  heads: [],
  adminFamilies: [],
  adminMembers: [],
  adminPaymentItems: [],
  adminPaymentRecords: [],
  payments: [],
  adminNotes: [],
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

let deferredInstallPrompt = null;

const PAYMENT_PROOF_BUCKET = "payment-proofs";
const PAYMENT_PROOF_MAX_BYTES = 10 * 1024 * 1024;
const PAYMENT_PROOF_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

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

const adminTabs = new Set(["dashboard", "households", "users", "finance", "support"]);
const familyTabs = new Set(["dashboard", "payments", "reports", "members", "settings"]);
const currencyNames = {
  USD: "en-US",
  ZAR: "en-ZA",
  EUR: "de-DE",
  GBP: "en-GB",
  CAD: "en-CA",
  AUD: "en-AU"
};

const today = new Date();
$("#paymentDate").value = toDateValue(today);
$("#monthFilter").value = state.filterMonth;
$("#startDate").value = toDateValue(today);
$("#recordPaymentDate").value = toDateValue(today);
registerServiceWorker();

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  });
}

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function updateInstallButtons() {
  document.querySelectorAll("[data-install-app]").forEach((button) => {
    button.classList.toggle("hidden", isStandaloneApp());
  });
}

async function installApp() {
  if (isStandaloneApp()) {
    showToast("Mushavo Budget is already installed on this device.");
    return;
  }
  if (!deferredInstallPrompt) {
    showToast("If the install prompt is not available, use your browser menu or Share button and choose Add to Home Screen.");
    return;
  }
  deferredInstallPrompt.prompt();
  const result = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  updateInstallButtons();
  showToast(result.outcome === "accepted" ? "Mushavo Budget install started." : "Install was dismissed.");
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
  return new Intl.NumberFormat(currencyNames[currency] || "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(Number(amount || 0));
}

function setView(viewName) {
  Object.values(views).forEach((view) => view.classList.add("hidden"));
  if (viewName) views[viewName].classList.remove("hidden");
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
  const sharedTables = ["profiles", "family_heads", "families", "family_members", "payment_items", "payment_records", "family_invitations", "notifications"];
  if (!state.isAdmin) return sharedTables;
  return [...sharedTables, "payments", "admin_support_notes"];
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
    await loadAccess();
    await loadFamily();
    await loadFamilyData();
    if (state.session?.user?.id !== sessionId) return;
    renderFamilyApp();
  } finally {
    realtime.refreshInFlight = false;
  }
}

async function query(label, promise) {
  const { data, error } = await promise;
  if (error) {
    console.error(label, error);
    throw new Error(error.message);
  }
  return data;
}

async function init() {
  setView("loading");
  if (!isConfigured) {
    setView("configWarning");
    return;
  }

  applyRouteFromHash();
  const { data } = await supabase.auth.getSession();
  state.session = data.session;

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "INITIAL_SESSION") return;
    const previousSession = state.session;
    state.session = session;

    if (session && isSameAuthUser(previousSession, session)) {
      if (session.access_token) supabase.realtime.setAuth(session.access_token);
      return;
    }

    if (session) {
      setView("loading");
      resetState();
      state.session = session;
      await loadApp();
      return;
    }
    resetState();
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setView("auth");
  });

  if (state.session) {
    await loadApp();
  } else {
    setView("auth");
    showSignupSuccessMessage();
  }
}

function resetState() {
  stopRealtime();
  state.session = null;
  state.profile = null;
  state.isAdmin = false;
  state.headApproval = null;
  state.families = [];
  state.family = null;
  state.members = [];
  state.paymentItems = [];
  state.paymentRecords = [];
  state.familyInvitations = [];
  state.notifications = [];
  state.heads = [];
  state.adminFamilies = [];
  state.adminMembers = [];
  state.adminPaymentItems = [];
  state.adminPaymentRecords = [];
  state.payments = [];
  state.adminNotes = [];
  state.adminTab = "dashboard";
  state.familyTab = "dashboard";
  state.editingObligationId = null;
}

async function loadApp() {
  assertSupabase();
  await ensureProfile();
  await loadAccess();

  if (state.isAdmin) {
    await loadAdminData();
    syncRouteForWorkspace("admin");
    setView("admin");
    renderAdmin();
    startRealtime();
    return;
  }

  await Promise.all([loadInvitations(), loadNotifications()]);

  if (state.headApproval?.status === "suspended") {
    if (hasJoinableFamilyInvitation()) {
      showToast("You can join an invited family without an active subscription.");
    } else {
      setView("suspended");
      stopRealtime();
      return;
    }
  }

  await loadFamily();
  await loadFamilyData();
  syncRouteForWorkspace("family");
  setView("app");
  renderFamilyApp();
  startRealtime();
}

async function ensureProfile() {
  const user = state.session.user;
  const fullName =
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Household owner";

  await query(
    "profile upsert",
    supabase.from("profiles").upsert({ id: user.id, full_name: fullName, email: user.email?.toLowerCase() }, { onConflict: "id" })
  );

  state.profile = await query(
    "profile load",
    supabase.from("profiles").select("*").eq("id", user.id).single()
  );
}

async function loadAccess() {
  const userEmail = state.session.user.email?.toLowerCase();
  const adminRows = await query(
    "admin access load",
    supabase.from("app_admins").select("*").eq("user_id", state.session.user.id).limit(1)
  );
  state.isAdmin = adminRows.length > 0;

  const headRows = await query(
    "head access load",
    supabase.from("family_heads").select("*").ilike("email", userEmail).limit(1)
  );
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
  state.family =
    state.families.find((family) => family.id === storedFamilyId) ||
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
  else window.localStorage.removeItem(key);
}

async function selectFamily(familyId) {
  const family = state.families.find((item) => item.id === familyId);
  if (!family || family.id === state.family?.id) return;
  state.family = family;
  state.editingObligationId = null;
  persistSelectedFamily();
  await loadFamilyData();
  renderFamilyApp();
}

async function loadFamilyData() {
  await Promise.all([loadMembers(), loadPaymentItems(), loadPaymentRecords(), loadInvitations(), loadNotifications()]);
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

async function loadAdminData() {
  state.heads = await query(
    "heads load",
    supabase.from("family_heads").select("*").order("created_at", { ascending: false })
  );
  state.adminFamilies = await query(
    "admin families load",
    supabase.from("families").select("*").order("created_at", { ascending: false })
  );
  state.adminMembers = await query(
    "admin members load",
    supabase.from("family_members").select("*").order("created_at", { ascending: true })
  );
  state.adminPaymentItems = await query(
    "admin payment items load",
    supabase.from("payment_items").select("*").order("created_at", { ascending: false })
  );
  state.adminPaymentRecords = await query(
    "admin payment records load",
    supabase.from("payment_records").select("*").order("payment_date", { ascending: false })
  );
  state.payments = await query(
    "payments load",
    supabase
      .from("payments")
      .select("*, family_heads(full_name, email, billing_status, status)")
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false })
  );
  state.adminNotes = await query(
    "admin notes load",
    supabase.from("admin_support_notes").select("*").order("created_at", { ascending: false })
  );
}

function renderFamilyApp() {
  renderFamilyTabs();
  renderFamilyHeader();
  renderMemberAccess();
  renderMemberOptions();
  renderPaymentScope();
  renderDashboard();
  renderObligations();
  renderMembers();
  renderInvitations();
  renderSettings();
  renderReports();
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
  const billing = hasActiveMembership() ? "Subscription - Active" : "Active - Free";
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
  return Boolean(
    family &&
    family.owner_id === state.session?.user?.id &&
    hasActiveMembership() &&
    state.headApproval?.can_add_members
  );
}

function renderFamilySelectors() {
  document.querySelectorAll("[data-family-selector]").forEach((select) => {
    select.innerHTML = "";
    if (!state.families.length) {
      select.append(new Option("Personal budget", ""));
      select.disabled = true;
      return;
    }
    state.families.forEach((family) => select.append(new Option(family.name, family.id)));
    select.value = state.family?.id || state.families[0].id;
    select.disabled = state.families.length < 2;
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
  $("#memberFamilyForm").querySelectorAll("input, select, button").forEach((field) => {
    field.disabled = !allowedToCreate;
  });
  $("#memberFamilyForm").closest(".tool-panel").classList.toggle("hidden", !allowedToCreate);

  const inviteFamily = $("#inviteFamily");
  const previousInviteFamily = inviteFamily.value;
  inviteFamily.innerHTML = "";
  manageableFamilies.forEach((family) => inviteFamily.append(new Option(family.name, family.id)));
  inviteFamily.value = manageableFamilies.some((family) => family.id === previousInviteFamily)
    ? previousInviteFamily
    : manageableFamilies.find((family) => family.id === state.family?.id)?.id || manageableFamilies[0]?.id || "";
  const allowedToInvite = manageableFamilies.length > 0;
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
  if (days <= Number(item.reminder_days_before || 3)) return "due-soon";
  return "upcoming";
}

function renderDashboard() {
  const occurrences = generateOccurrences(state.paymentItems, state.paymentRecords, state.filterMonth);
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
}

function renderPriorityDueList(occurrences) {
  const list = $("#priorityDueList");
  const statusPriority = { overdue: 0, partial: 1, "due-soon": 2, upcoming: 3, paid: 4 };
  const monthGroups = [];

  for (let monthOffset = 0; monthOffset <= 6 && monthGroups.length < 4; monthOffset += 1) {
    const monthValue = offsetMonthValue(state.filterMonth, monthOffset);
    const monthOccurrences = (monthOffset === 0
      ? occurrences
      : generateOccurrences(state.paymentItems, state.paymentRecords, monthValue))
      .filter((item) => item.status !== "paid")
      .sort((a, b) => statusPriority[a.status] - statusPriority[b.status] || a.dueDate.localeCompare(b.dueDate))
      .slice(0, monthOffset === 0 ? 6 : 4);

    if (monthOccurrences.length) monthGroups.push({ monthOffset, monthValue, occurrences: monthOccurrences });
  }

  if (!monthGroups.length) {
    list.innerHTML = emptyState("Nothing due", "Upcoming recurring payments will appear here grouped by month.");
    return;
  }

  list.innerHTML = "";
  monthGroups.forEach((group, groupIndex) => {
    const section = document.createElement("section");
    section.className = `due-month-group month-accent-${groupIndex % 4}`;
    section.dataset.month = group.monthValue;
    const monthTitle = parseDate(monthStart(group.monthValue)).toLocaleString("en", {
      month: "long",
      year: "numeric"
    });
    const totalOutstanding = formatCurrencyTotals(group.occurrences.map((occurrence) => ({
      currency: occurrence.item.currency,
      amount: occurrence.outstanding
    })));
    section.innerHTML = `
      <header class="due-month-header">
        <div>
          <span>${group.monthOffset === 0 ? "Selected month" : "Upcoming month"}</span>
          <h4>${escapeHtml(monthTitle)}</h4>
        </div>
        <small>${group.occurrences.length} payment${group.occurrences.length === 1 ? "" : "s"} &middot; ${escapeHtml(totalOutstanding)} outstanding</small>
      </header>
      <div class="due-month-items"></div>
    `;
    const items = section.querySelector(".due-month-items");
    group.occurrences.forEach((occurrence) => items.append(renderOccurrenceCard(occurrence, true)));
    list.append(section);
  });
}

function renderMemberResponsibility(occurrences) {
  const list = $("#memberResponsibilityList");
  const rows = activeMembers().map((member) => {
    const assigned = occurrences.filter((occurrence) => occurrence.item.responsible_member_id === member.id);
    return {
      member,
      total: assigned.reduce((sum, item) => sum + item.amount, 0),
      outstanding: assigned.reduce((sum, item) => sum + item.outstanding, 0),
      count: assigned.length
    };
  }).filter((row) => row.count > 0);

  if (!rows.length) {
    list.innerHTML = emptyState("No assigned dues", "Assign members to recurring obligations to see responsibility totals.");
    return;
  }

  const maxTotal = Math.max(...rows.map((row) => row.total), 1);
  list.innerHTML = "";
  rows.forEach((row) => {
    const percent = Math.min((row.total / maxTotal) * 100, 100);
    const item = document.createElement("article");
    item.className = "breakdown-item";
    item.innerHTML = `
      <div class="avatar" style="background:${escapeHtml(row.member.avatar_color || "#2563EB")}">${memberInitials(row.member.name)}</div>
      <div>
        <strong>${escapeHtml(row.member.name)}</strong>
        <span>${row.count} due items &middot; ${money(row.outstanding, familyCurrency())} outstanding</span>
        <div class="meter small-meter"><span style="width:${percent}%"></span></div>
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
  article.innerHTML = `
    <div class="record-main">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(item.category)} &middot; ${recurrenceLabel(item)} &middot; Due day ${item.due_day}</span>
      <div class="badge-row">
        ${statusBadge(item.status || "active")}
        <span class="mini-badge">${escapeHtml(item.visibility === "family" ? "Family" : "Personal")}</span>
        <span class="mini-badge">${escapeHtml(member?.name || "No assigned member")}</span>
        <span class="mini-badge">Remind ${item.reminder_days_before || 0} days before</span>
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

function renderOccurrenceCard(occurrence, withAction = false) {
  const member = memberById(occurrence.item.responsible_member_id);
  const article = document.createElement("article");
  article.className = "record-card";
  article.innerHTML = `
    <div class="date-chip">
      <strong>${parseDate(occurrence.dueDate).getDate()}</strong>
      <span>${parseDate(occurrence.dueDate).toLocaleString("en", { month: "short" })}</span>
    </div>
    <div class="record-main">
      <strong>${escapeHtml(occurrence.item.name)}</strong>
      <span>${escapeHtml(member?.name || "Household account")} &middot; ${escapeHtml(occurrence.item.category)} &middot; ${money(occurrence.outstanding, occurrence.item.currency)} outstanding</span>
      <div class="badge-row">
        ${statusBadge(occurrence.status)}
        <span class="mini-badge">${money(occurrence.paid, occurrence.item.currency)} paid</span>
      </div>
    </div>
    <div class="record-side">
      <strong>${money(occurrence.amount, occurrence.item.currency)}</strong>
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
  const plan = hasPaidPlan() ? "Starter - Active" : hasJoinableFamilyInvitation() ? "Family member - Free" : "Active - Free";
  const paymentCount = userCreatedPaymentCount();
  const canManageAnyFamily = ownedFamilies().some((family) => canManageMembersForFamily(family.id));
  $("#settingsPlanBadge").textContent = plan;
  $("#settingsPlanBadge").className = `mini-badge ${badgeClass(plan)}`;
  $("#settingsPaymentLimit").textContent = hasPaidPlan() ? "Unlimited payments unlocked" : `${paymentCount}/5 free payments used`;
  $("#settingsMemberAccess").textContent = canManageAnyFamily ? "Can invite family members" : "Can join invited families";
  $("#settingsEmail").textContent = state.session.user.email || "-";
  renderNotifications();
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
        ${notification.read_at ? "" : `<button type="button" data-read-notification="${notification.id}">Mark read</button>`}
      </div>
    `;
    list.append(article);
  });
}

function notificationDueOccurrences() {
  const currentMonth = toMonthValue(new Date());
  return [
    ...generateOccurrences(state.paymentItems, state.paymentRecords, currentMonth),
    ...generateOccurrences(state.paymentItems, state.paymentRecords, offsetMonthValue(currentMonth, 1))
  ]
    .filter((occurrence) => ["overdue", "due-soon", "partial"].includes(occurrence.status))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 8);
}

function openNotificationDialog() {
  renderNotifications();
  const dialog = $("#notificationDialog");
  if (dialog && !dialog.open) dialog.showModal();
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
    await loadFamilyData();
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
  const occurrences = generateOccurrences(state.paymentItems, state.paymentRecords, state.filterMonth);
  const paid = occurrences.filter((item) => item.status === "paid").length;
  const partial = occurrences.filter((item) => item.status === "partial").length;
  const paidRate = occurrences.length ? Math.round((paid / occurrences.length) * 100) : 0;
  $("#paidRate").textContent = `${paidRate}%`;
  $("#partialCount").textContent = partial;
  $("#activeObligationCount").textContent = state.paymentItems.filter((item) => item.status !== "inactive").length;
  $("#yearExpected").textContent = formatCurrencyTotals(estimateYearTotals(state.paymentItems));
  renderCategoryReport(occurrences);
  renderPaymentRecordList();
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
    const key = occurrence.item.category;
    acc[key] ||= { name: key, amount: 0, outstanding: 0, currency: occurrence.item.currency };
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
  renderAdminSummary();
  renderHeads();
  renderPaymentHeadOptions();
  renderPlatformPayments();
  renderAdminFamilies();
  renderAdminNoteOptions();
  renderAdminNotes();
}

function renderAdminTabs() {
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminTab === state.adminTab);
  });
  document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.adminPanel !== state.adminTab);
  });
}

function renderAdminSummary() {
  const occurrences = generateOccurrences(state.adminPaymentItems, state.adminPaymentRecords, state.filterMonth);
  $("#adminEmail").textContent = state.session.user.email || "-";
  $("#adminFamilyCount").textContent = state.adminFamilies.length;
  $("#adminOverdueCount").textContent = occurrences.filter((item) => item.status === "overdue").length;
  $("#adminDueTotal").textContent = formatOccurrenceCurrencyTotals(occurrences);
  $("#adminRevenueTotal").textContent = formatCurrencyTotals(state.payments);
  $("#adminPaymentCount").textContent = `${state.payments.length} payments`;
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
  if (!families.length) {
    list.innerHTML = emptyState("No households found", "New users appear here after creating a household.");
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
}

function renderHeads() {
  const list = $("#headsList");
  if (!state.heads.length) {
    list.innerHTML = emptyState("No configured users", "Household owners can be configured manually or from the Households page.");
    return;
  }
  list.innerHTML = "";
  state.heads.forEach((head) => {
    const ownedCount = state.adminFamilies.filter((family) =>
      (family.owner_email || "").toLowerCase() === head.email.toLowerCase()
    ).length;
    const article = document.createElement("article");
    article.className = "record-card";
    article.innerHTML = `
      <div class="record-main">
        <strong>${escapeHtml(head.full_name)}</strong>
        <span>${escapeHtml(head.email)} &middot; ${money(head.monthly_fee, head.fee_currency || "USD")} monthly</span>
        <div class="badge-row">${statusBadge(head.status)}${statusBadge(head.billing_status)}${statusBadge(head.can_add_members ? "members unlocked" : "members locked")}<span class="mini-badge">${ownedCount}/${Number(head.family_limit ?? 1)} families</span></div>
      </div>
      <div class="record-side">
        <div class="row-actions">
          <label class="inline-number-control">Family limit<input data-family-limit-input="${head.id}" type="number" min="0" max="100" step="1" value="${Number(head.family_limit ?? 1)}" /></label>
          <button type="button" data-save-family-limit="${head.id}">Save limit</button>
          <button type="button" data-toggle-member-access="${head.id}" data-next-member-access="${head.can_add_members ? "false" : "true"}">${head.can_add_members ? "Lock members" : "Unlock members"}</button>
          <button type="button" data-toggle-head="${head.id}" data-next-status="${head.status === "active" ? "suspended" : "active"}">${head.status === "active" ? "Suspend" : "Reactivate"}</button>
          <button type="button" data-delete-head="${head.id}">Revoke</button>
        </div>
      </div>
    `;
    list.append(article);
  });
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
    list.innerHTML = emptyState("No payment history", "Record manual platform payments as cash, EFT, card, bank deposit, or other.");
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
  try {
    setView("loading");
    await query("sign in", supabase.auth.signInWithPassword({ email, password }));
    showToast("Signed in.");
  } catch (error) {
    setView("auth");
    showToast(error.message);
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
  if (!state.editingObligationId && !hasPaidPlan() && userCreatedPaymentCount() >= 5) {
    showToast("Free accounts can add up to 5 payments. Ask the admin to unlock your plan for more.");
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
    resetObligationForm();
    await loadFamilyData();
    renderFamilyApp();
  } catch (error) {
    showToast(error.message);
  }
}

function startEditObligation(itemId) {
  const item = state.paymentItems.find((paymentItem) => paymentItem.id === itemId);
  if (!item) return;
  state.editingObligationId = item.id;
  state.familyTab = "payments";
  setRoute("family", "payments");
  renderFamilyTabs();
  $("#obligationTitle").textContent = "Edit payment";
  $("#obligationSubmitButton").textContent = "Save changes";
  $("#cancelEditObligationButton").classList.remove("hidden");
  $("#obligationName").value = item.name;
  $("#obligationAmount").value = item.amount;
  $("#obligationCurrency").value = item.currency;
  $("#paymentScope").value = item.visibility || (item.family_id ? "family" : "personal");
  $("#obligationCategory").value = item.category;
  $("#obligationMember").value = item.responsible_member_id || "";
  $("#recurrenceType").value = item.recurrence_type;
  $("#recurrenceInterval").value = item.recurrence_interval || 1;
  $("#dueDay").value = item.due_day || 1;
  $("#startDate").value = item.start_date;
  $("#reminderDays").value = item.reminder_days_before || 0;
  $("#obligationNotes").value = item.notes || "";
}

function resetObligationForm() {
  state.editingObligationId = null;
  $("#obligationForm").reset();
  $("#startDate").value = toDateValue(new Date());
  $("#recurrenceInterval").value = 1;
  $("#dueDay").value = 1;
  $("#reminderDays").value = 3;
  $("#obligationCurrency").value = state.family?.currency || "USD";
  $("#paymentScope").value = state.family ? "family" : "personal";
  $("#obligationTitle").textContent = "Add payment";
  $("#obligationSubmitButton").textContent = "Save payment";
  $("#cancelEditObligationButton").classList.add("hidden");
  renderPaymentScope();
}

function hasPaidPlan() {
  return hasActiveMembership();
}

function userCreatedPaymentCount() {
  const userId = state.session?.user?.id;
  return state.paymentItems.filter((item) => item.created_by === userId && item.status !== "inactive").length;
}

function openRecordPayment(key) {
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
  const payload = {
    full_name: $("#headName").value.trim(),
    email,
    created_by: state.session.user.id,
    monthly_fee: Number($("#headMonthlyFee").value || 0),
    fee_currency: $("#headFeeCurrency").value,
    billing_status: $("#headBillingStatus").value,
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
    const headUpdate = { billing_status: "paid", last_payment_at: new Date().toISOString() };
    if ($("#paidUntil").value) headUpdate.paid_until = $("#paidUntil").value;
    await query("head billing update", supabase.from("family_heads").update(headUpdate).eq("id", head.id));
    $("#paymentForm").reset();
    $("#paymentDate").value = toDateValue(new Date());
    await loadAdminData();
    renderAdmin();
    showToast("Platform payment recorded.");
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

function exportCsv() {
  const occurrences = selectedOccurrences();
  if (!occurrences.length) {
    showToast("Nothing to export for this filter.");
    return;
  }
  const rows = [
    ["Due date", "Payment", "Responsible", "Status", "Amount due", "Paid", "Outstanding"],
    ...occurrences.map((occurrence) => [
      occurrence.dueDate,
      occurrence.item.name,
      memberById(occurrence.item.responsible_member_id)?.name || "Household account",
      occurrence.status,
      occurrence.amount,
      occurrence.paid,
      occurrence.outstanding
    ])
  ];
  const csv = rows.map((row) => row.map((value) => `"${`${value}`.replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mushavo-budget-${state.filterMonth}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    showToast("Browser notifications are not supported on this device.");
    return;
  }
  const result = await Notification.requestPermission();
  if (result === "granted") {
    showToast("Reminder notifications enabled for this browser.");
    showDueBrowserNotifications();
  } else {
    showToast("Notifications were not enabled. In-app reminders still work.");
  }
}

function showDueBrowserNotifications() {
  if (Notification.permission !== "granted") return;
  const dueItems = generateOccurrences(state.paymentItems, state.paymentRecords, state.filterMonth)
    .filter((occurrence) => ["overdue", "due-soon", "partial"].includes(occurrence.status))
    .slice(0, 5);
  dueItems.forEach((occurrence) => {
    const title = occurrence.status === "overdue" ? "Payment overdue" : "Payment reminder";
    new Notification(title, {
      body: `${occurrence.item.name}: ${money(occurrence.outstanding, occurrence.item.currency)} outstanding`,
      tag: `mushavo-${occurrence.key}`
    });
  });
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
  if (event.target.dataset.closeConfirmDialog !== undefined) $("#confirmDialog").close();
  if (event.target.closest("[data-close-notifications]")) $("#notificationDialog").close();
  if (event.target.dataset.openDrawer !== undefined) openDrawer();
  if (event.target.dataset.closeDrawer !== undefined) closeDrawer();
  if (event.target.closest("[data-open-notifications]")) openNotificationDialog();
  if (event.target.closest("[data-enable-notifications]")) await enableNotifications();
  if (event.target.closest("[data-install-app]")) await installApp();
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

  const adminTab = event.target.dataset.adminTab;
  if (adminTab) {
    state.adminTab = adminTab;
    setRoute("admin", adminTab);
    renderAdminTabs();
    closeDrawer();
  }

  const familyTab = event.target.dataset.familyTab;
  if (familyTab) {
    state.familyTab = familyTab;
    setRoute("family", familyTab);
    renderFamilyTabs();
    closeDrawer();
  }

  const recordPaymentKey = event.target.dataset.recordPayment;
  if (recordPaymentKey) {
    if ($("#notificationDialog").open) $("#notificationDialog").close();
    openRecordPayment(recordPaymentKey);
  }

  const openProofId = event.target.dataset.openProof;
  if (openProofId) await openPaymentProof(openProofId);

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
    renderSettings();
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
$("#cancelEditObligationButton").addEventListener("click", resetObligationForm);
$("#signOutButton").addEventListener("click", async () => supabase.auth.signOut());
$("#adminSignOutButton").addEventListener("click", async () => supabase.auth.signOut());
$("#suspendedSignOutButton").addEventListener("click", async () => supabase.auth.signOut());
$("#exportCsvButton").addEventListener("click", exportCsv);
$("#enableNotificationsButton").addEventListener("click", enableNotifications);
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
  if (state.isAdmin) renderAdminTabs();
  if (state.session && !state.isAdmin) renderFamilyTabs();
});

window.addEventListener("beforeunload", stopRealtime);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallButtons();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  updateInstallButtons();
  showToast("Mushavo Budget was installed.");
});

updateInstallButtons();

init().catch((error) => {
  console.error(error);
  showToast(error.message);
  if (state.session) {
    showAppError(error);
  } else {
    setView("auth");
  }
});
