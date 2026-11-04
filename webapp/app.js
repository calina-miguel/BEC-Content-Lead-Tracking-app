const catalogUrl = new URL("./products.json", window.location.href);
const storageKey = "bec-content-lead-tracking:v1";
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
const restoreButton = document.querySelector("#restore-demo");

const sampleLeads = [
  {
    id: "demo-1",
    name: "Jordan Lee",
    organization: "Sample Community Center",
    email: "jordan@example.invalid",
    phone: "",
    productId: "mv200plus",
    notes: "Asked for an overview of wireless options.",
    status: "New",
    createdAt: new Date().toISOString(),
    demo: true,
  },
  {
    id: "demo-2",
    name: "Avery Morgan",
    organization: "Example Senior Living",
    email: "",
    phone: "(555) 010-0102",
    productId: "tektone-nc160",
    notes: "Would like to compare wired system options.",
    status: "Contacted",
    createdAt: new Date().toISOString(),
    demo: true,
  },
  {
    id: "demo-3",
    name: "Casey Patel",
    organization: "Demo Medical Pavilion",
    email: "casey@example.invalid",
    phone: "",
    productId: "aiphone-ixg",
    notes: "Reviewing building entry intercoms.",
    status: "Qualified",
    createdAt: new Date().toISOString(),
    demo: true,
  },
];

let products = [];
let leads = [];
let storageReady = false;

function showLeadStatus(message, isError = false) {
  leadStatus.textContent = message;
  leadStatus.classList.toggle("status-error", isError);
}

function productName(productId) {
  return products.find((product) => product.id === productId)?.name ?? "Unknown product";
}

function persistLeads() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(leads));
    storageReady = true;
    return true;
  } catch {
    storageReady = false;
    showLeadStatus("Your browser could not save leads. Check its storage settings and try again.", true);
    return false;
  }
}

function loadLeads() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === null) {
      leads = structuredClone(sampleLeads);
      if (!persistLeads()) return;
      showLeadStatus("Sample leads loaded. Add a lead or change their statuses to explore the tracker.");
      renderLeads();
      return;
    }

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.some((lead) =>
      !lead || typeof lead.id !== "string" || typeof lead.name !== "string" ||
      typeof lead.organization !== "string" || typeof lead.productId !== "string" ||
      !statuses.includes(lead.status) || typeof lead.createdAt !== "string"
    )) {
      throw new Error("The saved lead list has an invalid format.");
    }
    leads = parsed;
    storageReady = true;
  } catch (error) {
    storageReady = false;
    showLeadStatus(error instanceof Error
      ? `${error.message} Restore the demo records to continue.`
      : "Could not read saved leads. Restore the demo records to continue.", true);
  }
  renderLeads();
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

    const source = document.createElement("span");
    source.className = "product-source";
    const sourceLink = document.createElement("a");
    sourceLink.href = product.source_url;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    sourceLink.textContent = "Product details on BEC ↗";
    source.append(sourceLink);

    card.append(category, title, description, gallery, source);
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
  leadProduct.disabled = false;
  addLeadButton.disabled = !storageReady;
}

