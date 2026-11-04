const setupNotice = document.querySelector("#staff-setup-notice");
const setupCopy = document.querySelector("#staff-setup-copy");
const demoNotice = document.querySelector("#staff-demo-banner");
const deniedNotice = document.querySelector("#staff-denied");
const deniedCopy = document.querySelector("#staff-denied-copy");
const workspace = document.querySelector("#staff-workspace");
const workspaceStatus = document.querySelector("#staff-status");
const staffAccountLabel = document.querySelector("#staff-account");
const signOutButton = document.querySelector("#staff-sign-out");
const leadRows = document.querySelector("#staff-lead-rows");
const leadSearch = document.querySelector("#staff-lead-search");
const leadStatusFilter = document.querySelector("#staff-status-filter");
const leadSummary = document.querySelector("#staff-lead-summary");
const emptyLeads = document.querySelector("#staff-empty-leads");
const exportLeadsButton = document.querySelector("#staff-export-leads");
const productSelect = document.querySelector("#campaign-product");
const campaignForm = document.querySelector("#campaign-form");
const campaignObjective = document.querySelector("#campaign-objective");
const campaignAudience = document.querySelector("#campaign-audience");
const campaignMessage = document.querySelector("#campaign-message");
const campaignCta = document.querySelector("#campaign-cta");
const generateButton = document.querySelector("#generate-campaign");
const submitCampaignButton = document.querySelector("#submit-campaign");
const previewList = document.querySelector("#campaign-preview-list");
const campaignImagePreview = document.querySelector("#campaign-image-preview");
const campaignImage = document.querySelector("#campaign-image");
const campaignImageCaption = document.querySelector("#campaign-image-caption");
const campaignRows = document.querySelector("#campaign-rows");
const emptyCampaigns = document.querySelector("#empty-campaigns");
const accountForm = document.querySelector("#social-account-form");
const accountStatus = document.querySelector("#social-account-status");
const accountList = document.querySelector("#social-account-list");
const accountTargets = document.querySelector("#social-account-targets");
const noAccountsMessage = document.querySelector("#no-social-accounts");
const activityList = document.querySelector("#staff-activity-list");
const emptyActivity = document.querySelector("#staff-empty-activity");
const STAFF_STATUSES = ["New", "Contacted", "Qualified", "Closed"];
const MAX_CAMPAIGN_COPY = 3000;

const config = window.BEC_SUPABASE_CONFIG;
const databaseConfigured = Boolean(config?.url && config?.publishableKey);
const supabaseReady = Boolean(window.supabase?.createClient);
const client = databaseConfigured && supabaseReady
  ? window.supabase.createClient(config.url, config.publishableKey)
  : null;
const demoMode = new URLSearchParams(window.location.search).get("demo") === "1";

let currentUser = null;
let productCatalog = [];
let productsById = new Map();
let leads = [];
let socialAccounts = [];

function showWorkspaceStatus(message, isError = false) {
  workspaceStatus.textContent = message;
  workspaceStatus.classList.toggle("status-error", isError);
}

function showAccountStatus(message, isError = false) {
  accountStatus.textContent = message;
  accountStatus.classList.toggle("status-error", isError);
}

function setWorkspaceReady(isReady) {
  workspace.hidden = !isReady;
  signOutButton.disabled = !isReady || demoMode;
  signOutButton.hidden = demoMode;
  exportLeadsButton.disabled = !isReady || demoMode;
  submitCampaignButton.disabled = !isReady || socialAccounts.length === 0;
}

function addCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.append(cell);
  return cell;
}

function productName(productId) {
  return productsById.get(productId)?.name || productId || "Unspecified product";
}

function localDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Unknown date" : date.toLocaleString();
}

