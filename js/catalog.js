document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("category-products");
  if (!container) return;

  const category = container.dataset.category;
  fetch("products.json")
    .then((response) => response.json())
    .then((products) => {
      const categoryProducts = products.filter(
        (product) => product.category === category,
      );

      if (!categoryProducts.length) {
        container.innerHTML = `<p>No products found for ${category}.</p>`;
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
