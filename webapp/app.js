const catalogUrl = new URL("./products.json", window.location.href);
const statuses = ["New", "Contacted", "Qualified", "Closed"];
const productList = document.querySelector("#product-list");
const catalogStatus = document.querySelector("#catalog-status");
const productSearch = document.querySelector("#product-search");
const leadForm = document.querySelector("#lead-form");
const leadProduct = document.querySelector("#lead-product");
const leadStatus = document.querySelector("#lead-status");
const leadSummary = document.querySelector("#lead-summary");
const leadRows = document.querySelector("#lead-rows");
const emptyLeads = document.querySelector("#empty-leads");
const leadSearch = document.querySelector("#lead-search");
const statusFilter = document.querySelector("#status-filter");
const addLeadButton = document.querySelector("#add-lead");
const exportButton = document.querySelector("#export-leads");
const authForm = document.querySelector("#auth-form");
const authStatus = document.querySelector("#auth-status");
const signInButton = document.querySelector("#sign-in");
const signUpButton = document.querySelector("#sign-up");
const signOutButton = document.querySelector("#sign-out");
const accountToolbar = document.querySelector("#account-toolbar");
const accountEmail = document.querySelector("#account-email");
const accountWorkspace = document.querySelector("#account-workspace");
const databaseSetup = document.querySelector("#database-setup");
const activityList = document.querySelector("#activity-list");
const emptyActivity = document.querySelector("#empty-activity");
const leadColumns = "id,name,organization,customer_email,email,phone,product_id,notes,status,created_at";
const databaseConfig = window.BEC_SUPABASE_CONFIG;

let products = [];
let leads = [];
let activities = [];
let selectedProductId = "";
let currentUserId = undefined;
let currentUserEmail = "";
let isBecStaff = false;
let client = null;

function showLeadStatus(message, isError = false) {
  leadStatus.textContent = message;
  leadStatus.classList.toggle("status-error", isError);
}

function showAuthStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.classList.toggle("status-error", isError);
}

function errorMessage(error, fallback) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" &&
      "message" in error && typeof error.message === "string" && error.message) {
    return error.message;
  }
  return fallback;
}

function productName(productId) {
  return products.find((product) => product.id === productId)?.name ?? "Unknown product";
}

