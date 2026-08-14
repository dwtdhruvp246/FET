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
  expenses: [],
  heads: [],
  adminFamilies: [],
  payments: [],
  adminTab: "dashboard",
  familyTab: "dashboard",
  editingExpenseId: null,
  filterMonth: toMonthValue(new Date()),
  filterCategory: "All"
};

const $ = (selector) => document.querySelector(selector);

const views = {
  configWarning: $("#configWarning"),
  auth: $("#authView"),
  setup: $("#setupView"),
  pending: $("#pendingView"),
  suspended: $("#suspendedView"),
  admin: $("#adminView"),
  app: $("#appView")
};

const currencyNames = {
  USD: "en-US",
  ZAR: "en-ZA",
  EUR: "de-DE",
  GBP: "en-GB",
  CAD: "en-CA",
  AUD: "en-AU"
};

const today = new Date();
$("#expenseDate").value = toDateValue(today);
$("#monthFilter").value = state.filterMonth;
$("#paymentDate").value = toDateValue(today);

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
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.setTimeout(() => toast.classList.add("hidden"), 3400);
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
  if (!isConfigured) {
    setView("configWarning");
    return;
  }

  const { data } = await supabase.auth.getSession();
  state.session = data.session;

  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    if (session) {
      await loadApp();
      return;
    }
    resetState();
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
  state.expenses = [];
  state.heads = [];
  state.adminFamilies = [];
  state.payments = [];
  state.adminTab = "dashboard";
  state.familyTab = "dashboard";
  state.editingExpenseId = null;
}

async function loadApp() {
  assertSupabase();
  await ensureProfile();
  await loadAccess();

  if (state.isAdmin) {
    await loadAdminData();
    setView("admin");
    renderAdmin();
    return;
  }

  if (state.headApproval?.status === "suspended") {
    setView("suspended");
    return;
  }

  await loadFamily();

  if (!state.headApproval && !state.family) {
    setView("pending");
    return;
  }

  if (!state.family) {
    setView("setup");
    return;
  }

  await Promise.all([loadMembers(), loadExpenses()]);
  setView("app");
  render();
}

async function ensureProfile() {
  const user = state.session.user;
  const fullName =
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Household owner";

  await query(
    "profile upsert",
    supabase.from("profiles").upsert(
      {
        id: user.id,
        full_name: fullName
      },
      { onConflict: "id" }
    )
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

async function loadAdminData() {
  state.heads = await query(
    "heads load",
    supabase.from("family_heads").select("*").order("created_at", { ascending: false })
  );

  state.adminFamilies = await query(
    "admin families load",
    supabase.from("families").select("*").order("created_at", { ascending: false })
  );

  state.payments = await query(
    "payments load",
    supabase
      .from("payments")
      .select("*, family_heads(full_name, email, billing_status, status)")
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false })
  );
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

async function loadExpenses() {
  state.expenses = await query(
    "expenses load",
    supabase
      .from("expenses")
      .select("*, target_member:family_members!expenses_member_id_fkey(name, role, avatar_color), payer_member:family_members!expenses_paid_by_member_id_fkey(name, role, avatar_color)")
      .eq("family_id", state.family.id)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
  );
}

function render() {
  renderFamilyTabs();
  renderFamily();
  renderMembers();
  renderExpenses();
  renderStats();
  renderMemberBreakdown();
  renderRecentExpenses();
}

function renderFamilyTabs() {
  document.querySelectorAll("[data-family-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.familyTab === state.familyTab);
  });

  document.querySelectorAll("[data-family-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.familyPanel !== state.familyTab);
  });
}

