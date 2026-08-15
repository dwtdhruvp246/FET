import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.9/+esm";

const config = window.EXPENSE_TRACKER_CONFIG || {};
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
  family: null,
  members: [],
  paymentItems: [],
  paymentRecords: [],
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

const $ = (selector) => document.querySelector(selector);

const views = {
  loading: $("#loadingView"),
  configWarning: $("#configWarning"),
  appError: $("#appErrorView"),
  auth: $("#authView"),
  signup: $("#signupView"),
  setup: $("#setupView"),
  suspended: $("#suspendedView"),
  admin: $("#adminView"),
  app: $("#appView")
};

const adminTabs = new Set(["dashboard", "households", "users", "finance", "support"]);
const familyTabs = new Set(["dashboard", "obligations", "schedule", "my", "members", "reports"]);
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
    return "That record already exists. Update the existing one instead.";
  }
  return text;
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
    state.session = session;
    if (session) {
      setView("loading");
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
  }
}

function resetState() {
  state.profile = null;
  state.isAdmin = false;
  state.headApproval = null;
  state.family = null;
  state.members = [];
  state.paymentItems = [];
  state.paymentRecords = [];
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
    return;
  }

  if (state.headApproval?.status === "suspended") {
    setView("suspended");
    return;
  }

  await loadFamily();
  if (!state.family) {
    setView("setup");
    return;
  }

  await loadFamilyData();
  syncRouteForWorkspace("family");
  setView("app");
  renderFamilyApp();
}

async function ensureProfile() {
  const user = state.session.user;
  const fullName =
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Household owner";

  await query(
    "profile upsert",
    supabase.from("profiles").upsert({ id: user.id, full_name: fullName }, { onConflict: "id" })
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
  const families = await query(
    "family load",
    supabase.from("families").select("*").order("created_at", { ascending: true }).limit(1)
  );
  state.family = families[0] || null;
}

async function loadFamilyData() {
  await Promise.all([loadMembers(), loadPaymentItems(), loadPaymentRecords()]);
}

async function loadMembers() {
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
  state.paymentItems = await query(
    "payment items load",
    supabase
      .from("payment_items")
      .select("*")
      .eq("family_id", state.family.id)
      .order("created_at", { ascending: false })
  );
}

async function loadPaymentRecords() {
  state.paymentRecords = await query(
    "payment records load",
    supabase
      .from("payment_records")
      .select("*")
      .eq("family_id", state.family.id)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false })
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
  renderDashboard();
  renderObligations();
  renderSchedule();
  renderMyPayments();
  renderMembers();
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
  $("#householdTitle").textContent = state.family.name;
  $("#mobileHouseholdTitle").textContent = state.family.name;
  const billing = state.headApproval?.billing_status || "free";
  $("#headBillingBadge").textContent = billing;
  $("#headBillingBadge").className = `mini-badge ${badgeClass(billing)}`;
  $("#dashboardMonthTitle").textContent = parseDate(monthStart(state.filterMonth)).toLocaleString("en", {
    month: "long",
    year: "numeric"
  });
}

function canAddMembers() {
  return Boolean(state.headApproval?.status === "active" && state.headApproval?.can_add_members);
}

function renderMemberAccess() {
  const allowed = canAddMembers();
  $("#memberAccessNotice").classList.toggle("hidden", allowed);
  $("#memberForm").querySelectorAll("input, select, button").forEach((field) => {
    field.disabled = !allowed;
  });
}

