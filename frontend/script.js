document.getElementById("urlForm").addEventListener("submit", async function (event) {
  event.preventDefault();

  const longUrl = document.getElementById("longUrl").value.trim();
  const customCode = document.getElementById("customCode").value.trim();
  const resultBox = document.getElementById("result");

  resultBox.innerHTML = "Creating short URL...";

  const payload = {
    url: longUrl
  };

  if (customCode) {
    payload.customCode = customCode;
  }

  try {
    const response = await fetch("/api/shorten", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to create short URL");
    }

    /*
      Backend already returns CloudFront-based shortUrl.
      If not available for any reason, frontend builds it using current domain.
    */
    const shortUrl = `${window.location.origin}/api/${data.shortCode}`;

    resultBox.innerHTML = `
      <div class="success">
        <p><strong>Short URL created successfully:</strong></p>
        <a href="${shortUrl}" target="_blank" rel="noopener noreferrer">${shortUrl}</a>
        <button type="button" id="copyButton">Copy</button>
      </div>
    `;

    document.getElementById("copyButton").addEventListener("click", async function () {
      await navigator.clipboard.writeText(shortUrl);
      this.textContent = "Copied!";
    });
  } catch (error) {
    console.error("Frontend error:", error);

    resultBox.innerHTML = `
      <div class="error">
        <p><strong>Error:</strong> ${error.message}</p>
      </div>
    `;
  }
});