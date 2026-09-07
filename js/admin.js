document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("product-file");
  const uploadButton = document.getElementById("convert-button");
  const resultArea = document.getElementById("result-area");
  const pendingList = document.getElementById("pending-list");
  const approveButton = document.getElementById("approve-selected");
  const rejectButton = document.getElementById("reject-selected");

  function showMessage(message, isError = false) {
    if (!resultArea) return;
    resultArea.innerHTML = `<p class="${isError ? "error-text" : "info-text"}">${message}</p>`;
  }

  // Do not embed credentials in client-side code. Browser will supply Basic Auth credentials after the admin page is authenticated.
  // Store last-loaded pending products for previewing.
  let lastPendingProducts = [];

  async function loadPendingProducts() {
    if (!pendingList) return;

    try {
      const response = await fetch("/api/pending-products", {
        cache: "no-store",
      });
      const products = response.ok ? await response.json() : [];
      // cache current pending products so the Preview button can show details
      lastPendingProducts = products || [];

      if (!products.length) {
        pendingList.innerHTML = "<p>No products are waiting for approval.</p>";
        return;
      }

      pendingList.innerHTML = products
        .map(
          (product) => `
            <label class="pending-row">
              <input type="checkbox" value="${product.id}" class="pending-check" />
              <div class="pending-summary">
                <img src="${product.imageUrl}" alt="${product.title}" />
                <div>
                  <strong>${product.title}</strong>
                  <span>${product.category}</span>
                  <small>${product.price}</small>
                </div>
              </div>
              <div class="pending-actions">
                <button type="button" class="btn btn-tertiary preview-btn" data-id="${product.id}">Preview</button>
              </div>
            </label>
          `,
        )
        .join("");
    } catch (error) {
      pendingList.innerHTML = "<p>Unable to load pending products.</p>";
      console.error(error);
    }
  }

  async function approveSelectedProducts() {
    const selected = Array.from(document.querySelectorAll(".pending-check:checked")).map((checkbox) => checkbox.value);
    if (!selected.length) {
      showMessage("Select at least one product to approve.", true);
      return;
    }

    const response = await fetch("/api/products/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selected }),
    });
    const data = await response.json();

    if (!response.ok) {
      showMessage(data.error || "Approval failed.", true);
      return;
    }

    showMessage(`${data.approved} product(s) approved and published.`);
    loadPendingProducts();
  }

  async function rejectSelectedProducts() {
    const selected = Array.from(document.querySelectorAll(".pending-check:checked")).map((checkbox) => checkbox.value);
    if (!selected.length) {
      showMessage("Select at least one product to reject.", true);
      return;
    }

    const response = await fetch("/api/products/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selected }),
    });
    const data = await response.json();

    if (!response.ok) {
      showMessage(data.error || "Reject failed.", true);
      return;
    }

    showMessage(`${data.rejected} product(s) rejected.`);
    loadPendingProducts();
  }

  // client-side pre-validation for selected JSON file
  async function preValidateFile(file) {
    const errors = [];
    let products = null;
    try {
      const text = await (file.text ? file.text() : new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = () => rej(new Error('Failed to read file'));
        reader.readAsText(file);
      }));
      products = JSON.parse(text);
    } catch (err) {
      return { products: null, errors: [{ type: 'parse', message: 'File is not valid JSON' }] };
    }

    if (!Array.isArray(products)) {
      return { products: null, errors: [{ type: 'shape', message: 'JSON must be an array of product objects' }] };
    }

    const required = ["id", "category", "title", "description", "price", "imageUrl", "whatsappText"];
    const detailErrors = [];
    products.forEach((p, idx) => {
      const missing = required.filter(k => !p.hasOwnProperty(k) || String(p[k]).trim() === "");
      if (missing.length) {
        detailErrors.push({ index: idx, id: p.id || null, missingFields: missing });
      }
    });

    if (detailErrors.length) {
      return { products: null, errors: [{ type: 'validation', message: 'Some products are missing required fields', details: detailErrors }] };
    }

    return { products, errors: [] };
  }

  uploadButton.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) {
      showMessage("Please choose a JSON file first.", true);
      return;
    }

    // pre-validate the file client-side to give quick feedback
    showMessage("Checking file before upload...");
    const pre = await preValidateFile(file);
    if (pre.errors && pre.errors.length) {
      const e = pre.errors[0];
      if (e.type === 'parse' || e.type === 'shape') {
        showMessage(`Upload failed: ${e.message}`, true);
        return;
      }
      if (e.type === 'validation') {
        const list = e.details.map(d => `Product index ${d.index}${d.id ? ` (id: ${d.id})` : ''} missing fields: ${d.missingFields.join(', ')}`).join('<br>');
        showMessage(`Validation errors (client):<br>${list}`, true);
        return;
      }
    }

    const formData = new FormData();
    formData.append("productFile", file);
    showMessage("Uploading JSON... Please wait.");

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      // attempt to parse response as JSON, but fall back to text
      let data = null;
      let text = null;
      try {
        data = await response.clone().json();
      } catch (err) {
        try { text = await response.clone().text(); } catch (e) { text = null; }
      }

      if (!response.ok) {
        // prefer structured server validation details when present
        if (data && data.details) {
          const list = data.details.map(d => `Product index ${d.index}${d.id ? ` (id: ${d.id})` : ''} missing fields: ${d.missingFields.join(', ')}`).join('<br>');
          showMessage(`Validation errors:<br>${list}`, true);
        } else if (data && data.error) {
          showMessage(`Upload failed (${response.status}): ${data.error}`, true);
        } else if (text) {
          showMessage(`Upload failed (${response.status}). Server response: <pre>${text}</pre>`, true);
        } else {
          showMessage(`Upload failed (${response.status}).`, true);
        }
        return;
      }

      // success
      const successCount = (data && data.count) ? data.count : (data && data.success ? (data.count||1) : null);
      showMessage(`Upload succeeded. ${successCount !== null ? successCount + ' valid product(s) are waiting for approval.' : 'Server accepted the upload.'}`);
      await loadPendingProducts();
    } catch (error) {
      console.error(error);
      showMessage(`Upload failed. ${error.message || 'Please try again or check the server.'}`, true);
    }
  });

  approveButton.addEventListener("click", approveSelectedProducts);
  rejectButton.addEventListener("click", rejectSelectedProducts);

  // Delegate preview clicks from pending list
  if (pendingList) {
    pendingList.addEventListener("click", (e) => {
      const btn = e.target.closest(".preview-btn");
      if (!btn) return;
      const id = btn.dataset.id;
      const product = lastPendingProducts.find((p) => p.id === id);
      if (product) showPreview(product);
    });
  }

  // Modal and preview helpers
  const previewModal = document.getElementById("product-preview-modal");
  const previewImage = document.getElementById("preview-image");
  const previewTitle = document.getElementById("preview-title");
  const previewCategory = document.getElementById("preview-category");
  const previewPrice = document.getElementById("preview-price");
  const previewDescription = document.getElementById("preview-description");
  const previewWhatsapp = document.getElementById("preview-whatsapp");
  const previewArchiveBtn = document.getElementById("preview-archive");
  const previewRemoveBtn = document.getElementById("preview-remove");
  const publishedList = document.getElementById("published-list");
  const removeButton = document.getElementById("remove-selected");
  const archiveButton = document.getElementById("archive-selected");
  let lastPublishedProducts = [];
  let currentPreviewId = null;

  function showPreview(product) {
    if (!previewModal) return;
    currentPreviewId = product.id;
    previewImage.src = product.imageUrl || "";
    previewImage.alt = product.title || "";
    previewTitle.textContent = product.title || "";
    previewCategory.textContent = product.category || "";
    previewPrice.textContent = product.price || "";
    previewDescription.textContent = product.description || "";
    previewWhatsapp.href = `https://wa.me/${encodeURIComponent(product.whatsappNumber || "")}?text=${encodeURIComponent(product.whatsappText || product.title || "")}`;
    previewModal.classList.remove("hidden");
  }

  function hidePreview() {
    if (!previewModal) return;
    previewModal.classList.add("hidden");
  }

  // close modal when clicking close or overlay
  if (previewModal) {
    previewModal.addEventListener("click", (e) => {
      if (e.target.id === "product-preview-modal" || e.target.classList.contains("close-preview")) {
        hidePreview();
      }
    });
  }

  // Load published products and wire published actions
  async function loadPublishedProducts() {
    if (!publishedList) return;
    try {
      const response = await fetch('/api/products', { cache: 'no-store' });
      const products = response.ok ? await response.json() : [];
      lastPublishedProducts = products || [];

      if (!products.length) {
        publishedList.innerHTML = '<p>No published products found.</p>';
        return;
      }

      publishedList.innerHTML = products.map(product => `
        <label class="pending-row">
          <input type="checkbox" value="${product.id}" class="published-check" />
          <div class="pending-summary">
            <img src="${product.imageUrl}" alt="${product.title}" />
            <div>
              <strong>${product.title}</strong>
              <span>${product.category}</span>
              <small>${product.price}</small>
            </div>
          </div>
          <div class="pending-actions">
            <button type="button" class="btn btn-tertiary preview-btn" data-id="${product.id}">Preview</button>
          </div>
        </label>
      `).join('');
    } catch (err) {
      console.error(err);
      publishedList.innerHTML = '<p>Unable to load published products.</p>';
    }
  }

  async function removeSelectedProducts(ids, archive = false) {
    if (!ids || !ids.length) {
      showMessage('Select at least one product to remove.', true);
      return;
    }

    try {
      const resp = await fetch('/api/products/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, archive }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        showMessage(data.error || 'Remove failed.', true);
        return;
      }
      showMessage(`${data.removed || 0} product(s) removed.${archive ? ` ${data.archived || 0} archived.` : ''}`);
      // refresh lists
      await loadPublishedProducts();
      await loadPendingProducts();
      hidePreview();
    } catch (err) {
      console.error(err);
      showMessage('Remove failed. Please try again.', true);
    }
  }

  // Wire published list preview and published actions
  if (publishedList) {
    publishedList.addEventListener('click', (e) => {
      const btn = e.target.closest('.preview-btn');
      if (!btn) return;
      const id = btn.dataset.id;
      const product = lastPublishedProducts.find((p) => p.id === id);
      if (product) showPreview(product);
    });
  }

  if (removeButton) removeButton.addEventListener('click', () => {
    const selected = Array.from(document.querySelectorAll('.published-check:checked')).map(c => c.value);
    removeSelectedProducts(selected, false);
  });
  if (archiveButton) archiveButton.addEventListener('click', () => {
    const selected = Array.from(document.querySelectorAll('.published-check:checked')).map(c => c.value);
    removeSelectedProducts(selected, true);
  });

  // preview modal quick actions
  if (previewArchiveBtn) {
    previewArchiveBtn.addEventListener('click', () => {
      if (!currentPreviewId) return;
      removeSelectedProducts([currentPreviewId], true);
    });
  }
  if (previewRemoveBtn) {
    previewRemoveBtn.addEventListener('click', () => {
      if (!currentPreviewId) return;
      removeSelectedProducts([currentPreviewId], false);
    });
  }

  // initial load
  loadPendingProducts();
  loadPublishedProducts();
});
