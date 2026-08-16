function getQueryParam(name) {
  const params = new URLSearchParams(location.search);
  return params.get(name);
}

function renderProduct(id) {
  fetch("products.json")
    .then((response) => response.json())
    .then((products) => {
      const product = products.find((item) => item.id === id) || products[0];
      document.title = `JUM COLLECTION — ${product.title}`;
      document.getElementById("product-title").textContent = product.title;
      document.getElementById("product-description").textContent =
        product.description;
      document.getElementById("detail-description").textContent =
        product.description;
      const imgEl = document.getElementById("product-image");
      imgEl.src = product.imageUrl;
      imgEl.alt = product.title;
      const metaEl = document.getElementById("detail-meta");
      metaEl.innerHTML = "";
      product.meta.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        metaEl.appendChild(li);
      });
      document.getElementById("mini-1-title").textContent = product.mini1.title;
      document.getElementById("mini-1-desc").textContent = product.mini1.desc;
      document.getElementById("mini-2-title").textContent = product.mini2.title;
      document.getElementById("mini-2-desc").textContent = product.mini2.desc;
      document.getElementById("mini-price-val").textContent = product.price;
      // Store WhatsApp number must be in international format without '+' and without leading 0.
      // User supplied local number '01868198519' — convert to Bangladesh format: '880' + number without leading 0
      const STORE_WHATSAPP_NUMBER = "8801868198519"; // international format for +8801868198519
      function buildWhatsAppUrl(number, text) {
        const encoded = encodeURIComponent(text);
        if (number && number.length) {
          return `https://wa.me/${number}?text=${encoded}`;
        }
        return `https://wa.me/?text=${encoded}`;
      }

      const wa = document.getElementById("whatsapp-link");
      const message = `${product.whatsappText} - ${product.title} (${product.price})\n${location.origin}/${product.href}`;
      wa.href = buildWhatsAppUrl(STORE_WHATSAPP_NUMBER, message);
      wa.target = "_blank";
      wa.rel = "noopener noreferrer";

      const backLink = document.getElementById("category-back-link");
      if (backLink) {
        backLink.href =
          product.category === "bags" ? "bags.html" : "dresses.html";
      }
    })
    .catch((error) => {
      console.error("Error loading product data:", error);
    });
}

const pid = getQueryParam("id");
renderProduct(pid);
