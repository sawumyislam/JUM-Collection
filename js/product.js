function getQueryParam(name) {
  const params = new URLSearchParams(location.search);
  return params.get(name);
}

function buildWhatsAppUrl(number, text) {
  const encoded = encodeURIComponent(text);
  if (number && number.length) {
    return `https://wa.me/${number}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

function renderProduct(id) {
  fetch("/api/products", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to load products");
      }
      return response.json();
    })
    .then((products) => {
      const product = products.find((item) => item.id === id) || products[0];
      if (!product) {
        document.getElementById("product-title").textContent = "No product found";
        return;
      }

      document.title = `JUM COLLECTION — ${product.title}`;
      document.getElementById("product-title").textContent = product.title;
      document.getElementById("product-description").textContent = product.description;
      document.getElementById("detail-description").textContent = product.description;

      const imgEl = document.getElementById("product-image");
      imgEl.src = product.imageUrl;
      imgEl.alt = product.title;

      const metaEl = document.getElementById("detail-meta");
      metaEl.innerHTML = "";
      const metaItems = Array.isArray(product.meta) && product.meta.length ? product.meta : [product.description];
      metaItems.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        metaEl.appendChild(li);
      });

      const mini1Title = document.getElementById("mini-1-title");
      const mini1Desc = document.getElementById("mini-1-desc");
      const mini2Title = document.getElementById("mini-2-title");
      const mini2Desc = document.getElementById("mini-2-desc");
      const priceEl = document.getElementById("mini-price-val");

      mini1Title.textContent = product.mini1?.title || "Style Details";
      mini1Desc.textContent = product.mini1?.desc || "";
      mini2Title.textContent = product.mini2?.title || "Perfect For";
      mini2Desc.textContent = product.mini2?.desc || "";
      priceEl.textContent = product.price;

      const STORE_WHATSAPP_NUMBER = "8801719133076";
      const wa = document.getElementById("whatsapp-link");
      const orderSummary = [
        product.whatsappText || `Hello, I would like to order ${product.title}`,
        `Item: ${product.title}`,
        `Price: ${product.price}`,
        `Link: ${location.origin}${location.pathname.split("/").slice(0, -1).join("/")}/${product.href}`,
      ].join("\n");
      wa.href = buildWhatsAppUrl(STORE_WHATSAPP_NUMBER, orderSummary);
      wa.target = "_blank";
      wa.rel = "noopener noreferrer";

      const backLink = document.getElementById("category-back-link");
      if (backLink) {
        backLink.href = product.category === "bags" ? "bags.html" : "dresses.html";
      }
    })
    .catch((error) => {
      console.error("Error loading product data:", error);
    });
}

const pid = getQueryParam("id");
renderProduct(pid);
