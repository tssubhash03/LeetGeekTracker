// background.js
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Handle Token Exchange Request
  if (msg.type === "EXCHANGE_CODE") {
    const code = msg.code;
    const state = msg.state;

    console.log("📥 Code received in background:", code.substring(0, 10) + "...");

    fetch("http://localhost:4000/exchange-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code, state: state })
    })
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      const token = data.access_token;
      if (token) {
        browser.storage.local.set({ github_token: token }).then(() => {
          console.log("💾 Token stored");
          sendResponse({ status: "success" });
        }).catch(err => {
          console.error("💥 Storage error:", err);
          sendResponse({ status: "error", message: err.message });
        });
      } else {
        console.error("No access_token received from server:", data);
        sendResponse({ status: "error", message: "No access token received from server." });
      }
    })
    .catch(err => {
      console.error("💥 Token exchange error:", err);
      sendResponse({ status: "error", message: err.message });
    });
    return true; // Required to keep sendResponse async
  }

  // Handle List Repos Request
  else if (msg.type === "LIST_REPOS") {
    const token = msg.token;
    console.log("Fetching GitHub user repositories...");

    fetch('https://api.github.com/user/repos', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(res => {
      if (!res.ok) {
        // Handle specific error codes, like 401 for unauthorized/expired token
        if (res.status === 401) {
            console.error("GitHub API 401: Unauthorized. Token might be invalid or expired.");
            // Optionally, clear the token from storage here or let the popup handle it.
            // For now, let popup handle UI update and token removal if needed.
            throw new Error("GitHub API Error: 401 Unauthorized. Token might be invalid or expired.");
        }
        throw new Error(`GitHub API error! status: ${res.status} - ${res.statusText}`);
      }
      return res.json();
    })
    .then(repos => {
      console.log("GitHub repositories fetched:", repos.length);
      sendResponse({ status: "success", repos: repos });
    })
    .catch(err => {
      console.error("💥 Error fetching GitHub repos:", err);
      sendResponse({ status: "error", message: err.message });
    });
    return true; // Required to keep sendResponse async
  }
});