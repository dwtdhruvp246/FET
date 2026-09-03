const config = window.MUSHAVO_BUDGET_CONFIG || {};
const isConfigured = Boolean(
  config.supabaseUrl &&
  config.supabasePublishableKey &&
  !`${config.supabaseUrl} ${config.supabasePublishableKey}`.includes("YOUR-")
);
const state = { catalogue: [], billingPeriod: "monthly", currency: "USD" };
let publicSupabaseClient = null;

const COUNTRY_CODES = (
  "AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW"
).split(" ");

const featureLabels = {
  "finance.analytics": "Finance analytics",
  "payments.recurring": "Recurring payment schedules",
  "receipts.upload": "Receipt and proof uploads",
  "reports.advanced": "Advanced reports",
  "export.csv": "CSV export",
  "export.pdf": "Print and PDF reports",
  "members.invite": "Member invitations",
  "approvals.enabled": "Approval controls",
  "audit.full_history": "Full audit history"
};

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = value == null ? "" : String(value);
  return element.innerHTML;
}

function titleCase(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function money(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount || 0));
  } catch (_error) {
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }
}

function initNavigation() {
  const button = document.querySelector(".site-menu-button");
  const navigation = document.querySelector(".site-nav");
  if (!button || !navigation) return;
  button.addEventListener("click", () => {
    const open = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!open));
    button.textContent = open ? "Menu" : "Close";
    navigation.classList.toggle("open", !open);
    button.closest(".site-header")?.classList.toggle("menu-open", !open);
  });
}

async function loadCatalogue(currency = "USD") {
  if (!isConfigured) throw new Error("The current plan catalogue is temporarily unavailable.");
  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/get_public_plan_catalogue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.supabasePublishableKey,
      Authorization: `Bearer ${config.supabasePublishableKey}`
    },
    body: JSON.stringify({ p_currency: currency })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "The current plan catalogue is temporarily unavailable.");
  state.catalogue = Array.isArray(data) ? data : [];
  return state.catalogue;
}

function priceFor(plan, period = state.billingPeriod) {
  return (Array.isArray(plan.prices) ? plan.prices : []).find((price) => price.billing_period === period) || null;
}

function publicFeatureLabels(plan) {
  const features = Array.isArray(plan.features) ? plan.features : [];
  return features.filter((feature) => feature.enabled).map((feature) => featureLabels[feature.code] || titleCase(feature.code));
}

function renderHomePlanPreview() {
  const container = document.querySelector("#homePlanPreview");
  if (!container) return;
  if (!state.catalogue.length) {
    container.innerHTML = '<div class="site-error">Current pricing could not be loaded. Please open the Pricing page or contact Mushavo Budget.</div>';
    return;
  }
  const preferred = ["free", "household", "business"].map((code) => state.catalogue.find((plan) => plan.code === code)).filter(Boolean);
  const plans = (preferred.length ? preferred : state.catalogue).slice(0, 3);
  container.innerHTML = plans.map((plan) => {
    const price = priceFor(plan, "monthly") || (plan.prices || [])[0];
    return `<article class="preview-plan"><span>${escapeHtml(titleCase(plan.workspace_type))}</span><strong>${escapeHtml(plan.display_name)}</strong><small>${price ? `${money(price.amount, price.currency)} / ${price.billing_period === "annual" ? "year" : "month"}` : "Contact us for pricing"}</small></article>`;
  }).join("");
}

