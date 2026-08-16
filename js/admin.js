document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("product-file");
  const uploadButton = document.getElementById("convert-button");
  const resultArea = document.getElementById("result-area");

  function showMessage(message, isError = false) {
    resultArea.innerHTML = `<p class="${isError ? "error-text" : "info-text"}">${message}</p>`;
  }

  uploadButton.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) {
      showMessage("Please choose an Excel or CSV file first.", true);
      return;
    }

    const formData = new FormData();
    formData.append("productFile", file);

    showMessage("Uploading file... Please wait.");

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        showMessage(data.error || "Upload failed.", true);
        return;
      }

      showMessage(
        `Upload succeeded. ${data.count} product(s) have been saved to products.json.`,
      );
    } catch (error) {
      console.error(error);
      showMessage("Upload failed. Please try again or check the server.", true);
    }
  });
});