function renderAdmin() {
  renderAdminTabs();
  renderAdminSummary();
  renderHeads();
  renderPaymentHeadOptions();
  renderPayments();
  renderAdminFamilies();
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
  const activeHeads = state.heads.filter((head) => head.status === "active");
  const suspendedHeads = state.heads.filter((head) => head.status === "suspended");
  const unpaidHeads = state.heads.filter((head) => head.billing_status !== "paid");

  $("#adminActiveHeadCount").textContent = activeHeads.length;
  $("#adminSuspendedText").textContent = `${suspendedHeads.length} suspended`;
  $("#adminFamilyCount").textContent = state.adminFamilies.length;
  $("#adminEmail").textContent = state.session.user.email || "-";
  $("#adminRevenueTotal").textContent = formatCurrencyTotals(state.payments);
  $("#adminPaymentCount").textContent = `${state.payments.length} payments`;
  $("#adminUnpaidHeadCount").textContent = unpaidHeads.length;

  const recentList = $("#recentPaymentsList");
  const recentPayments = state.payments.slice(0, 5);
  if (!recentPayments.length) {
    recentList.innerHTML = `
      <div class="empty-ledger">
        <strong>No payments recorded</strong>
        <span>Use the Finance page to manually add the first payment.</span>
      </div>
    `;
    return;
  }

  recentList.innerHTML = "";
  recentPayments.forEach((payment) => recentList.append(renderPaymentRecord(payment)));
}