function renderProducts() {
  const search = productSearch.value.trim().toLocaleLowerCase();
  const visible = products.filter((product) =>
    `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase().includes(search),
  );
  productList.replaceChildren();

  for (const product of visible) {
    const card = document.createElement("article");
    card.className = "product-card";

    const category = document.createElement("p");
    category.className = "product-category";
    category.textContent = product.category;

    const title = document.createElement("h3");
    title.textContent = product.name;

    const description = document.createElement("p");
    description.textContent = product.description;

    const gallery = document.createElement("div");
    gallery.className = "product-gallery";
    gallery.setAttribute("aria-label", `${product.name} system images`);
    for (const [index, item] of product.images.entries()) {
      const figure = document.createElement("figure");
      figure.className = index === 0 ? "product-image product-image--primary" : "product-image";
      const image = document.createElement("img");
      image.src = item.src;
      image.alt = item.alt;
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => {
        image.hidden = true;
        figure.classList.add("product-image--unavailable");
        figure.setAttribute("aria-label", `${item.alt}. Image unavailable.`);
      }, { once: true });
      const caption = document.createElement("figcaption");
      caption.textContent = item.caption;
      figure.append(image, caption);
      gallery.append(figure);
    }

    const chooseButton = document.createElement("button");
    chooseButton.type = "button";
    chooseButton.className = "product-select";
    chooseButton.textContent = "Choose this product";
    chooseButton.setAttribute("aria-pressed", String(selectedProductId === product.id));
    chooseButton.classList.toggle("is-selected", selectedProductId === product.id);
    chooseButton.addEventListener("click", () => {
      selectedProductId = product.id;
      leadProduct.value = product.id;
      renderProducts();
      document.querySelector(".lead-panel").scrollIntoView({ behavior: "smooth", block: "start" });
      if (currentUserId && !isBecStaff) {
        document.querySelector("#lead-name").focus({ preventScroll: true });
      } else if (client && !currentUserId) {
        document.querySelector("#account-email-input").focus({ preventScroll: true });
      }
    });

    const source = document.createElement("span");
    source.className = "product-source";
    const sourceLink = document.createElement("a");
    sourceLink.href = product.source_url;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    sourceLink.textContent = "Product details on BEC ↗";
    source.append(sourceLink);

    card.append(category, title, description, gallery, chooseButton, source);
    productList.append(card);
  }

  catalogStatus.textContent = visible.length
    ? `${visible.length} ${visible.length === 1 ? "product" : "products"} shown.`
    : "No products match that search.";
}

function populateProductOptions() {
  leadProduct.replaceChildren(new Option("Choose a product", ""));
  for (const product of products) {
    leadProduct.add(new Option(product.name, product.id));
  }
  if (products.some((product) => product.id === selectedProductId)) {
    leadProduct.value = selectedProductId;
  }
  leadProduct.disabled = false;
  addLeadButton.disabled = !client || !currentUserId;
}

function createLeadRow(lead) {
  const row = document.createElement("tr");

  const contactCell = document.createElement("td");
  contactCell.className = "lead-contact";
  const name = document.createElement("strong");
  name.textContent = lead.name;
  const organization = document.createElement("span");
  organization.textContent = lead.organization;
  const customerAccount = document.createElement("span");
  customerAccount.textContent = lead.customer_email;
  const contact = document.createElement("span");
  contact.textContent = [lead.email, lead.phone].filter(Boolean).join(" · ");
  contactCell.append(name, organization, customerAccount, contact);

  const productCell = document.createElement("td");
  productCell.textContent = productName(lead.product_id);

  const dateCell = document.createElement("td");
  const date = new Date(lead.created_at);
  dateCell.textContent = Number.isNaN(date.valueOf()) ? "Unknown" : date.toLocaleDateString();

  const statusCell = document.createElement("td");
  const statusSelect = document.createElement("select");
  statusSelect.className = "lead-status-select";
  statusSelect.setAttribute("aria-label", `Status for ${lead.name}`);
  for (const status of statuses) statusSelect.add(new Option(status, status));
  statusSelect.value = lead.status;
  statusSelect.disabled = !isBecStaff;
  statusSelect.addEventListener("change", async () => {
    statusSelect.disabled = true;
    try {
      const { error } = await client.from("leads")
        .update({ status: statusSelect.value })
        .eq("id", lead.id);
      if (error) throw error;
      showLeadStatus(`${lead.name}'s status was updated.`);
      await refreshAccountData();
    } catch (error) {
      showLeadStatus(`Could not update this lead: ${errorMessage(error, "Unknown database error.")}`, true);
      await loadLeads().catch((loadError) => showLeadStatus(
        `Could not reload this lead: ${errorMessage(loadError, "Unknown database error.")}`,
        true,
      ));
    } finally {
      statusSelect.disabled = !isBecStaff;
    }
  });
  statusCell.append(statusSelect);

  const actionCell = document.createElement("td");
  actionCell.className = "lead-row-actions";
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "icon-button";
  deleteButton.textContent = "Remove";
  deleteButton.setAttribute("aria-label", `Remove ${lead.name}`);
  deleteButton.disabled = !isBecStaff;
  deleteButton.addEventListener("click", async () => {
    if (!window.confirm(`Remove ${lead.name} from your account? This change will be recorded.`)) return;
    deleteButton.disabled = true;
    try {
      const { error } = await client.from("leads").delete().eq("id", lead.id);
      if (error) throw error;
      showLeadStatus(`${lead.name} was removed.`);
      await refreshAccountData();
    } catch (error) {
      showLeadStatus(`Could not remove this lead: ${errorMessage(error, "Unknown database error.")}`, true);
      deleteButton.disabled = false;
    }
  });
  actionCell.append(deleteButton);

  row.append(contactCell, productCell, dateCell, statusCell, actionCell);
  if (lead.notes) row.title = lead.notes;
  return row;
}

function renderLeads() {
  const search = leadSearch.value.trim().toLocaleLowerCase();
  const status = statusFilter.value;
  const visible = leads.filter((lead) => {
    const matchesSearch = `${lead.name} ${lead.organization} ${lead.email} ${lead.phone} ${productName(lead.product_id)}`
      .toLocaleLowerCase().includes(search);
    return matchesSearch && (!status || lead.status === status);
  });
  leadRows.replaceChildren(...visible.map(createLeadRow));
  emptyLeads.hidden = visible.length > 0;
  leadSummary.textContent = `${leads.length} ${leads.length === 1 ? "lead" : "leads"} · ${leads.filter((lead) => lead.status === "New").length} new`;
  exportButton.disabled = leads.length === 0;
  addLeadButton.disabled = !client || !currentUserId || products.length === 0;
}

function renderActivities() {
  activityList.replaceChildren();
  for (const activity of activities) {
    const item = document.createElement("li");
    const actionLabels = {
      created: "added",
      updated: "updated",
      deleted: "removed",
      signed_in: "signed in",
      sign_out_requested: "requested sign-out",
      exported: "exported a CSV",
    };
    const action = actionLabels[activity.action] ?? "updated";
    const details = document.createElement("span");
    details.textContent = `${activity.subject} (${activity.customer_email}) ${action}`;
    if (activity.previous_status || activity.new_status) {
      details.textContent += ` (${activity.previous_status ?? "—"} → ${activity.new_status ?? "—"})`;
    }
    const date = document.createElement("time");
    date.dateTime = activity.created_at;
    date.textContent = new Date(activity.created_at).toLocaleString();
    item.append(details, date);
    activityList.append(item);
  }
  emptyActivity.hidden = activities.length > 0;
}

