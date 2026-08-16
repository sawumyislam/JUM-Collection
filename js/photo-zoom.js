document.addEventListener("DOMContentLoaded", () => {
  const zoomableImages = document.querySelectorAll(".zoomable");
  const overlay = document.getElementById("zoomOverlay");
  const zoomImage = document.getElementById("zoomImage");
  const closeButton = document.getElementById("zoomClose");

  if (!overlay || !zoomImage || !closeButton) {
    return;
  }

  function openZoom(src, alt) {
    zoomImage.src = src;
    zoomImage.alt = alt || "Zoomed product image";
    overlay.classList.add("visible");
    document.body.style.overflow = "hidden";
  }

  function closeZoom() {
    overlay.classList.remove("visible");
    document.body.style.overflow = "";
  }

  zoomableImages.forEach((img) => {
    img.addEventListener("click", () => openZoom(img.src, img.alt));
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target === closeButton) {
      closeZoom();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlay.classList.contains("visible")) {
      closeZoom();
    }
  });
});