function renderHeads() {
  const headsList = $("#headsList");
  if (!state.heads.length) {
    headsList.innerHTML = `<p class="empty">No heads approved yet.</p>`;
  } else {
    headsList.innerHTML = "";
    state.heads.forEach((head) => {
      const item = document.createElement("article");
      item.className = "member-item head-item";
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(head.full_name)}</strong>
          <span>${escapeHtml(head.email)} &middot; ${money(head.monthly_fee, head.fee_currency || "USD")} monthly</span>
          <div class="badge-row">
            ${statusBadge(head.status)}
            ${statusBadge(head.billing_status)}
            <span class="mini-badge">Paid until ${head.paid_until || "not set"}</span>
          </div>
        </div>
        <div class="row-actions">
          <button type="button" data-toggle-head="${head.id}" data-next-status="${head.status === "active" ? "suspended" : "active"}">
            ${head.status === "active" ? "Suspend" : "Reactivate"}
          </button>
          <button type="button" data-delete-head="${head.id}" aria-label="Revoke ${escapeHtml(head.full_name)}">Revoke</button>
        </div>
      `;
      headsList.append(item);
    });
  }
}

function renderAdminFamilies() {
  const familiesList = $("#adminFamiliesList");
  if (!state.adminFamilies.length) {
    familiesList.innerHTML = `
      <div class="empty-ledger">
        <strong>No households yet</strong>
        <span>Approve a head of family so they can create one.</span>
      </div>
    `;
    return;
  }

  familiesList.innerHTML = "";
  state.adminFamilies.forEach((family) => {
    const item = document.createElement("article");
    item.className = "expense-item admin-family-item";
    const matchingHead = state.heads.find(
      (head) => head.email.toLowerCase() === (family.owner_email || "").toLowerCase()
    );
    item.innerHTML = `
      <div class="expense-date">
        <strong>${family.currency}</strong>
        <span>Budget</span>
      </div>
      <div class="expense-detail">
        <strong>${escapeHtml(family.name)}</strong>
        <span>${escapeHtml(family.owner_email || "Owner email not stored")} &middot; Created ${new Date(family.created_at).toLocaleDateString()}</span>
        <div class="badge-row">
          ${matchingHead ? statusBadge(matchingHead.status) : '<span class="mini-badge">No head match</span>'}
          ${matchingHead ? statusBadge(matchingHead.billing_status) : ""}
        </div>
      </div>
      <div class="expense-actions">
        <strong>${money(family.monthly_budget, family.currency)}</strong>
      </div>
    `;
    familiesList.append(item);
  });
}

function renderPaymentHeadOptions() {
  const select = $("#paymentHead");
  select.innerHTML = `<option value="">Choose head</option>`;

  state.heads.forEach((head) => {
    const option = document.createElement("option");
    option.value = head.id;
    option.textContent = `${head.full_name} - ${head.email}`;
    option.dataset.amount = head.monthly_fee || 0;
    option.dataset.currency = head.fee_currency || "USD";
    select.append(option);
  });
}

function renderPayments() {
  const list = $("#paymentsList");
  if (!state.payments.length) {
    list.innerHTML = `
      <div class="empty-ledger">
        <strong>No payment history</strong>
        <span>Record manual payments as cash, EFT, card, bank deposit, or other.</span>
      </div>
    `;
    return;
  }

  list.innerHTML = "";
  state.payments.forEach((payment) => list.append(renderPaymentRecord(payment, true)));
}

function renderPaymentRecord(payment, withActions = false) {
  const headName = payment.family_heads?.full_name || "Unknown head";
  const headEmail = payment.family_heads?.email || "";
  const item = document.createElement("article");
  item.className = "expense-item payment-item";
  item.innerHTML = `
    <div class="expense-date">
      <strong>${new Date(`${payment.payment_date}T00:00:00`).getDate()}</strong>
      <span>${new Date(`${payment.payment_date}T00:00:00`).toLocaleString("en", { month: "short" })}</span>
    </div>
    <div class="expense-detail">
      <strong>${escapeHtml(headName)}</strong>
      <span>${escapeHtml(headEmail)} &middot; ${escapeHtml(payment.payment_method)} &middot; ${escapeHtml(payment.reference_number || "No reference")}</span>
      ${payment.notes ? `<small>${escapeHtml(payment.notes)}</small>` : ""}
    </div>
    <div class="expense-actions">
      <strong>${money(payment.amount, payment.currency)}</strong>
      ${withActions ? `<button type="button" data-delete-payment="${payment.id}">Delete</button>` : ""}
    </div>
  `;
  return item;
}

function statusBadge(status) {
  return `<span class="mini-badge ${status}">${escapeHtml(status)}</span>`;
}

function formatCurrencyTotals(payments) {
  if (!payments.length) return money(0, "USD");
  const totals = payments.reduce((acc, payment) => {
    acc[payment.currency] = (acc[payment.currency] || 0) + Number(payment.amount);
    return acc;
  }, {});
  return Object.entries(totals)
    .map(([currency, amount]) => money(amount, currency))
    .join(" / ");
}

function renderFamily() {
  $("#householdTitle").textContent = state.family.name;
  $("#headBillingBadge").textContent = state.headApproval?.billing_status || "billing";
  $("#headBillingBadge").className = `mini-badge ${state.headApproval?.billing_status || ""}`;
}

function renderMembers() {
  const memberSelect = $("#expenseMember");
  const payerSelect = $("#expensePaidBy");
  memberSelect.innerHTML = `<option value="">Whole family</option>`;
  payerSelect.innerHTML = `<option value="">Household account</option>`;

  state.members.filter((member) => member.status !== "inactive").forEach((member) => {
    const option = document.createElement("option");
    option.value = member.id;
    option.textContent = `${member.name} (${member.role})`;
    memberSelect.append(option);

    const payerOption = document.createElement("option");
    payerOption.value = member.id;
    payerOption.textContent = `${member.name} (${member.role})`;
    payerSelect.append(payerOption);
  });

  const list = $("#membersList");
  if (!state.members.length) {
    list.innerHTML = `<p class="empty">No family members yet.</p>`;
    return;
  }

  list.innerHTML = "";
  state.members.forEach((member) => {
    const monthTotal = memberMonthTotal(member.id);
    const limit = Number(member.spending_limit || 0);
    const limitPercent = limit > 0 ? Math.min((monthTotal / limit) * 100, 100) : 0;
    const item = document.createElement("article");
    item.className = "member-item member-card";
    item.innerHTML = `
      <div class="avatar" style="background:${escapeHtml(member.avatar_color || "#167D77")}">${memberInitials(member.name)}</div>
      <div>
        <strong>${escapeHtml(member.name)}</strong>
        <span>${escapeHtml(member.role)} &middot; ${money(member.monthly_allowance, state.family.currency)} allowance &middot; ${money(limit, state.family.currency)} limit</span>
        <div class="badge-row">${statusBadge(member.status || "active")}</div>
        <div class="meter small-meter"><span style="width:${limitPercent}%"></span></div>
        <small>${money(monthTotal, state.family.currency)} spent this month</small>
      </div>
      <div class="row-actions">
        <button type="button" data-toggle-member="${member.id}" data-next-status="${member.status === "active" ? "inactive" : "active"}">
          ${member.status === "active" ? "Mark inactive" : "Reactivate"}
        </button>
        <button type="button" data-delete-member="${member.id}" aria-label="Delete ${escapeHtml(member.name)}">Delete</button>
      </div>
    `;
    list.append(item);
  });
}

function renderMemberBreakdown() {
  const list = $("#memberBreakdownList");
  const rows = [
    {
      id: "",
      name: "Whole family",
      role: "Shared",
      avatar_color: "#2859B8",
      spending_limit: Number(state.family.monthly_budget || 0),
      total: sharedMonthTotal()
    },
    ...state.members.map((member) => ({
      ...member,
      total: memberMonthTotal(member.id)
    }))
  ].filter((row) => row.total > 0 || row.id);

  if (!rows.length) {
    list.innerHTML = `
      <div class="empty-ledger">
        <strong>No spending yet</strong>
        <span>Add expenses to see family member patterns.</span>
      </div>
    `;
    return;
  }

  const maxTotal = Math.max(...rows.map((row) => row.total), 1);
  list.innerHTML = "";
  rows.forEach((row) => {
    const limit = Number(row.spending_limit || 0);
    const percent = Math.min((row.total / maxTotal) * 100, 100);
    const limitText = limit > 0 ? `${money(row.total, state.family.currency)} of ${money(limit, state.family.currency)}` : money(row.total, state.family.currency);
    const item = document.createElement("article");
    item.className = "breakdown-item";
    item.innerHTML = `
      <div class="avatar" style="background:${escapeHtml(row.avatar_color || "#167D77")}">${memberInitials(row.name)}</div>
      <div>
        <strong>${escapeHtml(row.name)}</strong>
        <span>${escapeHtml(row.role || "Member")} &middot; ${limitText}</span>
        <div class="meter small-meter"><span style="width:${percent}%"></span></div>
      </div>
    `;
    list.append(item);
  });
}

function renderRecentExpenses() {
  const list = $("#recentExpensesList");
  const recent = state.expenses.slice(0, 5);
  if (!recent.length) {
    list.innerHTML = `
      <div class="empty-ledger">
        <strong>No recent expenses</strong>
        <span>The latest household spending will appear here.</span>
      </div>
    `;
    return;
  }

  list.innerHTML = "";
  recent.forEach((expense) => list.append(renderExpenseItem(expense, false)));
}

function monthExpenses() {
  return state.expenses.filter((expense) => expense.expense_date.startsWith(state.filterMonth));
}

function memberMonthTotal(memberId) {
  return monthExpenses()
    .filter((expense) => expense.member_id === memberId)
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
}

function sharedMonthTotal() {
  return monthExpenses()
    .filter((expense) => !expense.member_id)
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
}

function memberInitials(name) {
  return `${name || "?"}`
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function filteredExpenses() {
  return state.expenses.filter((expense) => {
    const monthMatch = expense.expense_date.startsWith(state.filterMonth);
    const categoryMatch =
      state.filterCategory === "All" || expense.category === state.filterCategory;
    return monthMatch && categoryMatch;
  });
}

function renderExpenses() {
  const list = $("#expensesList");
  const expenses = filteredExpenses();

  if (!expenses.length) {
    list.innerHTML = `
      <div class="empty-ledger">
        <strong>No expenses found</strong>
        <span>Add an expense or change the filters.</span>
      </div>
    `;
    return;
  }

  list.innerHTML = "";
  expenses.forEach((expense) => {
    list.append(renderExpenseItem(expense, true));
  });
}

function renderExpenseItem(expense, withActions = true) {
  const memberName = expense.target_member?.name || "Whole family";
  const payerName = expense.payer_member?.name || "Household account";
  const item = document.createElement("article");
  item.className = "expense-item";
  item.innerHTML = `
    <div class="expense-date">
      <strong>${new Date(`${expense.expense_date}T00:00:00`).getDate()}</strong>
      <span>${new Date(`${expense.expense_date}T00:00:00`).toLocaleString("en", { month: "short" })}</span>
    </div>
    <div class="expense-detail">
      <strong>${escapeHtml(expense.category)}</strong>
      <span>For ${escapeHtml(memberName)} &middot; Paid by ${escapeHtml(payerName)} &middot; ${escapeHtml(expense.payment_method || "Method not set")}</span>
      ${expense.note ? `<small>${escapeHtml(expense.note)}</small>` : ""}
    </div>
    <div class="expense-actions">
      <strong>${money(expense.amount, state.family.currency)}</strong>
      ${withActions ? `<div class="row-actions"><button type="button" data-edit-expense="${expense.id}">Edit</button><button type="button" data-delete-expense="${expense.id}" aria-label="Delete expense">Delete</button></div>` : ""}
    </div>
  `;
  return item;
}

function renderStats() {
  const currentMonthExpenses = monthExpenses();
  const spent = currentMonthExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const budget = Number(state.family.monthly_budget || 0);
  const remaining = budget - spent;
  const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const monthDate = new Date(`${state.filterMonth}-01T00:00:00`);

  $("#dashboardMonthTitle").textContent = monthDate.toLocaleString("en", {
    month: "long",
    year: "numeric"
  });
  $("#spentAmount").textContent = money(spent, state.family.currency);
  $("#remainingAmount").textContent = money(remaining, state.family.currency);
  $("#remainingText").textContent = remaining >= 0 ? "Still available" : "Over budget";
  $("#budgetMeter").style.width = `${percentage}%`;
  $("#budgetText").textContent =
    budget > 0
      ? `${Math.round(percentage)}% of ${money(budget, state.family.currency)} used`
      : "No monthly budget set";

  const byCategory = currentMonthExpenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + Number(expense.amount);
    return acc;
  }, {});
  const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
  $("#topCategory").textContent = top ? top[0] : "None";
  $("#topCategoryText").textContent = top
    ? `${money(top[1], state.family.currency)} this month`
    : "Add expenses to see patterns";
  $("#memberCount").textContent = state.members.length;
}

function escapeHtml(value) {
  return `${value ?? ""}`.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[char];
  });
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  await signIn();
}

async function signIn() {
  assertSupabase();
  const email = $("#email").value.trim();
  const password = $("#password").value;
  if (!email || !password) {
    showToast("Enter an email and password.");
    return;
  }

  try {
    await query("sign in", supabase.auth.signInWithPassword({ email, password }));
    showToast("Signed in.");
  } catch (error) {
    showToast(error.message);
  }
}

async function signUp() {
  assertSupabase();
  const email = $("#email").value.trim();
  const password = $("#password").value;
  const fullName = $("#displayName").value.trim();
  if (!email || !password) {
    showToast("Enter an email and password.");
    return;
  }

  try {
    await query(
      "sign up",
      supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      })
    );
    showToast("Account created. Check your email if confirmation is enabled.");
  } catch (error) {
    showToast(error.message);
  }
}

async function sendMagicLink() {
  assertSupabase();
  const email = $("#email").value.trim();
  if (!email) {
    showToast("Enter your email first.");
    return;
  }

  try {
    await query(
      "magic link",
      supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`
        }
      })
    );
    showToast("Magic link sent.");
  } catch (error) {
    showToast(error.message);
  }
}

