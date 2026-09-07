document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("category-products");
  if (!container) return;

  const category = (container.dataset.category || "").trim().toLowerCase();

  fetch("/api/products", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to load products");
      }
      return response.json();
    })
    .then((products) => {
      const categoryProducts = products.filter((product) => {
        const productCategory = String(product.category || "").trim().toLowerCase();
        return productCategory === category;
      });

      if (!categoryProducts.length) {
        container.innerHTML = `<p>No products found for ${category || "this category"}.</p>`;
        return;
      }

      container.innerHTML = categoryProducts
        .map(
          (product) => `
            <article class="collection-card">
              <a href="${product.href}" class="card-link">
                <div class="collection-image" style="background-image: url('${product.imageUrl}')"></div>
                <div class="collection-info">
                  <h3>${product.title}</h3>
                  <p>${product.description}</p>
                </div>
              </a>
            </article>
          `,
        )
        .join("");
    })
    .catch((error) => {
      container.innerHTML = "<p>Unable to load products.</p>";
      console.error("Error loading category products:", error);
    });
});