function createLeadRow(lead) {
  const row = document.createElement("tr");

  const contactCell = document.createElement("td");
  contactCell.className = "lead-contact";
  const name = document.createElement("strong");
  name.textContent = lead.name;
  const organization = document.createElement("span");
  organization.textContent = lead.organization;
  const contact = document.createElement("span");
  contact.textContent = [lead.email, lead.phone].filter(Boolean).join(" · ");
  contactCell.append(name, organization, contact);
  if (lead.demo) {
    const demoTag = document.createElement("span");
    demoTag.className = "demo-tag";
    demoTag.textContent = "Sample";
    contactCell.append(demoTag);
  }

  const productCell = document.createElement("td");
  productCell.textContent = productName(lead.productId);

  const dateCell = document.createElement("td");
  const date = new Date(lead.createdAt);
  dateCell.textContent = Number.isNaN(date.valueOf()) ? "Unknown" : date.toLocaleDateString();

  const statusCell = document.createElement("td");
  const statusSelect = document.createElement("select");
  statusSelect.className = "lead-status-select";
  statusSelect.setAttribute("aria-label", `Status for ${lead.name}`);
  for (const status of statuses) statusSelect.add(new Option(status, status));
  statusSelect.value = lead.status;
  statusSelect.disabled = !storageReady;
  statusSelect.addEventListener("change", () => {
    const previousStatus = lead.status;
    lead.status = statusSelect.value;
    if (!persistLeads()) {
      lead.status = previousStatus;
      statusSelect.value = previousStatus;
    }
    renderLeads();
  });
  statusCell.append(statusSelect);

  const actionCell = document.createElement("td");
  actionCell.className = "lead-row-actions";
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "icon-button";
  deleteButton.textContent = "Remove";
  deleteButton.setAttribute("aria-label", `Remove ${lead.name}`);
  deleteButton.disabled = !storageReady;
  deleteButton.addEventListener("click", () => {
    if (!window.confirm(`Remove ${lead.name} from this browser's lead list?`)) return;
    const previousLeads = leads;
    leads = leads.filter((item) => item.id !== lead.id);
    if (!persistLeads()) leads = previousLeads;
    renderLeads();
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
    const matchesSearch = `${lead.name} ${lead.organization} ${lead.email} ${lead.phone} ${productName(lead.productId)}`
      .toLocaleLowerCase().includes(search);
    return matchesSearch && (!status || lead.status === status);
  });
  leadRows.replaceChildren(...visible.map(createLeadRow));
  emptyLeads.hidden = visible.length > 0;
  leadSummary.textContent = `${leads.length} ${leads.length === 1 ? "lead" : "leads"} · ${leads.filter((lead) => lead.status === "New").length} new`;
  exportButton.disabled = leads.length === 0;
  if (products.length) addLeadButton.disabled = !storageReady;
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function exportLeads() {
  const columns = ["Name", "Organization", "Email", "Phone", "Product", "Status", "Added", "Notes"];
  const rows = leads.map((lead) => [
    lead.name,
    lead.organization,
    lead.email,
    lead.phone,
    productName(lead.productId),
    lead.status,
    lead.createdAt,
    lead.notes,
  ]);
  const csv = `\uFEFF${[columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "bec-leads.csv";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  showLeadStatus("Lead list downloaded as CSV.");
}

leadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!leadForm.reportValidity()) return;
  if (!storageReady) {
    showLeadStatus("Lead storage is unavailable. Restore the demo records or check browser storage settings.", true);
    return;
  }

  const formData = new FormData(leadForm);
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!email && !phone) {
    showLeadStatus("Enter an email address or phone number so this lead can be contacted.", true);
    document.querySelector("#lead-email").focus();
    return;
  }

  const lead = {
    id: crypto.randomUUID(),
    name: String(formData.get("name")).trim(),
    organization: String(formData.get("organization")).trim(),
    email,
    phone,
    productId: String(formData.get("product")),
    notes: String(formData.get("notes") ?? "").trim(),
    status: "New",
    createdAt: new Date().toISOString(),
    demo: false,
  };
  if (!lead.name || !lead.organization || !products.some((product) => product.id === lead.productId)) {
    showLeadStatus("Check the contact name, organization, and product interest.", true);
    return;
  }

  leads = [lead, ...leads];
  if (!persistLeads()) {
    leads = leads.filter((item) => item.id !== lead.id);
    renderLeads();
    return;
  }
  leadForm.reset();
  showLeadStatus(`${lead.name} added to the lead list.`);
  renderLeads();
});

restoreButton.addEventListener("click", () => {
  if (!window.confirm("Replace all leads saved in this browser with the three sample records?")) return;
  leads = structuredClone(sampleLeads);
  if (!persistLeads()) return;
  showLeadStatus("Sample leads restored.");
  renderLeads();
});

productSearch.addEventListener("input", renderProducts);
leadSearch.addEventListener("input", renderLeads);
statusFilter.addEventListener("change", renderLeads);
exportButton.addEventListener("click", exportLeads);

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
    loadLeads();
  })
  .catch((error) => {
    catalogStatus.textContent = error instanceof Error ? error.message : "Could not load the product catalog.";
    leadProduct.replaceChildren(new Option("Product list unavailable", ""));
    leadProduct.disabled = true;
    addLeadButton.disabled = true;
    showLeadStatus("Reload the page after the product catalog is available.", true);
  });