async function createFamily(event) {
  event.preventDefault();
  assertSupabase();

  const user = state.session.user;
  const name = $("#familyName").value.trim();
  const monthlyBudget = Number($("#familyBudget").value || 0);
  const currency = $("#familyCurrency").value;

  try {
    const family = await query(
      "family create",
      supabase
        .from("families")
        .insert({
          owner_id: user.id,
          owner_email: user.email?.toLowerCase(),
          name,
          monthly_budget: monthlyBudget,
          currency
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
        role: "Owner",
        monthly_allowance: 0
      })
    );

    await loadApp();
    showToast("Household created.");
  } catch (error) {
    showToast(error.message);
  }
}

async function addMember(event) {
  event.preventDefault();
  assertSupabase();

  const name = $("#memberName").value.trim();
  const role = $("#memberRole").value;
  const allowance = Number($("#memberAllowance").value || 0);
  const spendingLimit = Number($("#memberLimit").value || 0);
  const avatarColor = $("#memberColor").value;
  if (!name) return;

  try {
    await query(
      "member create",
      supabase.from("family_members").insert({
        family_id: state.family.id,
        created_by: state.session.user.id,
        name,
        role,
        monthly_allowance: allowance,
        spending_limit: spendingLimit,
        avatar_color: avatarColor,
        status: "active"
      })
    );
    $("#memberForm").reset();
    $("#memberColor").value = "#167D77";
    await loadMembers();
    render();
    showToast("Member added.");
  } catch (error) {
    showToast(error.message);
  }
}