async function loadProducts() {
  const response = await fetch("./products.json");
  if (!response.ok) throw new Error(`Could not load products (${response.status}).`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("The product catalog has an invalid format.");
  productCatalog = data;
  productsById = new Map(data.map((product) => [product.id, product]));
  productSelect.replaceChildren();
  for (const product of productCatalog) {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = product.name;
    productSelect.append(option);
  }
  productSelect.disabled = data.length === 0;
  if (!data.length) throw new Error("There are no products available for a campaign.");
  const selectedProductId = sessionStorage.getItem("bec-selected-product");
  if (selectedProductId && productsById.has(selectedProductId)) productSelect.value = selectedProductId;
  renderCampaignPreviews();
}

function filteredLeads() {
  const query = leadSearch.value.trim().toLocaleLowerCase();
  const status = leadStatusFilter.value;
  return leads.filter((lead) => {
    const haystack = [
      lead.name,
      lead.organization,
      lead.email,
      lead.phone,
      lead.customer_email,
      productName(lead.product_id),
      lead.notes,
    ].join(" ").toLocaleLowerCase();
    return (!query || haystack.includes(query)) && (!status || lead.status === status);
  });
}

function renderLeads() {
  leadRows.replaceChildren();
  const matchingLeads = filteredLeads();
  for (const lead of matchingLeads) {
    const row = document.createElement("tr");
    const contact = document.createElement("td");
    const name = document.createElement("strong");
    name.textContent = lead.name;
    const organization = document.createElement("span");
    organization.className = "table-subtext";
    organization.textContent = lead.organization;
    const email = document.createElement("span");
    email.className = "table-subtext";
    email.textContent = lead.email || lead.phone || "No contact details";
    const ownerEmail = document.createElement("span");
    ownerEmail.className = "table-subtext";
    ownerEmail.textContent = `Customer account: ${lead.customer_email || "Not available"}`;
    contact.append(name, organization, email, ownerEmail);
    row.append(contact);

    addCell(row, productName(lead.product_id));
    const enquiry = document.createElement("td");
    enquiry.textContent = lead.notes || "—";
    row.append(enquiry);
    addCell(row, localDate(lead.created_at));

    const statusCell = document.createElement("td");
    const statusSelect = document.createElement("select");
    statusSelect.className = "lead-status-select";
    statusSelect.setAttribute("aria-label", `Status for ${lead.name}`);
    for (const value of STAFF_STATUSES) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      statusSelect.append(option);
    }
    statusSelect.value = STAFF_STATUSES.includes(lead.status) ? lead.status : "New";
    statusSelect.disabled = demoMode;
    if (!demoMode) {
      statusSelect.addEventListener("change", () => updateLeadStatus(lead.id, statusSelect.value, statusSelect));
    }
    statusCell.append(statusSelect);
    row.append(statusCell);
    leadRows.append(row);
  }
  leadSummary.textContent = `${matchingLeads.length} of ${leads.length} ${leads.length === 1 ? "enquiry" : "enquiries"}`;
  emptyLeads.hidden = matchingLeads.length !== 0;
}