function renderMemberOptions() {
  const obligationMember = $("#obligationMember");
  const recordPaidBy = $("#recordPaidBy");
  obligationMember.innerHTML = `<option value="">Household account</option>`;
  recordPaidBy.innerHTML = `<option value="">Household account</option>`;

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
  const currency = state.family.currency || "USD";
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
  const priority = occurrences
    .filter((item) => ["overdue", "due-soon", "partial"].includes(item.status))
    .slice(0, 8);
  if (!priority.length) {
    list.innerHTML = emptyState("Nothing urgent", "Upcoming recurring payments will appear here before they are due.");
    return;
  }
  list.innerHTML = "";
  priority.forEach((occurrence) => list.append(renderOccurrenceCard(occurrence, true)));
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
        <span>${row.count} due items &middot; ${money(row.outstanding, state.family.currency)} outstanding</span>
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
        <span class="mini-badge">${escapeHtml(member?.name || "Household account")}</span>
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
  if (!matchingMember) return [];
  return occurrences.filter((occurrence) => occurrence.item.responsible_member_id === matchingMember.id);
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
      ${withAction && occurrence.status !== "paid" ? `<button class="primary" type="button" data-record-payment="${occurrence.key}">Record payment</button>` : ""}
    </div>
  `;
  return article;
}

function renderMembers() {
  const list = $("#membersList");
  if (!state.members.length) {
    list.innerHTML = emptyState("No family members yet", "Add members with email or phone details so reminders can target the right person.");
    return;
  }
  list.innerHTML = "";
  state.members.forEach((member) => {
    const assignedCount = state.paymentItems.filter((item) => item.responsible_member_id === member.id).length;
    const item = document.createElement("article");
    item.className = "record-card";
    item.innerHTML = `
      <div class="avatar" style="background:${escapeHtml(member.avatar_color || "#2563EB")}">${memberInitials(member.name)}</div>
      <div class="record-main">
        <strong>${escapeHtml(member.name)}</strong>
        <span>${escapeHtml(member.role)} &middot; ${escapeHtml(member.email || "No email")} &middot; ${escapeHtml(member.phone || "No phone")}</span>
        <div class="badge-row">${statusBadge(member.status || "active")}<span class="mini-badge">${assignedCount} assigned</span></div>
      </div>
      <div class="record-side">
        ${canAddMembers() ? `<div class="row-actions"><button type="button" data-toggle-member="${member.id}" data-next-status="${member.status === "active" ? "inactive" : "active"}">${member.status === "active" ? "Mark inactive" : "Reactivate"}</button><button type="button" data-delete-member="${member.id}">Delete</button></div>` : ""}
      </div>
    `;
    list.append(item);
  });
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
    </div>
    <div class="record-side"><strong>${money(record.amount, item?.currency || state.family.currency)}</strong><button type="button" data-delete-record="${record.id}">Delete</button></div>
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
    const itemCount = state.adminPaymentItems.filter((item) => item.family_id === family.id && item.status !== "inactive").length;
    const memberCount = state.adminMembers.filter((member) => member.family_id === family.id).length;
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
        <span>${escapeHtml(family.owner_email || "Owner email not stored")} &middot; ${memberCount} members &middot; ${itemCount} obligations</span>
        <div class="badge-row">
          ${statusBadge(head?.can_add_members ? "members unlocked" : "member access locked")}
          ${statusBadge(head?.status || "free signup")}
          ${statusBadge(head?.billing_status || "payment not set")}
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
    const article = document.createElement("article");
    article.className = "record-card";
    article.innerHTML = `
      <div class="record-main">
        <strong>${escapeHtml(head.full_name)}</strong>
        <span>${escapeHtml(head.email)} &middot; ${money(head.monthly_fee, head.fee_currency || "USD")} monthly</span>
        <div class="badge-row">${statusBadge(head.status)}${statusBadge(head.billing_status)}${statusBadge(head.can_add_members ? "members unlocked" : "free")}</div>
      </div>
      <div class="record-side">
        <div class="row-actions">
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

async function signUp(event) {
  event.preventDefault();
  assertSupabase();
  const fullName = $("#signupName").value.trim();
  const email = $("#signupEmail").value.trim();
  const password = $("#signupPassword").value;
  const confirmPassword = $("#signupPasswordConfirm").value;
  if (!fullName || !email || !password) {
    showToast("Enter your name, email, and password.");
    return;
  }
  if (password !== confirmPassword) {
    showToast("Passwords do not match.");
    return;
  }
  try {
    await query("sign up", supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } }));
    await supabase.auth.signOut();
    $("#signupForm").reset();
    setView("auth");
    showToast("Account created. You can sign in now.");
  } catch (error) {
    showToast(error.message);
  }
}