async function updateMemberStatus(memberId, nextStatus) {
  try {
    await query(
      "member status update",
      supabase.from("family_members").update({ status: nextStatus }).eq("id", memberId)
    );
    await loadMembers();
    render();
    showToast(nextStatus === "active" ? "Member reactivated." : "Member marked inactive.");
  } catch (error) {
    showToast(error.message);
  }
}

async function addHead(event) {
  event.preventDefault();
  assertSupabase();

  const fullName = $("#headName").value.trim();
  const email = $("#headEmail").value.trim().toLowerCase();
  const monthlyFee = Number($("#headMonthlyFee").value || 0);
  const feeCurrency = $("#headFeeCurrency").value;
  const billingStatus = $("#headBillingStatus").value;
  if (!fullName || !email) return;

  try {
    await query(
      "head create",
      supabase.from("family_heads").insert({
        full_name: fullName,
        email,
        created_by: state.session.user.id,
        monthly_fee: monthlyFee,
        fee_currency: feeCurrency,
        billing_status: billingStatus,
        status: "active"
      })
    );
    $("#headForm").reset();
    await loadAdminData();
    renderAdmin();
    showToast("Head of family approved.");
  } catch (error) {
    showToast(error.message);
  }
}

async function updateHeadStatus(headId, nextStatus) {
  try {
    await query(
      "head status update",
      supabase.from("family_heads").update({ status: nextStatus }).eq("id", headId)
    );
    await loadAdminData();
    renderAdmin();
    showToast(nextStatus === "active" ? "Head reactivated." : "Head suspended.");
  } catch (error) {
    showToast(error.message);
  }
}

