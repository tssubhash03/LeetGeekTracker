// popup/popup.js
const CLIENT_ID = "Ov23li5yyflTNfRcNjhc"; // <--- REPLACE THIS with your actual GitHub Client ID

const loginBtn = document.getElementById("loginBtn");
const listReposBtn = document.getElementById("listReposBtn");
const logoutBtn = document.getElementById("logoutBtn"); // Get the logout button
const status = document.getElementById("status");
const repoStatus = document.getElementById("repoStatus");
const reposList = document.getElementById("repos");

// Function to update UI based on login status
function updateUI(tokenExists) {
  if (tokenExists) {
    loginBtn.style.display = "none";
    listReposBtn.style.display = "block";
    logoutBtn.style.display = "block"; // Show logout button
    status.textContent = "✅ Token ready!";
  } else {
    loginBtn.style.display = "block";
    listReposBtn.style.display = "none";
    logoutBtn.style.display = "none"; // Hide logout button
    status.textContent = "🔒 Not logged in.";
    repoStatus.textContent = "Click 'List My Repos' to see them.";
    reposList.innerHTML = ""; // Clear existing repos
  }
}

// Event Listener for Login Button
loginBtn.addEventListener("click", () => {
  const REDIRECT_URI_FOR_IDENTITY = browser.identity.getRedirectURL();
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI_FOR_IDENTITY)}&scope=repo&state=${crypto.randomUUID()}`;

  console.log("Initiating OAuth flow with Redirect URI:", REDIRECT_URI_FOR_IDENTITY);

  browser.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true
  }, function(redirectUrl) {
    if (browser.runtime.lastError) {
      console.error("Auth flow failed:", browser.runtime.lastError.message);
      status.textContent = "Login failed: " + browser.runtime.lastError.message;
      updateUI(false);
      return;
    }
    if (redirectUrl) {
      console.log("Redirect URL from auth flow:", redirectUrl);
      const urlParams = new URLSearchParams(new URL(redirectUrl).search);
      const code = urlParams.get("code");
      const state = urlParams.get("state");

      if (code) {
        status.textContent = "🚀 Exchanging code...";
        browser.runtime.sendMessage({ type: "EXCHANGE_CODE", code: code, state: state })
          .then(response => {
            if (response && response.status === "success") {
              updateUI(true); // Token stored, update UI to show list repos button
            } else {
              console.error("Token exchange failed:", response.message);
              status.textContent = `❌ Token exchange failed: ${response.message || "Unknown error"}`;
              updateUI(false);
            }
          })
          .catch(err => {
            console.error("Error sending code to background:", err);
            status.textContent = `❌ Error communicating with background: ${err.message}`;
            updateUI(false);
          });
      } else {
        status.textContent = "❌ No code received in redirect.";
        updateUI(false);
      }
    } else {
      status.textContent = "Login cancelled.";
      updateUI(false);
    }
  });
});

// Event Listener for List Repos Button
listReposBtn.addEventListener("click", () => {
  repoStatus.textContent = "Loading repositories...";
  reposList.innerHTML = ""; // Clear previous list

  browser.storage.local.get("github_token").then(result => {
    if (result.github_token) {
      browser.runtime.sendMessage({ type: "LIST_REPOS", token: result.github_token })
        .then(response => {
          if (response && response.status === "success") {
            const repos = response.repos;
            if (repos.length === 0) {
              repoStatus.textContent = "No public repositories found for this user.";
            } else {
              repoStatus.textContent = `Found ${repos.length} repositories:`;
              repos.forEach(repo => {
                const li = document.createElement("li");
                const link = document.createElement("a");
                link.href = repo.html_url;
                link.textContent = repo.full_name;
                link.target = "_blank"; // Open in new tab
                li.appendChild(link);
                reposList.appendChild(li);
              });
            }
          } else {
            console.error("Failed to list repos:", response.message);
            repoStatus.textContent = `❌ Failed to list repos: ${response.message || "Unknown error"}`;
            // If token is invalid, clear it and update UI to show login button
            if (response.message.includes("401") || response.message.includes("invalid token")) {
                browser.storage.local.remove("github_token").then(() => {
                    updateUI(false);
                    status.textContent = "Token invalid/expired. Please login again.";
                });
            }
          }
        })
        .catch(err => {
          console.error("Error sending list repos message:", err);
          repoStatus.textContent = `❌ Communication error: ${err.message}`;
        });
    } else {
      repoStatus.textContent = "🔒 Not logged in. Please log in first.";
      updateUI(false); // Make sure UI shows login button
    }
  }).catch(err => {
    console.error("Error accessing storage:", err);
    repoStatus.textContent = `Error accessing storage: ${err.message}`;
  });
});

// Event Listener for Logout Button
logoutBtn.addEventListener("click", () => {
  browser.storage.local.remove("github_token").then(() => {
    console.log("Token removed from storage.");
    updateUI(false);
    status.textContent = "👋 Logged out.";
  }).catch(err => {
    console.error("Error removing token:", err);
    status.textContent = `Error logging out: ${err.message}`;
  });
});


// Initial UI update when popup loads
document.addEventListener("DOMContentLoaded", () => {
  browser.storage.local.get("github_token").then(result => {
    updateUI(!!result.github_token);
  }).catch(err => {
    console.error("Error checking storage on load:", err);
    status.textContent = "Error checking storage.";
  });
});