function renderPricing() {
  const container = document.querySelector("#publicPlanCatalogue");
  if (!container) return;
  if (!state.catalogue.length) {
    container.innerHTML = '<div class="site-error">Current pricing could not be loaded. Please try again or send a pricing enquiry.</div>';
    return;
  }

  const seenTypes = new Set();
  container.innerHTML = state.catalogue.map((plan) => {
    const price = priceFor(plan);
    const features = publicFeatureLabels(plan);
    const periodLabel = state.billingPeriod === "annual" ? "year" : "month";
    const seatText = Number(plan.included_member_seats) > 1
      ? `${Number(plan.included_member_seats)} people included`
      : "1 person included";
    const limitText = Number.isFinite(Number(plan.active_payment_limit))
      ? `${Number(plan.active_payment_limit)} active personal payments`
      : "Unlimited payment items";
    const extra = price && Number(price.extra_member_amount) > 0
      ? `<span>Additional person: ${money(price.extra_member_amount, price.currency)} per month</span>`
      : "";
    const action = plan.available_for_purchase === false || !price
      ? `<a class="secondary-button" href="contact.html?category=${encodeURIComponent(plan.workspace_type + "_plan")}">Contact us</a>`
      : `<a class="${plan.is_featured ? "site-button" : "secondary-button"}" href="signup.html?plan=${encodeURIComponent(plan.code)}">${escapeHtml(plan.cta_label || "Choose plan")}</a>`;

    const sectionId = seenTypes.has(plan.workspace_type) ? "" : ` id="${escapeHtml(plan.workspace_type)}-plans"`;
    seenTypes.add(plan.workspace_type);
    return `<article${sectionId} class="public-plan-card${plan.is_featured ? " featured" : ""}">
      <div class="public-plan-top"><span class="public-plan-type">${escapeHtml(titleCase(plan.workspace_type))}</span>${plan.is_featured ? '<span class="public-plan-badge">Recommended</span>' : ""}</div>
      <h2>${escapeHtml(plan.display_name)}</h2>
      <p class="public-plan-summary">${escapeHtml(plan.marketing_summary || plan.description)}</p>
      <div class="public-plan-price">${price ? `<strong>${money(price.amount, price.currency)}</strong><span> / ${periodLabel}</span>` : "<strong>Contact us</strong>"}</div>
      <div class="public-plan-meta"><span>${seatText}</span><span>${limitText}</span>${extra}</div>
      <ul class="public-plan-features">${features.slice(0, 8).map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}</ul>
      ${action}
    </article>`;
  }).join("");
}

async function initPricing() {
  const catalogueContainer = document.querySelector("#publicPlanCatalogue");
  const homeContainer = document.querySelector("#homePlanPreview");
  if (!catalogueContainer && !homeContainer) return;
  try {
    await loadCatalogue(state.currency);
    renderHomePlanPreview();
    renderPricing();
    const currencies = [...new Set(state.catalogue.flatMap((plan) => (plan.available_currencies || [])))].sort();
    const currencySelect = document.querySelector("#publicPricingCurrency");
    if (currencySelect && currencies.length) {
      currencySelect.innerHTML = currencies.map((currency) => `<option value="${escapeHtml(currency)}">${escapeHtml(currency)}</option>`).join("");
      currencySelect.value = currencies.includes(state.currency) ? state.currency : currencies[0];
      if (currencySelect.value !== state.currency) {
        state.currency = currencySelect.value;
        await loadCatalogue(state.currency);
        renderPricing();
      }
      currencySelect.addEventListener("change", async (event) => {
        state.currency = event.target.value;
        catalogueContainer.innerHTML = '<div class="site-loading">Loading current plans…</div>';
        try { await loadCatalogue(state.currency); renderPricing(); }
        catch (_error) { state.catalogue = []; renderPricing(); }
      });
    }
    document.querySelectorAll("[data-billing-period]").forEach((button) => {
      button.addEventListener("click", () => {
        state.billingPeriod = button.dataset.billingPeriod;
        document.querySelectorAll("[data-billing-period]").forEach((item) => item.classList.toggle("active", item === button));
        renderPricing();
      });
    });
  } catch (_error) {
    state.catalogue = [];
    renderHomePlanPreview();
    renderPricing();
  }
}

async function getPublicSupabaseClient() {
  if (publicSupabaseClient) return publicSupabaseClient;
  if (!isConfigured) return null;
  try {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.9/+esm");
    publicSupabaseClient = createClient(
      config.supabaseUrl,
      config.supabasePublishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      }
    );
    return publicSupabaseClient;
  } catch (error) {
    console.error("[Mushavo] Public Supabase client failed to load", {
      message: error?.message || "Client unavailable"
    });
    return null;
  }
}