async function addPayment(event) {
  event.preventDefault();
  assertSupabase();

  const headId = $("#paymentHead").value;
  const head = state.heads.find((item) => item.id === headId);
  const amount = Number($("#paymentAmount").value);
  if (!head || !amount || amount <= 0) {
    showToast("Choose a head and enter a payment amount.");
    return;
  }

  const matchingFamily = findFamilyForHead(head);
  const paidUntil = $("#paidUntil").value;

  try {
    await query(
      "payment create",
      supabase.from("payments").insert({
        family_head_id: head.id,
        family_id: matchingFamily?.id || null,
        recorded_by: state.session.user.id,
        amount,
        currency: $("#paymentCurrency").value,
        payment_method: $("#paymentMethod").value,
        payment_date: $("#paymentDate").value,
        billing_period_start: $("#billingStart").value || null,
        billing_period_end: $("#billingEnd").value || null,
        reference_number: $("#paymentReference").value.trim() || null,
        notes: $("#paymentNotes").value.trim() || null
      })
    );

    const headUpdate = {
      billing_status: "paid",
      last_payment_at: new Date().toISOString()
    };
    if (paidUntil) headUpdate.paid_until = paidUntil;

    await query(
      "head billing update",
      supabase.from("family_heads").update(headUpdate).eq("id", head.id)
    );

    $("#paymentForm").reset();
    $("#paymentDate").value = toDateValue(new Date());
    await loadAdminData();
    renderAdmin();
    showToast("Payment recorded.");
  } catch (error) {
    showToast(error.message);
  }
}