async function createFamily(event) {
  event.preventDefault();
  assertSupabase();
  const user = state.session.user;
  const name = $("#familyName").value.trim();
  if (!name) return;
  try {
    const family = await query(
      "family create",
      supabase
        .from("families")
        .insert({
          owner_id: user.id,
          owner_email: user.email?.toLowerCase(),
          name,
          monthly_budget: Number($("#familyBudget").value || 0),
          currency: $("#familyCurrency").value
        })
        .select()
        .single()
    );
    state.family = family;
    await query(
      "owner member create",
      supabase.from("family_members").insert({
        family_id: family.id,
        user_id: user.id,
        created_by: user.id,
        name: state.profile?.full_name || user.email,
        email: user.email?.toLowerCase(),
        role: "Owner",
        avatar_color: "#2563EB"
      })
    );
    await loadApp();
    showToast("Household created.");
  } catch (error) {
    showToast(error.message);
  }
}

async function saveObligation(event) {
  event.preventDefault();
  assertSupabase();
  const amount = Number($("#obligationAmount").value);
  if (!amount || amount <= 0) {
    showToast("Enter an amount due above zero.");
    return;
  }
  const payload = {
    family_id: state.family.id,
    name: $("#obligationName").value.trim(),
    category: $("#obligationCategory").value,
    amount,
    currency: $("#obligationCurrency").value,
    responsible_member_id: $("#obligationMember").value || null,
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
      showToast("Obligation updated.");
    } else {
      await query("payment item create", supabase.from("payment_items").insert(payload));
      showToast("Obligation saved.");
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
  state.familyTab = "obligations";
  setRoute("family", "obligations");
  renderFamilyTabs();
  $("#obligationTitle").textContent = "Edit obligation";
  $("#obligationSubmitButton").textContent = "Save changes";
  $("#cancelEditObligationButton").classList.remove("hidden");
  $("#obligationName").value = item.name;
  $("#obligationAmount").value = item.amount;
  $("#obligationCurrency").value = item.currency;
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
  $("#obligationTitle").textContent = "Add obligation";
  $("#obligationSubmitButton").textContent = "Save obligation";
  $("#cancelEditObligationButton").classList.add("hidden");
}

async function addMember(event) {
  event.preventDefault();
  assertSupabase();
  if (!canAddMembers()) {
    showToast("Admin approval is required before adding family members.");
    return;
  }
  const name = $("#memberName").value.trim();
  if (!name) return;
  try {
    await query(
      "member create",
      supabase.from("family_members").insert({
        family_id: state.family.id,
        created_by: state.session.user.id,
        name,
        role: $("#memberRole").value,
        email: $("#memberEmail").value.trim().toLowerCase() || null,
        phone: $("#memberPhone").value.trim() || null,
        avatar_color: $("#memberColor").value,
        status: "active"
      })
    );
    $("#memberForm").reset();
    $("#memberColor").value = "#2563EB";
    await loadFamilyData();
    renderFamilyApp();
    showToast("Member added.");
  } catch (error) {
    showToast(error.message);
  }
}

function openRecordPayment(key) {
  const occurrences = generateOccurrences(state.paymentItems, state.paymentRecords, state.filterMonth);
  const occurrence = occurrences.find((item) => item.key === key);
  if (!occurrence) return;
  $("#recordItemId").value = occurrence.item.id;
  $("#recordPeriodStart").value = occurrence.periodStart;
  $("#recordDueDate").value = occurrence.dueDate;
  $("#recordPaymentTitle").textContent = `Record ${occurrence.item.name}`;
  $("#recordPaymentMeta").textContent = `${money(occurrence.outstanding, occurrence.item.currency)} outstanding, due ${occurrence.dueDate}`;
  $("#recordAmount").value = occurrence.outstanding.toFixed(2);
  $("#recordPaidBy").value = occurrence.item.responsible_member_id || "";
  $("#recordPaymentDate").value = toDateValue(new Date());
  $("#recordPaymentDialog").showModal();
}

async function savePaymentRecord(event) {
  event.preventDefault();
  const item = state.paymentItems.find((paymentItem) => paymentItem.id === $("#recordItemId").value);
  const amount = Number($("#recordAmount").value || 0);
  if (!item || amount <= 0) {
    showToast("Choose a payment and enter an amount.");
    return;
  }
  try {
    await query(
      "payment record create",
      supabase.from("payment_records").insert({
        family_id: state.family.id,
        payment_item_id: item.id,
        period_start: $("#recordPeriodStart").value,
        due_date: $("#recordDueDate").value,
        paid_by_member_id: $("#recordPaidBy").value || null,
        amount,
        payment_date: $("#recordPaymentDate").value,
        payment_method: $("#recordMethod").value,
        reference_number: $("#recordReference").value.trim() || null,
        notes: $("#recordNotes").value.trim() || null,
        recorded_by: state.session.user.id
      })
    );
    $("#recordPaymentDialog").close();
    $("#recordPaymentForm").reset();
    await loadPaymentRecords();
    renderFamilyApp();
    showToast("Payment recorded.");
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
    can_add_members: $("#headCanAddMembers").checked,
    status: "active"
  };
  if (!payload.full_name || !email) return;
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

async function updateMemberStatus(memberId, nextStatus) {
  try {
    await query("member status update", supabase.from("family_members").update({ status: nextStatus }).eq("id", memberId));
    await loadMembers();
    renderFamilyApp();
    showToast(nextStatus === "active" ? "Member reactivated." : "Member marked inactive.");
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
  link.download = `household-payments-${state.filterMonth}.csv`;
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
  } else {
    showToast("Notifications were not enabled. In-app reminders still work.");
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
  if (event.target.dataset.showSignup !== undefined) setView("signup");
  if (event.target.dataset.showSignin !== undefined) setView("auth");
  if (event.target.dataset.closePaymentDialog !== undefined) $("#recordPaymentDialog").close();
  if (event.target.dataset.closeConfirmDialog !== undefined) $("#confirmDialog").close();
  if (event.target.dataset.openDrawer !== undefined) openDrawer();
  if (event.target.dataset.closeDrawer !== undefined) closeDrawer();
  if (event.target.closest("[data-enable-notifications]")) await enableNotifications();
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
  if (recordPaymentKey) openRecordPayment(recordPaymentKey);

  const editObligationId = event.target.dataset.editObligation;
  if (editObligationId) startEditObligation(editObligationId);

  const toggleObligationId = event.target.dataset.toggleObligation;
  if (toggleObligationId) await updateObligationStatus(toggleObligationId, event.target.dataset.nextStatus);

  const deleteObligationId = event.target.dataset.deleteObligation;
  if (deleteObligationId && await confirmAction({
    title: "Delete obligation?",
    message: "This deletes the recurring obligation and its saved payment records.",
    action: "Delete"
  })) {
    await deleteRow("payment_items", deleteObligationId, async () => {
      await loadFamilyData();
      renderFamilyApp();
    }, "Obligation deleted.");
  }

  const memberId = event.target.dataset.toggleMember;
  if (memberId) await updateMemberStatus(memberId, event.target.dataset.nextStatus);

  const deleteMemberId = event.target.dataset.deleteMember;
  if (deleteMemberId && await confirmAction({
    title: "Delete family member?",
    message: "This removes the member from the household roster.",
    action: "Delete"
  })) {
    await deleteRow("family_members", deleteMemberId, async () => {
      await loadFamilyData();
      renderFamilyApp();
    }, "Member deleted.");
  }

  const deleteRecordId = event.target.dataset.deleteRecord;
  if (deleteRecordId && await confirmAction({
    title: "Delete payment record?",
    message: "This removes the saved payment from the selected period.",
    action: "Delete"
  })) {
    await deleteRow("payment_records", deleteRecordId, async () => {
      await loadPaymentRecords();
      renderFamilyApp();
    }, "Payment record deleted.");
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
});

$("#authForm").addEventListener("submit", signIn);
$("#signupForm").addEventListener("submit", signUp);
$("#familyForm").addEventListener("submit", createFamily);
$("#obligationForm").addEventListener("submit", saveObligation);
$("#memberForm").addEventListener("submit", addMember);
$("#recordPaymentForm").addEventListener("submit", savePaymentRecord);
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
  renderSchedule();
  renderMyPayments();
});
$("#adminHouseholdSearch").addEventListener("input", renderAdminFamilies);

window.addEventListener("hashchange", () => {
  applyRouteFromHash();
  if (state.isAdmin) renderAdminTabs();
  if (state.family) renderFamilyTabs();
});

init().catch((error) => {
  console.error(error);
  showToast(error.message);
  if (state.session) {
    showAppError(error);
  } else {
    setView("auth");
  }
});
