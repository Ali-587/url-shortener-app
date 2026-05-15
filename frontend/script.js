document.getElementById("urlForm").addEventListener("submit", async function (event) {
  event.preventDefault();

  const longUrl = document.getElementById("longUrl").value;
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
    const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/shorten`, {
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

    resultBox.innerHTML = `
      <div class="success">
        <p><strong>Short URL created successfully:</strong></p>
        <a href="${data.shortUrl}" target="_blank">${data.shortUrl}</a>
      </div>
    `;
  } catch (error) {
    console.error("Frontend error:", error);

    resultBox.innerHTML = `
      <div class="error">
        <p><strong>Error:</strong> ${error.message}</p>
      </div>
    `;
  }
});