async function addExpense(event) {
  event.preventDefault();
  assertSupabase();

  const amount = Number($("#expenseAmount").value);
  if (!amount || amount <= 0) {
    showToast("Enter an expense amount above zero.");
    return;
  }

  try {
    const payload = expensePayload(amount);
    if (state.editingExpenseId) {
      await query(
        "expense update",
        supabase.from("expenses").update(payload).eq("id", state.editingExpenseId)
      );
      showToast("Expense updated.");
    } else {
      await query(
        "expense create",
        supabase.from("expenses").insert(payload)
      );
      showToast("Expense added.");
    }

    resetExpenseForm();
    await loadExpenses();
    render();
  } catch (error) {
    showToast(error.message);
  }
}

function expensePayload(amount) {
  return {
    family_id: state.family.id,
    member_id: $("#expenseMember").value || null,
    paid_by_member_id: $("#expensePaidBy").value || null,
    user_id: state.session.user.id,
    amount,
    expense_date: $("#expenseDate").value,
    category: $("#expenseCategory").value,
    payment_method: $("#expensePayment").value,
    note: $("#expenseNote").value.trim()
  };
}

function startEditExpense(expenseId) {
  const expense = state.expenses.find((item) => item.id === expenseId);
  if (!expense) return;

  state.editingExpenseId = expense.id;
  state.familyTab = "expenses";
  renderFamilyTabs();
  $("#expenseTitle").textContent = "Edit spending";
  $("#expenseSubmitButton").textContent = "Save expense";
  $("#cancelEditExpenseButton").classList.remove("hidden");
  $("#expenseAmount").value = expense.amount;
  $("#expenseDate").value = expense.expense_date;
  $("#expenseCategory").value = expense.category;
  $("#expenseMember").value = expense.member_id || "";
  $("#expensePaidBy").value = expense.paid_by_member_id || "";
  $("#expensePayment").value = expense.payment_method || "Card";
  $("#expenseNote").value = expense.note || "";
}

function resetExpenseForm() {
  state.editingExpenseId = null;
  $("#expenseForm").reset();
  $("#expenseDate").value = toDateValue(new Date());
  $("#expenseTitle").textContent = "Record spending";
  $("#expenseSubmitButton").textContent = "Add expense";
  $("#cancelEditExpenseButton").classList.add("hidden");
}

async function deleteHead(headId) {
  try {
    await query(
      "head delete",
      supabase.from("family_heads").delete().eq("id", headId)
    );
    await loadAdminData();
    renderAdmin();
    showToast("Head access revoked.");
  } catch (error) {
    showToast(error.message);
  }
}

async function deletePayment(paymentId) {
  try {
    await query(
      "payment delete",
      supabase.from("payments").delete().eq("id", paymentId)
    );
    await loadAdminData();
    renderAdmin();
    showToast("Payment deleted.");
  } catch (error) {
    showToast(error.message);
  }
}

function findFamilyForHead(head) {
  return state.adminFamilies.find(
    (family) => (family.owner_email || "").toLowerCase() === head.email.toLowerCase()
  );
}

