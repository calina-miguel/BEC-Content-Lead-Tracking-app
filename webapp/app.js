const catalogUrl = new URL("./products.json", window.location.href);
const productList = document.querySelector("#product-list");
const catalogStatus = document.querySelector("#catalog-status");
const selectionStatus = document.querySelector("#selection-status");
const productSearch = document.querySelector("#product-search");

let products = [];
let selectedProductId = "";

function renderProducts() {
  const search = productSearch.value.trim().toLocaleLowerCase();
  const visible = products.filter((product) =>
    `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase().includes(search),
  );
  productList.replaceChildren();

  for (const product of visible) {
    const card = document.createElement("article");
    card.className = "product-card";
    card.classList.toggle("is-selected", selectedProductId === product.id);

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
    chooseButton.textContent = selectedProductId === product.id ? "Selected" : "Choose this product";
    chooseButton.setAttribute("aria-pressed", String(selectedProductId === product.id));
    chooseButton.classList.toggle("is-selected", selectedProductId === product.id);
    chooseButton.addEventListener("click", () => {
      selectedProductId = product.id;
      sessionStorage.setItem("bec-selected-product", product.id);
      selectionStatus.textContent = `${product.name} selected. BEC staff can use this selection when preparing a campaign.`;
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

    card.append(category, title, description, gallery, chooseButton, source);
    productList.append(card);
  }

  catalogStatus.textContent = visible.length
    ? `${visible.length} ${visible.length === 1 ? "product" : "products"} shown.`
    : "No products match that search.";
}

productSearch.addEventListener("input", renderProducts);

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
  })
  .catch((error) => {
    catalogStatus.textContent = error instanceof Error ? error.message : "Could not load the product catalog.";
  });