function contactCategoryFromQuery() {
  const requested = new URLSearchParams(window.location.search).get("category");
  const field = document.querySelector("#enquiryCategory");
  if (!field || !requested) return;
  const aliases = {
    household: "sales", household_plan: "sales", family: "sales", family_plan: "sales", business: "sales", business_plan: "sales",
    personal: "sales", personal_plan: "sales", pricing: "sales", payment: "subscription_renewal",
    account: "support", technical: "support", general: "support"
  };
  const value = aliases[requested] || requested;
  if ([...field.options].some((option) => option.value === value)) field.value = value;
}

function populateCountries() {
  const field = document.querySelector("#enquiryCountry");
  if (!field) return;
  let displayNames;
  try {
    displayNames = new Intl.DisplayNames([document.documentElement.lang || "en"], { type: "region" });
  } catch (_error) {
    displayNames = null;
  }
  const fallback = { ZW: "Zimbabwe", ZA: "South Africa", BW: "Botswana", ZM: "Zambia", MZ: "Mozambique", GB: "United Kingdom", US: "United States" };
  const countries = COUNTRY_CODES.map((code) => ({ code, name: displayNames?.of(code) || fallback[code] || code }))
    .filter((country) => country.name && country.name !== country.code)
    .sort((left, right) => left.name.localeCompare(right.name));
  field.insertAdjacentHTML("beforeend", countries.map((country) => `<option value="${escapeHtml(country.code)}">${escapeHtml(country.name)}</option>`).join(""));
  const browserCountry = (navigator.language || "").split("-")[1]?.toUpperCase();
  const preferred = browserCountry || "ZW";
  if ([...field.options].some((option) => option.value === preferred)) field.value = preferred;
}

function showEnquiryError(message) {
  const errorBox = document.querySelector("#enquiryError");
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
  errorBox.focus?.();
}

async function submitEnquiry(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.querySelector("#enquirySubmit");
  const errorBox = document.querySelector("#enquiryError");
  errorBox.classList.add("hidden");
  if (!form.reportValidity()) return;
  if (!isConfigured) return showEnquiryError("The enquiry service is not configured yet. Please try again later.");
  const values = Object.fromEntries(new FormData(form).entries());
  if (String(values.website || "").trim()) return;

  button.disabled = true;
  button.textContent = "Sending…";
  const client = await getPublicSupabaseClient();
  if (!client) {
    button.disabled = false;
    button.textContent = "Send enquiry";
    return showEnquiryError("The enquiry service could not start. Please refresh the page and try again.");
  }
  const country = document.querySelector("#enquiryCountry");
  const payload = {
    full_name: String(values.full_name || "").trim(),
    email: String(values.email || "").trim().toLowerCase(),
    country_code: String(values.country_code || "").trim().toUpperCase(),
    country_name: String(country?.selectedOptions?.[0]?.textContent || "").trim(),
    enquiry_type: String(values.enquiry_type || "").trim(),
    message: String(values.message || "").trim()
  };
  try {
    const { error } = await client.from("enquiries").insert(payload);
    if (error) throw error;
    form.classList.add("hidden");
    const success = document.querySelector("#enquirySuccess");
    success.classList.remove("hidden");
    success.focus();
    form.reset();
    document.querySelector("#enquiryMessageCount").textContent = "0";
  } catch (error) {
    console.error("[Mushavo] Enquiry submission failed", {
      code: error?.code || "UNKNOWN",
      message: error?.message || "Submission failed"
    });
    showEnquiryError("Your enquiry could not be sent. Check your connection and try again.");
  } finally {
    button.disabled = false;
    button.textContent = "Send enquiry";
  }
}

function initContact() {
  const form = document.querySelector("#enquiryForm");
  if (!form) return;
  populateCountries();
  contactCategoryFromQuery();
  form.addEventListener("submit", submitEnquiry);
  const message = document.querySelector("#enquiryMessage");
  message.addEventListener("input", () => { document.querySelector("#enquiryMessageCount").textContent = String(message.value.length); });
  document.querySelector("[data-new-enquiry]").addEventListener("click", () => {
    document.querySelector("#enquirySuccess").classList.add("hidden");
    form.classList.remove("hidden");
    form.querySelector("input")?.focus();
  });
}

function initServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" }).catch(() => {
      // The public website remains usable when service-worker registration is unavailable.
    });
  });
}

initNavigation();
initPricing();
initContact();
initServiceWorker();