async function loadLeads() {
  const { data, error } = await client.from("leads")
    .select(leadColumns)
    .order("created_at", { ascending: false });
  if (error) throw error;
  leads = data;
  renderLeads();
}

async function loadActivities() {
  const { data, error } = await client.from("lead_activity")
    .select("action,subject,customer_email,previous_status,new_status,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  activities = data;
  renderActivities();
}

async function logAccountActivity(action) {
  const { error } = await client.rpc("log_account_activity", { p_action: action });
  if (error) throw error;
}

async function refreshAccountData() {
  try {
    await Promise.all([loadLeads(), loadActivities()]);
  } catch (error) {
    showLeadStatus(`Could not load cloud data: ${errorMessage(error, "Unknown database error.")}`, true);
  }
}

async function setCurrentUser(user) {
  const nextUserId = user?.id ?? null;
  const nextUserEmail = user?.email ?? "";
  const nextIsBecStaff = user?.app_metadata?.role === "bec_staff";
  if (currentUserId === nextUserId &&
      currentUserEmail === nextUserEmail &&
      isBecStaff === nextIsBecStaff) return;
  currentUserId = nextUserId;
  currentUserEmail = nextUserEmail;
  isBecStaff = nextIsBecStaff;
  leads = [];
  activities = [];
  renderLeads();
  renderActivities();
  accountToolbar.hidden = !user;
  accountWorkspace.hidden = !user;
  authForm.hidden = Boolean(user);
  accountEmail.textContent = user
    ? `${isBecStaff ? "BEC staff" : "Customer"} · ${currentUserEmail}`
    : "";
  document.querySelector("#lead-form").hidden = isBecStaff;
  document.querySelector("#enquiries-heading").textContent = isBecStaff ? "Customer enquiries" : "Your enquiries";
  document.querySelector("#lead-search").placeholder = isBecStaff ? "Search customers and enquiries" : "Search your enquiries";
  document.querySelector(".activity-panel summary").textContent = isBecStaff
    ? "Recent activity across customer enquiries"
    : "Recent activity on your enquiries";
  showLeadStatus("");
  showAuthStatus("");
  if (user) {
    await refreshAccountData();
  }
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

async function exportLeads() {
  const columns = ["Customer account", "Name", "Organization", "Email", "Phone", "Product", "Status", "Added", "Notes"];
  const rows = leads.map((lead) => [
    lead.customer_email,
    lead.name,
    lead.organization,
    lead.email,
    lead.phone,
    productName(lead.product_id),
    lead.status,
    lead.created_at,
    lead.notes,
  ]);
  const csv = `\uFEFF${[columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
  if (window.showSaveFilePicker) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: "bec-leads.csv",
        types: [{ description: "CSV file", accept: { "text/csv": [".csv"] } }],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(csv);
      await writable.close();
      await logAccountActivity("exported");
      await loadActivities();
      showLeadStatus("Lead list saved.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      showLeadStatus(`Could not save the CSV: ${errorMessage(error, "Unknown file error.")}`, true);
    }
    return;
  }

  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "bec-leads.csv";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  try {
    await logAccountActivity("exported");
    await loadActivities();
  } catch (error) {
    showLeadStatus(`CSV download started, but its activity could not be recorded: ${errorMessage(error, "Unknown database error.")}`, true);
    return;
  }
  showLeadStatus("Lead list downloaded. Choose the Lead Exports folder if your browser asks where to save it.");
}

async function signIn(event) {
  event.preventDefault();
  if (!authForm.reportValidity()) return;
  signInButton.disabled = true;
  signUpButton.disabled = true;
  const formData = new FormData(authForm);
  try {
    const { error } = await client.auth.signInWithPassword({
      email: String(formData.get("email")).trim(),
      password: String(formData.get("password")),
    });
    if (error) throw error;
    authForm.reset();
    showAuthStatus("Signed in.");
  } catch (error) {
    showAuthStatus(`Could not sign in: ${errorMessage(error, "Unknown authentication error.")}`, true);
  } finally {
    signInButton.disabled = false;
    signUpButton.disabled = false;
  }
}

async function signUp() {
  if (!authForm.reportValidity()) return;
  signInButton.disabled = true;
  signUpButton.disabled = true;
  const formData = new FormData(authForm);
  try {
    const { data, error } = await client.auth.signUp({
      email: String(formData.get("email")).trim(),
      password: String(formData.get("password")),
    });
    if (error) throw error;
    authForm.reset();
    showAuthStatus(data.session
      ? "Account created and signed in."
      : "Account created. Check your email to confirm the address, then sign in.");
  } catch (error) {
    showAuthStatus(`Could not create the account: ${errorMessage(error, "Unknown authentication error.")}`, true);
  } finally {
    signInButton.disabled = false;
    signUpButton.disabled = false;
  }
}

async function addLead(event) {
  event.preventDefault();
  if (!leadForm.reportValidity()) return;

  const formData = new FormData(leadForm);
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!email && !phone) {
    showLeadStatus("Enter an email address or phone number so this lead can be contacted.", true);
    document.querySelector("#lead-email").focus();
    return;
  }
  const lead = {
    name: String(formData.get("name")).trim(),
    organization: String(formData.get("organization")).trim(),
    email,
    phone,
    product_id: String(formData.get("product")),
    notes: String(formData.get("notes") ?? "").trim(),
  };
  if (!lead.name || !lead.organization || !products.some((product) => product.id === lead.product_id)) {
    showLeadStatus("Check the contact name, organization, and product interest.", true);
    return;
  }

  addLeadButton.disabled = true;
  try {
    const { error } = await client.from("leads").insert(lead);
    if (error) throw error;
    leadForm.reset();
    selectedProductId = "";
    renderProducts();
    showLeadStatus(`${lead.name} was saved to your account.`);
    await refreshAccountData();
  } catch (error) {
    showLeadStatus(`Could not save this lead: ${errorMessage(error, "Unknown database error.")}`, true);
  } finally {
    addLeadButton.disabled = !client || !currentUserId || products.length === 0;
  }
}

async function signOut() {
  signOutButton.disabled = true;
  let activityError = null;
  try {
    await logAccountActivity("sign_out_requested");
  } catch (error) {
    activityError = error;
  }
  try {
    const { error } = await client.auth.signOut();
    if (error) throw error;
  } catch (error) {
    showLeadStatus(`Could not sign out: ${errorMessage(error, "Unknown authentication error.")}`, true);
    return;
  } finally {
    signOutButton.disabled = false;
  }
  if (activityError) {
    showLeadStatus(`Signed out, but the sign-out request could not be recorded: ${errorMessage(activityError, "Unknown database error.")}`, true);
  }
}

productSearch.addEventListener("input", renderProducts);
leadProduct.addEventListener("change", () => {
  selectedProductId = leadProduct.value;
  renderProducts();
});
leadSearch.addEventListener("input", renderLeads);
statusFilter.addEventListener("change", renderLeads);
exportButton.addEventListener("click", exportLeads);
leadForm.addEventListener("submit", addLead);
authForm.addEventListener("submit", signIn);
signUpButton.addEventListener("click", signUp);
signOutButton.addEventListener("click", signOut);

const configIsValid = typeof databaseConfig?.url === "string" &&
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(databaseConfig.url) &&
  typeof databaseConfig.publishableKey === "string" &&
  databaseConfig.publishableKey.length > 20 &&
  !databaseConfig.publishableKey.includes("YOUR_");

if (configIsValid && window.supabase?.createClient) {
  client = window.supabase.createClient(databaseConfig.url, databaseConfig.publishableKey);
  authForm.hidden = false;
  client.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => {
      setCurrentUser(session?.user ?? null)
        .then(async () => {
          if (_event === "SIGNED_IN" && session?.user) {
            try {
              await logAccountActivity("signed_in");
              await loadActivities();
            } catch (error) {
              showLeadStatus(`Signed in, but sign-in activity could not be recorded: ${errorMessage(error, "Unknown database error.")}`, true);
            }
          }
        })
        .catch((error) => showLeadStatus(`Could not load cloud data: ${errorMessage(error, "Unknown database error.")}`, true));
    }, 0);
  });
  client.auth.getSession()
    .then(({ data, error }) => {
      if (error) throw error;
      return setCurrentUser(data.session?.user ?? null);
    })
    .catch((error) => showAuthStatus(`Could not connect to your account: ${errorMessage(error, "Unknown authentication error.")}`, true));
} else {
  databaseSetup.hidden = false;
  if (configIsValid) {
    databaseSetup.querySelector("p").textContent =
      "The secure database client could not load. Check your connection or try again later.";
  }
}

fetch(catalogUrl)
  .then((response) => {
    if (!response.ok) throw new Error(`Catalog request failed (${response.status}).`);
    return response.json();
  })
  .then((data) => {
    if (!Array.isArray(data) || data.some((product) => !product.id || !product.name || !Array.isArray(product.images))) {
      throw new Error("The product catalog has an invalid format.");
    }
    products = data;
    renderProducts();
    populateProductOptions();
  })
  .catch((error) => {
    catalogStatus.textContent = errorMessage(error, "Could not load the product catalog.");
    leadProduct.replaceChildren(new Option("Product list unavailable", ""));
    leadProduct.disabled = true;
    addLeadButton.disabled = true;
  });
