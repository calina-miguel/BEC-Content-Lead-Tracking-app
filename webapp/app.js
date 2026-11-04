const catalogUrl = new URL("./products.json", window.location.href);
const workflowUrl = "https://github.com/calina-miguel/BEC/actions/workflows/generate_content.yml";
const productList = document.querySelector("#product-list");
const catalogStatus = document.querySelector("#catalog-status");
const briefStatus = document.querySelector("#brief-status");
const searchInput = document.querySelector("#search");
const audienceInput = document.querySelector("#audience");
const goalInput = document.querySelector("#goal");
const toneInput = document.querySelector("#tone");
const copyButton = document.querySelector("#copy-brief");
const downloadButton = document.querySelector("#download-brief");

let products = [];
let selectedProduct = null;

function renderProducts() {
  const search = searchInput.value.trim().toLocaleLowerCase();
  const visible = products.filter((product) =>
    `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase().includes(search),
  );
  productList.replaceChildren();

  for (const product of visible) {
    const card = document.createElement("article");
    card.className = `product-card${selectedProduct?.id === product.id ? " is-selected" : ""}`;

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
      const caption = document.createElement("figcaption");
      caption.textContent = item.caption;
      figure.append(image, caption);
      gallery.append(figure);
    }

    const choose = document.createElement("button");
    choose.type = "button";
    choose.textContent = selectedProduct?.id === product.id ? "Selected" : "Choose this product";
    choose.className = `product-select${selectedProduct?.id === product.id ? " is-selected" : ""}`;
    choose.setAttribute("aria-pressed", String(selectedProduct?.id === product.id));
    choose.addEventListener("click", () => {
      selectedProduct = product;
      copyButton.disabled = false;
      downloadButton.disabled = false;
      briefStatus.textContent = `${product.name} selected.`;
      renderProducts();
    });

    const source = document.createElement("span");
    source.className = "product-source";
    const sourceLink = document.createElement("a");
    sourceLink.href = product.source_url;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    sourceLink.textContent = "Product details on BEC ↗";
    source.append(sourceLink);

    card.append(category, title, description, gallery, choose, source);
    productList.append(card);
  }

  catalogStatus.textContent = visible.length
    ? `${visible.length} ${visible.length === 1 ? "product" : "products"} shown.`
    : "No products match that search.";
}

function createBrief() {
  if (!selectedProduct) {
    throw new Error("Choose a product before preparing a brief.");
  }

  const audience = audienceInput.value.trim();
  const goal = goalInput.value.trim();
  if (!audience || !goal) {
    throw new Error("Enter an audience and campaign goal first.");
  }

  return {
    product_id: selectedProduct.id,
    product_name: selectedProduct.name,
    campaign_brief: [
      `Audience: ${audience}`,
      `Goal: ${goal}`,
      `Tone: ${toneInput.value}`,
      `Use the verified product details from ${selectedProduct.source_url}.`,
      "Do not invent product specifications, certifications, customer outcomes, or claims.",
    ].join("\n"),
  };
}

function briefText(brief) {
  return [
    `Product ID: ${brief.product_id}`,
    `Product: ${brief.product_name}`,
    "",
    brief.campaign_brief,
  ].join("\n");
}

async function copyAndOpenWorkflow() {
  try {
    const brief = createBrief();
    window.open(workflowUrl, "_blank", "noopener,noreferrer");
    await navigator.clipboard.writeText(briefText(brief));
    briefStatus.textContent = "Brief copied. In the GitHub workflow, choose the product ID and paste the campaign brief.";
  } catch (error) {
    briefStatus.textContent = error instanceof Error ? error.message : "Could not copy the brief.";
  }
}

function downloadBrief() {
  try {
    const brief = createBrief();
    const file = new Blob([`${JSON.stringify(brief, null, 2)}\n`], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = `${brief.product_id}-campaign-brief.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
    briefStatus.textContent = "Brief downloaded.";
  } catch (error) {
    briefStatus.textContent = error instanceof Error ? error.message : "Could not download the brief.";
  }
}

searchInput.addEventListener("input", renderProducts);
copyButton.addEventListener("click", copyAndOpenWorkflow);
downloadButton.addEventListener("click", downloadBrief);

fetch(catalogUrl)
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Catalog request failed (${response.status}).`);
    }
    return response.json();
  })
  .then((data) => {
    if (!Array.isArray(data)) {
      throw new Error("The product catalog has an invalid format.");
    }
    products = data;
    renderProducts();
  })
  .catch((error) => {
    catalogStatus.textContent = error instanceof Error ? error.message : "Could not load the product catalog.";
  });
