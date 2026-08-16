(function () {
  const items = [
    {
      title: "Evening Silk Dress",
      price: "₦28,000",
      image:
        "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1400&q=80",
      href: "product.html?id=dress-evening",
    },
    {
      title: "Minimal Leather Tote",
      price: "₦22,000",
      image:
        "https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=1400&q=80",
      href: "product.html?id=bag-tote",
    },
  ];

  let idx = 0;
  const slideEl = document.getElementById("carousel-slide");
  const indicators = document.getElementById("carousel-indicators");
  const prevBtn = document.getElementById("carousel-prev");
  const nextBtn = document.getElementById("carousel-next");
  let timer = null;

  function render(i) {
    if (!slideEl) return;
    const it = items[i];
    slideEl.classList.remove("fade-in");
    slideEl.classList.add("fade-out");
    setTimeout(() => {
      slideEl.innerHTML = `
          <a href="${it.href}" class="card-link hero-card-link">
            <div class="large-thumb" style="background-image: url('${it.image}')"></div>
            <div class="best-info hero-info">
              <h3>${it.title}</h3>
              <p class="price">${it.price}</p>
            </div>
          </a>
        `;
      slideEl.classList.remove("fade-out");
      slideEl.classList.add("fade-in");
      updateIndicators();
    }, 250);
  }

  function updateIndicators() {
    if (!indicators) return;
    indicators.innerHTML = "";
    items.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.className = "indicator" + (i === idx ? " active" : "");
      dot.onclick = () => {
        goTo(i);
      };
      indicators.appendChild(dot);
    });
  }

  function goTo(i) {
    idx = i;
    render(idx);
    resetTimer();
  }
  function next() {
    idx = (idx + 1) % items.length;
    render(idx);
  }
  function prev() {
    idx = (idx - 1 + items.length) % items.length;
    render(idx);
  }
  function resetTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(next, 3000);
  }

  if (slideEl && indicators && prevBtn && nextBtn) {
    prevBtn.addEventListener("click", () => {
      prev();
      resetTimer();
    });
    nextBtn.addEventListener("click", () => {
      next();
      resetTimer();
    });
    render(idx);
    resetTimer();
  }

  function renderFeaturedProducts() {
    const container = document.getElementById("featured-products");
    if (!container) return;

    fetch("products.json")
      .then((response) => response.json())
      .then((products) => {
        const featured = products.filter((product) => product.featured);
        if (!featured.length) {
          container.innerHTML =
            "<p>No featured items are available right now.</p>";
          return;
        }

        container.innerHTML = featured
          .map(
            (product) => `
              <article class="product-card">
                <div class="product-image" style="background-image: url('${product.imageUrl}')"></div>
                <div class="product-info">
                  <h3>${product.title}</h3>
                  <p>${product.description}</p>
                  <a href="${product.href}" class="btn btn-tertiary">View Details</a>
                </div>
              </article>
            `,
          )
          .join("");
      })
      .catch((error) => {
        container.innerHTML = "<p>Unable to load featured products.</p>";
        console.error("Error loading featured products:", error);
      });
  }

  renderFeaturedProducts();
})();
