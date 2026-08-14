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
  family: null,
  members: [],
  expenses: [],
  filterMonth: toMonthValue(new Date()),
  filterCategory: "All"
};

const $ = (selector) => document.querySelector(selector);

const views = {
  configWarning: $("#configWarning"),
  auth: $("#authView"),
  setup: $("#setupView"),
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
  state.family = null;
  state.members = [];
  state.expenses = [];
}

async function loadApp() {
  assertSupabase();
  await ensureProfile();
  await loadFamily();

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

async function loadFamily() {
  const families = await query(
    "family load",
    supabase.from("families").select("*").order("created_at", { ascending: true }).limit(1)
  );
  state.family = families[0] || null;
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
      .select("*, family_members(name, role)")
      .eq("family_id", state.family.id)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
  );
}

function render() {
  renderFamily();
  renderMembers();
  renderExpenses();
  renderStats();
}

function renderFamily() {
  $("#householdTitle").textContent = state.family.name;
}

function renderMembers() {
  const memberSelect = $("#expenseMember");
  memberSelect.innerHTML = `<option value="">Whole family</option>`;

  state.members.forEach((member) => {
    const option = document.createElement("option");
    option.value = member.id;
    option.textContent = `${member.name} (${member.role})`;
    memberSelect.append(option);
  });

  const list = $("#membersList");
  if (!state.members.length) {
    list.innerHTML = `<p class="empty">No family members yet.</p>`;
    return;
  }

  list.innerHTML = "";
  state.members.forEach((member) => {
    const item = document.createElement("article");
    item.className = "member-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(member.name)}</strong>
        <span>${escapeHtml(member.role)} · ${money(member.monthly_allowance, state.family.currency)} allowance</span>
      </div>
      <button type="button" data-delete-member="${member.id}" aria-label="Delete ${escapeHtml(member.name)}">Delete</button>
    `;
    list.append(item);
  });
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
    const memberName = expense.family_members?.name || "Whole family";
    const item = document.createElement("article");
    item.className = "expense-item";
    item.innerHTML = `
      <div class="expense-date">
        <strong>${new Date(`${expense.expense_date}T00:00:00`).getDate()}</strong>
        <span>${new Date(`${expense.expense_date}T00:00:00`).toLocaleString("en", { month: "short" })}</span>
      </div>
      <div class="expense-detail">
        <strong>${escapeHtml(expense.category)}</strong>
        <span>${escapeHtml(memberName)} · ${escapeHtml(expense.payment_method || "Method not set")}</span>
        ${expense.note ? `<small>${escapeHtml(expense.note)}</small>` : ""}
      </div>
      <div class="expense-actions">
        <strong>${money(expense.amount, state.family.currency)}</strong>
        <button type="button" data-delete-expense="${expense.id}" aria-label="Delete expense">Delete</button>
      </div>
    `;
    list.append(item);
  });
}

function renderStats() {
  const monthExpenses = state.expenses.filter((expense) =>
    expense.expense_date.startsWith(state.filterMonth)
  );
  const spent = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const budget = Number(state.family.monthly_budget || 0);
  const remaining = budget - spent;
  const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

  $("#spentAmount").textContent = money(spent, state.family.currency);
  $("#remainingAmount").textContent = money(remaining, state.family.currency);
  $("#remainingText").textContent = remaining >= 0 ? "Still available" : "Over budget";
  $("#budgetMeter").style.width = `${percentage}%`;
  $("#budgetText").textContent =
    budget > 0
      ? `${Math.round(percentage)}% of ${money(budget, state.family.currency)} used`
      : "No monthly budget set";

  const byCategory = monthExpenses.reduce((acc, expense) => {
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
  if (!name) return;

  try {
    await query(
      "member create",
      supabase.from("family_members").insert({
        family_id: state.family.id,
        created_by: state.session.user.id,
        name,
        role,
        monthly_allowance: allowance
      })
    );
    $("#memberForm").reset();
    await loadMembers();
    render();
    showToast("Member added.");
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
    await query(
      "expense create",
      supabase.from("expenses").insert({
        family_id: state.family.id,
        member_id: $("#expenseMember").value || null,
        user_id: state.session.user.id,
        amount,
        expense_date: $("#expenseDate").value,
        category: $("#expenseCategory").value,
        payment_method: $("#expensePayment").value,
        note: $("#expenseNote").value.trim()
      })
    );
    $("#expenseForm").reset();
    $("#expenseDate").value = toDateValue(new Date());
    await loadExpenses();
    render();
    showToast("Expense added.");
  } catch (error) {
    showToast(error.message);
  }
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
    ["Date", "Category", "Member", "Payment method", "Note", "Amount"],
    ...expenses.map((expense) => [
      expense.expense_date,
      expense.category,
      expense.family_members?.name || "Whole family",
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

  const expenseId = event.target.dataset.deleteExpense;
  if (expenseId) await deleteExpense(expenseId);
});

$("#authForm").addEventListener("submit", handleAuthSubmit);
$("#familyForm").addEventListener("submit", createFamily);
$("#memberForm").addEventListener("submit", addMember);
$("#expenseForm").addEventListener("submit", addExpense);
$("#signOutButton").addEventListener("click", async () => supabase.auth.signOut());
$("#exportCsvButton").addEventListener("click", exportCsv);
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
