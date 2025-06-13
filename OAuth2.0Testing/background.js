// background.js
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Handle Token Exchange Request
  if (msg.type === "EXCHANGE_CODE") {
    // ... (existing code for token exchange) ...
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
    return true;
  }

  // Handle List Repos Request
  else if (msg.type === "LIST_REPOS") {
    const token = msg.token;
    console.log("Fetching GitHub user repositories...");

    fetch('https://api.github.com/user/repos?per_page=100', { // Added per_page to get more repos
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(res => {
      if (!res.ok) {
        if (res.status === 401) {
            console.error("GitHub API 401: Unauthorized. Token might be invalid or expired.");
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
    return true;
  }

  // Handle Fetch Repo Details Request
  else if (msg.type === "FETCH_REPO_DETAILS") {
    const token = msg.token;
    const repoFullName = msg.repoFullName; // e.g., "owner/repo-name"
    console.log(`Fetching details for repository: ${repoFullName}`);

    if (!repoFullName) {
        return sendResponse({ status: "error", message: "Repository full name is missing." });
    }

    fetch(`https://api.github.com/repos/${repoFullName}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(res => {
      if (!res.ok) {
        if (res.status === 401) {
            console.error("GitHub API 401: Unauthorized. Token might be invalid or expired.");
            throw new Error("GitHub API Error: 401 Unauthorized. Token might be invalid or expired.");
        }
        throw new Error(`GitHub API error! status: ${res.status} - ${res.statusText}`);
      }
      return res.json();
    })
    .then(repoDetails => {
      console.log("GitHub repo details fetched for:", repoDetails.full_name);
      sendResponse({ status: "success", repo: repoDetails });
    })
    .catch(err => {
      console.error(`💥 Error fetching repo details for ${repoFullName}:`, err);
      sendResponse({ status: "error", message: err.message });
    });
    return true;
  }

  // New: Handle Create Folder Request
  else if (msg.type === "CREATE_FOLDER") {
    const token = msg.token;
    const repoFullName = msg.repoFullName;
    const folderPath = msg.folderPath; // e.g., "my-new-folder/.gitkeep"

    if (!repoFullName || !folderPath) {
        return sendResponse({ status: "error", message: "Repository full name or folder path is missing." });
    }

    console.log(`Attempting to create folder/file at: ${repoFullName}/${folderPath}`);

    const [owner, repoName] = repoFullName.split('/');
    const content = btoa(' '); // Base64 encode a single space, or an empty string, or `btoa('\n')` for a newline

    fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${folderPath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `feat: Create folder ${folderPath.split('/')[0]}`,
        committer: {
          name: "Extension User", // You might want to pull this from GitHub user data later
          email: "extension@example.com" // Placeholder email
        },
        content: content // The base64 encoded content
        // branch: "main" // Default to main if not specified, or retrieve default branch
      })
    })
    .then(res => {
      if (res.status === 409) { // 409 Conflict means the file/folder already exists
        throw new Error("Folder/file already exists. If the folder exists, try deleting it on GitHub first.");
      }
      if (!res.ok) {
        throw new Error(`GitHub API error creating folder! status: ${res.status} - ${res.statusText}`);
      }
      return res.json();
    })
    .then(response => {
      console.log("Folder creation successful:", response);
      sendResponse({ status: "success", details: response });
    })
    .catch(err => {
      console.error(`💥 Error creating folder in ${repoFullName}:`, err);
      sendResponse({ status: "error", message: err.message });
    });
    return true; // Required for async sendResponse
  }
});