async function loadLeads() {
  const { data, error } = await client
    .from("leads")
    .select("id, owner_id, customer_email, name, organization, email, phone, product_id, notes, status, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load customer enquiries: ${error.message}`);
  leads = data;
  renderLeads();
}

async function updateLeadStatus(leadId, status, select) {
  select.disabled = true;
  showWorkspaceStatus("Updating enquiry status…");
  const { error } = await client.from("leads").update({ status }).eq("id", leadId);
  select.disabled = false;
  if (error) {
    showWorkspaceStatus(`Could not update enquiry: ${error.message}`, true);
    await loadLeads();
    return;
  }
  showWorkspaceStatus("Enquiry status updated.");
  await Promise.all([loadLeads(), loadActivity()]);
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

async function exportLeads() {
  const records = filteredLeads();
  if (!records.length) {
    showWorkspaceStatus("There are no matching enquiries to export.", true);
    return;
  }
  const columns = ["Customer", "Organization", "Contact email", "Phone", "Customer account", "Product", "Enquiry", "Status", "Created at"];
  const lines = [
    columns.map(csvCell).join(","),
    ...records.map((lead) => [
      lead.name,
      lead.organization,
      lead.email,
      lead.phone,
      lead.customer_email,
      productName(lead.product_id),
      lead.notes,
      lead.status,
      lead.created_at,
    ].map(csvCell).join(",")),
  ];
  try {
    const file = new Blob(["\ufeff", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: "bec-leads.csv",
        types: [{ description: "CSV file", accept: { "text/csv": [".csv"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(file);
      await writable.close();
    } else {
      const url = URL.createObjectURL(file);
      const download = document.createElement("a");
      download.href = url;
      download.download = "bec-leads.csv";
      download.click();
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
    showWorkspaceStatus(`Could not save CSV: ${error.message}`, true);
    return;
  }

  const { error } = await client.rpc("log_account_activity", { p_action: "exported" });
  if (error) {
    showWorkspaceStatus(`The CSV was saved, but its activity could not be recorded: ${error.message}`, true);
    return;
  }
  showWorkspaceStatus("Lead list saved.");
  await loadActivity();
}

function buildCampaignSeo(product, platform) {
  const isNurseCall = product.category.toLowerCase().includes("nurse call");
  const categoryKeyword = isNurseCall
    ? `${product.category.startsWith("Wireless") ? "wireless" : "wired"} nurse call system`
    : "IP video intercom";
  const keywords = [...new Set([product.name, categoryKeyword, product.category])];
  const hashtags = isNurseCall
    ? ["#BECIntegrated", "#NurseCall", "#HealthcareTechnology"]
    : ["#BECIntegrated", "#VideoIntercom", "#BuildingEntry"];
  const methods = {
    Facebook: [
      "Lead with the product and category phrase in the opening sentence.",
      "Use descriptive image alt text and a clear link preview.",
      "Keep the call to action direct; use a few relevant hashtags.",
    ],
    Instagram: [
      "Place the product/category phrase in the first caption line.",
      "Add descriptive image alt text and readable text overlays.",
      "Use a small set of specific, relevant hashtags.",
    ],
    LinkedIn: [
      "Put the product/category phrase in the opening lines.",
      "Keep the copy professional and use only verified product details.",
      "Use a few relevant hashtags and a clear next step.",
    ],
    X: [
      "Front-load the product/category phrase so it remains visible.",
      "Keep one clear call to action and a small set of relevant hashtags.",
      "Check the final character count before posting.",
    ],
    YouTube: [
      "Use the product/category phrase near the start of the title.",
      "Repeat it naturally in the first description sentence.",
      "Add accurate video captions, descriptive thumbnail text, and relevant hashtags.",
    ],
  };
  return { keywords, hashtags, methods: methods[platform] || methods.Facebook };
}

function composePost(platform, product, seo) {
  if (!product) return "";
  const audience = campaignAudience.value.trim() || "healthcare and senior-living teams";
  const message = campaignMessage.value.trim();
  const cta = campaignCta.value.trim() || "Contact BEC to learn more";
  const goalText = {
    awareness: "Discover a communication solution designed for your team.",
    education: "Explore how the right system can support clear, reliable communication.",
    consultation: "Talk with BEC about a solution that fits your facility.",
    launch: "See how BEC can help your team plan its next communication upgrade.",
  }[campaignObjective.value] || "Explore a communication solution for your team.";
  const keyword = seo.keywords[1];
  const messageLine = message ? `\n\n${message}` : "";
  let body;
  if (platform === "YouTube") {
    body = `Title: ${product.name} | ${keyword}\n\nDescription: ${product.description} For ${audience}. ${goalText}${messageLine}\n\n${cta}`;
  } else if (platform === "LinkedIn") {
    body = `For ${audience}: ${product.name} — ${keyword} from BEC Integrated Solutions.\n\n${goalText}${messageLine}\n\n${cta}`;
  } else if (platform === "X") {
    body = `${product.name} | ${keyword} for ${audience}. ${message ? `${message} ` : ""}${cta}`;
  } else if (platform === "Instagram") {
    body = `${keyword} for ${audience}.\n\nMeet ${product.name}. ${goalText}${messageLine}\n\n${cta}`;
  } else {
    body = `Looking at ${keyword} options for ${audience}? Explore ${product.name} from BEC Integrated Solutions.\n\n${goalText}${messageLine}\n\n${cta}`;
  }

  const hashtagLine = seo.hashtags.join(" ");
  const post = `${body}\n\n${hashtagLine}`;
  const limit = platform === "X" ? 280 : MAX_CAMPAIGN_COPY;
  if (post.length <= limit) return post;
  const suffix = `…\n\n${hashtagLine}`;
  return `${body.slice(0, limit - suffix.length).trimEnd()}${suffix}`;
}

function renderCampaignPreviews() {
  const product = productsById.get(productSelect.value);
  const image = product?.images?.[0];
  campaignImagePreview.hidden = !image;
  if (image) {
    campaignImage.src = image.src;
    campaignImage.alt = image.alt;
    campaignImageCaption.textContent = `${product.name} · ${image.caption}`;
  }

  previewList.replaceChildren();
  for (const platform of ["Facebook", "Instagram", "LinkedIn", "X", "YouTube"]) {
    const seo = product ? buildCampaignSeo(product, platform) : { keywords: [], hashtags: [], methods: [] };
    const card = document.createElement("article");
    card.className = "platform-preview";
    const heading = document.createElement("h4");
    heading.textContent = platform;
    const text = document.createElement("p");
    text.className = "preview-copy";
    text.textContent = composePost(platform, product, seo);
    const count = document.createElement("span");
    count.className = "preview-count";
    count.textContent = `${text.textContent.length} characters`;
    const seoDetails = document.createElement("div");
    seoDetails.className = "preview-seo";
    for (const [label, items, className] of [
      ["Focus keywords", seo.keywords, "preview-keywords"],
      ["Hashtags", seo.hashtags, "preview-hashtags"],
      ["Platform SEO methods", seo.methods, "preview-methods"],
    ]) {
      const section = document.createElement("section");
      section.className = "preview-seo-section";
      const title = document.createElement("h5");
      title.textContent = label;
      const list = document.createElement("ul");
      list.className = className;
      for (const item of items) {
        const entry = document.createElement("li");
        entry.textContent = item;
        list.append(entry);
      }
      section.append(title, list);
      seoDetails.append(section);
    }
    card.append(heading, text, count, seoDetails);
    previewList.append(card);
  }
}

function renderSocialAccounts() {
  accountList.replaceChildren();
  accountTargets.replaceChildren();
  noAccountsMessage.hidden = socialAccounts.length > 0;
  for (const account of socialAccounts) {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${account.platform} · ${account.account_name} (${account.account_handle})`;
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "button button-secondary";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", `Remove ${account.platform} destination ${account.account_name}`);
    removeButton.disabled = demoMode;
    if (!demoMode) removeButton.addEventListener("click", () => removeSocialAccount(account));
    item.append(label, removeButton);
    accountList.append(item);

    const targetLabel = document.createElement("label");
    targetLabel.className = "account-target";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = account.id;
    checkbox.dataset.platform = account.platform;
    checkbox.addEventListener("change", updateSubmitAvailability);
    const name = document.createElement("span");
    name.textContent = `${account.platform} · ${account.account_name}`;
    targetLabel.append(checkbox, name);
    accountTargets.append(targetLabel);
  }
  updateSubmitAvailability();
}

function updateSubmitAvailability() {
  const anyTargets = accountTargets.querySelector('input[type="checkbox"]:checked');
  submitCampaignButton.disabled = (!currentUser && !demoMode) || !anyTargets;
}

async function loadSocialAccounts() {
  const { data, error } = await client
    .from("social_accounts")
    .select("id, platform, account_name, account_handle, created_at")
    .order("platform")
    .order("account_name");
  if (error) throw new Error(`Could not load social destinations: ${error.message}`);
  socialAccounts = data;
  renderSocialAccounts();
}

async function addSocialAccount(event) {
  event.preventDefault();
  if (demoMode) return;
  const platform = document.querySelector("#social-platform").value;
  const accountName = document.querySelector("#social-account-name").value.trim();
  const accountHandle = document.querySelector("#social-account-handle").value.trim();
  if (!accountName || !accountHandle) {
    showAccountStatus("Enter both a profile name and handle or profile URL.", true);
    return;
  }
  showAccountStatus("Adding destination…");
  const { error } = await client.from("social_accounts").insert({
    platform,
    account_name: accountName,
    account_handle: accountHandle,
  });
  if (error) {
    showAccountStatus(`Could not add destination: ${error.message}`, true);
    return;
  }
  accountForm.reset();
  showAccountStatus("Social destination added.");
  await loadSocialAccounts();
}

async function removeSocialAccount(account) {
  if (demoMode) return;
  if (!window.confirm(`Remove ${account.platform} destination "${account.account_name}"? Previously submitted campaigns will remain in the queue.`)) return;
  const { error } = await client.from("social_accounts").delete().eq("id", account.id);
  if (error) {
    showAccountStatus(`Could not remove destination: ${error.message}`, true);
    return;
  }
  showAccountStatus("Social destination removed.");
  await loadSocialAccounts();
}

async function submitCampaign(event) {
  event.preventDefault();
  const product = productsById.get(productSelect.value);
  if (!product) {
    showWorkspaceStatus("Choose a valid product before submitting the campaign.", true);
    return;
  }
  const targets = [...accountTargets.querySelectorAll('input[type="checkbox"]:checked')].map((checkbox) => ({
    account_id: checkbox.value,
    content: composePost(
      checkbox.dataset.platform,
      product,
      buildCampaignSeo(product, checkbox.dataset.platform),
    ),
  }));
  if (!targets.length) {
    showWorkspaceStatus("Choose at least one social destination before submitting.", true);
    return;
  }
  if (targets.some((target) => !target.content || target.content.length > MAX_CAMPAIGN_COPY)) {
    showWorkspaceStatus("Check the campaign text; each account's post must contain 1–3,000 characters.", true);
    return;
  }

  if (demoMode) {
    const row = document.createElement("tr");
    addCell(row, productName(productSelect.value));
    addCell(row, campaignObjective.value);
    addCell(row, "Demo preview");
    addCell(row, "not saved");
    campaignRows.prepend(row);
    emptyCampaigns.hidden = true;
    showWorkspaceStatus("Demo preview only — the campaign was not saved.");
    return;
  }

  submitCampaignButton.disabled = true;
  showWorkspaceStatus("Submitting campaign to the BEC review queue…");
  const { error } = await client.rpc("submit_campaign", {
    p_product_id: productSelect.value,
    p_objective: campaignObjective.value,
    p_audience: campaignAudience.value.trim(),
    p_key_message: campaignMessage.value.trim(),
    p_call_to_action: campaignCta.value.trim(),
    p_targets: targets,
  });
  if (error) {
    showWorkspaceStatus(`Campaign was not submitted: ${error.message}`, true);
    updateSubmitAvailability();
    return;
  }

  showWorkspaceStatus("Campaign submitted to the BEC review queue. It has not been published to social platforms.");
  await Promise.all([loadCampaigns(), loadActivity()]);
  updateSubmitAvailability();
}

async function loadCampaigns() {
  const { data, error } = await client
    .from("campaigns")
    .select("id, product_id, objective, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Could not load campaign history: ${error.message}`);
  campaignRows.replaceChildren();
  emptyCampaigns.hidden = data.length !== 0;
  for (const campaign of data) {
    const row = document.createElement("tr");
    addCell(row, productName(campaign.product_id));
    addCell(row, campaign.objective);
    addCell(row, localDate(campaign.created_at));
    addCell(row, campaign.status.replaceAll("_", " "));
    campaignRows.append(row);
  }
}

async function loadActivity() {
  const { data, error } = await client
    .from("lead_activity")
    .select("id, customer_email, subject, action, previous_status, new_status, created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(`Could not load staff activity: ${error.message}`);
  activityList.replaceChildren();
  emptyActivity.hidden = data.length !== 0;
  for (const entry of data) {
    const item = document.createElement("li");
    const description = entry.action === "updated"
      ? `${entry.subject}: ${entry.previous_status || "unknown"} → ${entry.new_status || "unknown"}`
      : entry.action === "campaign_submitted"
        ? `Campaign submitted by ${entry.customer_email}`
        : `${entry.subject}: ${entry.action.replaceAll("_", " ")}`;
    item.append(document.createTextNode(description));
    const time = document.createElement("time");
    time.dateTime = entry.created_at;
    time.textContent = `${entry.customer_email || "BEC staff"} · ${localDate(entry.created_at)}`;
    item.append(time);
    activityList.append(item);
  }
}

async function signOut() {
  signOutButton.disabled = true;
  const { error } = await client.auth.signOut();
  if (error) {
    showWorkspaceStatus(`Could not sign out: ${error.message}`, true);
    signOutButton.disabled = false;
    return;
  }
  window.location.replace("./staff-login.html");
}

async function initializeWorkspace(user) {
  if (user?.app_metadata?.role !== "bec_staff") {
    setWorkspaceReady(false);
    deniedNotice.hidden = false;
    deniedCopy.textContent = user
      ? "This signed-in account does not have the BEC staff role. Contact an administrator to request access."
      : "A valid BEC staff sign-in is required to access customer enquiries.";
    if (user) await client.auth.signOut();
    return;
  }

  currentUser = user;
  staffAccountLabel.textContent = user.email || "BEC staff";
  deniedNotice.hidden = true;
  setWorkspaceReady(true);
  try {
    await loadProducts();
    await Promise.all([loadLeads(), loadSocialAccounts(), loadCampaigns(), loadActivity()]);
    showWorkspaceStatus("Staff workspace ready.");
  } catch (error) {
    showWorkspaceStatus(error.message, true);
  }
}

async function initializeDemoWorkspace() {
  currentUser = null;
  setupNotice.hidden = true;
  deniedNotice.hidden = true;
  demoNotice.hidden = false;
  accountForm.querySelectorAll("input, select, button").forEach((control) => {
    control.disabled = true;
  });
  accountStatus.textContent = "Social account management is disabled in this demo.";
  setWorkspaceReady(true);

  await loadProducts();
  leads = [
    {
      id: "demo-lead-1",
      customer_email: "alex@example.com",
      name: "Alex Morgan",
      organization: "Sample Care Center",
      email: "alex@example.com",
      phone: "",
      product_id: productCatalog[0].id,
      notes: "Sample enquiry for a facility renovation.",
      status: "New",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-lead-2",
      customer_email: "jordan@example.com",
      name: "Jordan Lee",
      organization: "Example Senior Living",
      email: "jordan@example.com",
      phone: "",
      product_id: productCatalog[1]?.id || productCatalog[0].id,
      notes: "Sample request for product information.",
      status: "Contacted",
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ];
  renderLeads();
  socialAccounts = [
    { id: "demo-social-1", platform: "Facebook", account_name: "BEC Integrated Solutions", account_handle: "@BECIntegrated" },
    { id: "demo-social-2", platform: "LinkedIn", account_name: "BEC Integrated Solutions", account_handle: "BEC Integrated Solutions" },
  ];
  renderSocialAccounts();
  for (const [productId, objective, status] of [
    [productCatalog[0].id, "awareness", "pending review"],
  ]) {
    const row = document.createElement("tr");
    addCell(row, productName(productId));
    addCell(row, objective);
    addCell(row, "Demo preview");
    addCell(row, status);
    campaignRows.append(row);
  }
  emptyCampaigns.hidden = true;
  activityList.replaceChildren();
  const demoActivity = document.createElement("li");
  demoActivity.textContent = "Sample enquiry created";
  const activityTime = document.createElement("time");
  activityTime.textContent = "Example data · Demo preview";
  demoActivity.append(activityTime);
  activityList.append(demoActivity);
  emptyActivity.hidden = true;
  showWorkspaceStatus("Demo preview — sample data only. Changes are not saved.");
}

leadSearch.addEventListener("input", renderLeads);
leadStatusFilter.addEventListener("change", renderLeads);
exportLeadsButton.addEventListener("click", exportLeads);
accountForm.addEventListener("submit", addSocialAccount);
campaignForm.addEventListener("submit", submitCampaign);
generateButton.addEventListener("click", renderCampaignPreviews);
for (const input of [productSelect, campaignObjective, campaignAudience, campaignMessage, campaignCta]) {
  input.addEventListener("input", renderCampaignPreviews);
  input.addEventListener("change", renderCampaignPreviews);
}
signOutButton.addEventListener("click", signOut);

if (demoMode) {
  initializeDemoWorkspace().catch((error) => {
    showWorkspaceStatus(`Could not load demo workspace: ${error.message}`, true);
  });
} else if (!databaseConfigured || !supabaseReady) {
  setupNotice.hidden = false;
  setupCopy.textContent = !databaseConfigured
    ? "An administrator must configure the Supabase project URL and publishable key before the staff workspace can access customer data."
    : "The secure database service could not be loaded. Check the connection and reload this page.";
} else {
  client.auth.getSession().then(({ data, error }) => {
    if (error) {
      deniedNotice.hidden = false;
      deniedCopy.textContent = `Could not validate the current sign-in: ${error.message}`;
      return;
    }
    initializeWorkspace(data.session?.user);
  });
  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      window.location.replace("./staff-login.html");
      return;
    }
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
      initializeWorkspace(session?.user);
    }
  });
}