async function deleteMember(memberId) {
  try {
    await query(
      "member delete",
      supabase.from("family_members").delete().eq("id", memberId)
    );
    await Promise.all([loadMembers(), loadExpenses()]);
    render();
    showToast("Member deleted.");
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteExpense(expenseId) {
  try {
    await query(
      "expense delete",
      supabase.from("expenses").delete().eq("id", expenseId)
    );
    await loadExpenses();
    render();
    showToast("Expense deleted.");
  } catch (error) {
    showToast(error.message);
  }
}

function exportCsv() {
  const expenses = filteredExpenses();
  if (!expenses.length) {
    showToast("Nothing to export for this filter.");
    return;
  }

  const rows = [
    ["Date", "Category", "For", "Paid by", "Payment method", "Note", "Amount"],
    ...expenses.map((expense) => [
      expense.expense_date,
      expense.category,
      expense.target_member?.name || "Whole family",
      expense.payer_member?.name || "Household account",
      expense.payment_method || "",
      expense.note || "",
      expense.amount
    ])
  ];

  const csv = rows
    .map((row) =>
      row
        .map((value) => `"${`${value}`.replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `household-expenses-${state.filterMonth}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("click", async (event) => {
  const authAction = event.target.dataset.authAction;
  if (authAction === "signup") await signUp();
  if (authAction === "magic") await sendMagicLink();

  const memberId = event.target.dataset.deleteMember;
  if (memberId) await deleteMember(memberId);

  const toggleMemberId = event.target.dataset.toggleMember;
  if (toggleMemberId) await updateMemberStatus(toggleMemberId, event.target.dataset.nextStatus);

  const headId = event.target.dataset.deleteHead;
  if (headId) await deleteHead(headId);

  const toggleHeadId = event.target.dataset.toggleHead;
  if (toggleHeadId) await updateHeadStatus(toggleHeadId, event.target.dataset.nextStatus);

  const paymentId = event.target.dataset.deletePayment;
  if (paymentId) await deletePayment(paymentId);

  const adminTab = event.target.dataset.adminTab;
  if (adminTab) {
    state.adminTab = adminTab;
    renderAdminTabs();
  }

  const familyTab = event.target.dataset.familyTab;
  if (familyTab) {
    state.familyTab = familyTab;
    renderFamilyTabs();
  }

  const editExpenseId = event.target.dataset.editExpense;
  if (editExpenseId) startEditExpense(editExpenseId);

  const expenseId = event.target.dataset.deleteExpense;
  if (expenseId) await deleteExpense(expenseId);
});

$("#authForm").addEventListener("submit", handleAuthSubmit);
$("#familyForm").addEventListener("submit", createFamily);
$("#headForm").addEventListener("submit", addHead);
$("#paymentForm").addEventListener("submit", addPayment);
$("#memberForm").addEventListener("submit", addMember);
$("#expenseForm").addEventListener("submit", addExpense);
$("#cancelEditExpenseButton").addEventListener("click", resetExpenseForm);
$("#signOutButton").addEventListener("click", async () => supabase.auth.signOut());
$("#adminSignOutButton").addEventListener("click", async () => supabase.auth.signOut());
$("#pendingSignOutButton").addEventListener("click", async () => supabase.auth.signOut());
$("#suspendedSignOutButton").addEventListener("click", async () => supabase.auth.signOut());
$("#exportCsvButton").addEventListener("click", exportCsv);
$("#paymentHead").addEventListener("change", (event) => {
  const option = event.target.selectedOptions[0];
  const amount = Number(option?.dataset.amount || 0);
  if (amount > 0) $("#paymentAmount").value = amount.toFixed(2);
  if (option?.dataset.currency) $("#paymentCurrency").value = option.dataset.currency;
});
$("#monthFilter").addEventListener("change", (event) => {
  state.filterMonth = event.target.value;
  render();
});
$("#categoryFilter").addEventListener("change", (event) => {
  state.filterCategory = event.target.value;
  renderExpenses();
});

init().catch((error) => {
  console.error(error);
  showToast(error.message);
});
