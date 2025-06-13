// popup/popup.js
const CLIENT_ID = "Ov23li5yyflTNfRcNjhc"; // <--- REPLACE THIS with your actual GitHub Client ID

const loginBtn = document.getElementById("loginBtn");
const listReposBtn = document.getElementById("listReposBtn");
const logoutBtn = document.getElementById("logoutBtn");
const status = document.getElementById("status");

const repoSelectionDiv = document.getElementById("repoSelection");
const repoSelect = document.getElementById("repoSelect");
const viewRepoDetailsBtn = document.getElementById("viewRepoDetailsBtn");
const createFolderBtn = document.getElementById("createFolderBtn"); // New
const createFolderStatus = document.getElementById("createFolderStatus"); // New

const repoDetailsDiv = document.getElementById("repoDetails");
const repoDetailsStatus = document.getElementById("repoDetailsStatus");
const selectedRepoInfo = document.getElementById("selectedRepoInfo");


// Function to update UI based on login status
function updateUI(tokenExists, lastSelectedRepo = null) {
  if (tokenExists) {
    loginBtn.style.display = "none";
    listReposBtn.style.display = "block";
    logoutBtn.style.display = "block";
    repoSelectionDiv.style.display = "block";
    status.textContent = "✅ Token ready!";

    // If there's a last selected repo, pre-select it in the dropdown
    if (lastSelectedRepo) {
        // Need to ensure the option is already in the select list.
        // This will be handled after LIST_REPOS and before showing repoSelectionDiv.
    }
  } else {
    loginBtn.style.display = "block";
    listReposBtn.style.display = "none";
    logoutBtn.style.display = "none";
    repoSelectionDiv.style.display = "none";
    createFolderBtn.style.display = "none"; // Hide create folder button
    createFolderStatus.textContent = ""; // Clear status
    status.textContent = "🔒 Not logged in.";
    repoDetailsStatus.textContent = "Select a repository and click 'View Details'.";
    selectedRepoInfo.innerHTML = "";
    repoSelect.innerHTML = '<option value="">-- Please select a repo --</option>'; // Clear dropdown
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
              // After login, automatically list repos and attempt to re-select last one
              browser.storage.local.get("last_selected_repo").then(storageResult => {
                updateUI(true); // Show logged in UI
                listRepos(storageResult.last_selected_repo); // Pass last selected repo to listRepos
              });
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

// Helper function to list repos and potentially pre-select
function listRepos(preSelectRepoFullName = null) {
  repoDetailsStatus.textContent = "Loading repositories...";
  repoSelect.innerHTML = '<option value="">-- Please select a repo --</option>'; // Clear and reset dropdown
  selectedRepoInfo.innerHTML = ""; // Clear previous details
  createFolderBtn.style.display = "none"; // Hide create folder button until repo is selected
  createFolderStatus.textContent = "";

  browser.storage.local.get("github_token").then(result => {
    if (result.github_token) {
      browser.runtime.sendMessage({ type: "LIST_REPOS", token: result.github_token })
        .then(response => {
          if (response && response.status === "success") {
            const repos = response.repos;
            if (repos.length === 0) {
              repoDetailsStatus.textContent = "No public repositories found for this user.";
            } else {
              repoDetailsStatus.textContent = `Found ${repos.length} repositories. Please select one:`;
              repos.forEach(repo => {
                const option = document.createElement("option");
                option.value = repo.full_name;
                option.textContent = repo.full_name;
                repoSelect.appendChild(option);
              });

              // Pre-select the last chosen repo if provided and available in the list
              if (preSelectRepoFullName && Array.from(repoSelect.options).some(opt => opt.value === preSelectRepoFullName)) {
                  repoSelect.value = preSelectRepoFullName;
                  // Automatically view details for the pre-selected repo
                  viewRepoDetails(preSelectRepoFullName);
              } else {
                  repoDetailsStatus.textContent = "Select a repository and click 'View Details'.";
                  createFolderBtn.style.display = "none"; // Hide if no valid pre-selection
              }
            }
          } else {
            console.error("Failed to list repos:", response.message);
            repoDetailsStatus.textContent = `❌ Failed to list repos: ${response.message || "Unknown error"}`;
            if (response.message && (response.message.includes("401") || response.message.includes("invalid token"))) {
                browser.storage.local.remove("github_token").then(() => {
                    updateUI(false);
                    status.textContent = "Token invalid/expired. Please login again.";
                });
            }
          }
        })
        .catch(err => {
          console.error("Error sending list repos message:", err);
          repoDetailsStatus.textContent = `❌ Communication error: ${err.message}`;
        });
    } else {
      repoDetailsStatus.textContent = "🔒 Not logged in. Please log in first.";
      updateUI(false);
    }
  }).catch(err => {
    console.error("Error accessing storage:", err);
    repoDetailsStatus.textContent = `Error accessing storage: ${err.message}`;
  });
}

// Event Listener for List Repos Button
listReposBtn.addEventListener("click", () => listRepos()); // Call helper function

// Helper function to view repo details
function viewRepoDetails(repoFullName) {
  if (!repoFullName) {
    repoDetailsStatus.textContent = "Please select a repository first.";
    selectedRepoInfo.innerHTML = "";
    createFolderBtn.style.display = "none";
    return;
  }

  repoDetailsStatus.textContent = `Loading details for ${repoFullName}...`;
  selectedRepoInfo.innerHTML = "";
  createFolderBtn.style.display = "none"; // Hide until loaded

  browser.storage.local.get("github_token").then(result => {
    if (result.github_token) {
      browser.runtime.sendMessage({ type: "FETCH_REPO_DETAILS", token: result.github_token, repoFullName: repoFullName })
        .then(response => {
          if (response && response.status === "success") {
            const repo = response.repo;
            repoDetailsStatus.textContent = `Details for ${repo.full_name}:`;
            selectedRepoInfo.innerHTML = `
                <div>
                    <strong>Name:</strong> <a href="${repo.html_url}" target="_blank">${repo.name}</a><br>
                    <strong>Owner:</strong> ${repo.owner.login}<br>
                    <strong>Description:</strong> ${repo.description || 'N/A'}<br>
                    <strong>Language:</strong> ${repo.language || 'N/A'}<br>
                    <strong>Stars:</strong> ${repo.stargazers_count}<br>
                    <strong>Forks:</strong> ${repo.forks_count}<br>
                    <strong>Last Updated:</strong> ${new Date(repo.updated_at).toLocaleDateString()}<br>
                </div>
            `;
            createFolderBtn.style.display = "block"; // Show create folder button after details are loaded
            createFolderStatus.textContent = ""; // Clear any previous folder creation status

            // Store the currently selected repo for persistence
            browser.storage.local.set({ last_selected_repo: repoFullName }).then(() => {
                console.log("Last selected repo stored:", repoFullName);
            }).catch(err => console.error("Error storing last selected repo:", err));

          } else {
            console.error("Failed to fetch repo details:", response.message);
            repoDetailsStatus.textContent = `❌ Failed to fetch repo details: ${response.message || "Unknown error"}`;
            selectedRepoInfo.innerHTML = "";
            createFolderBtn.style.display = "none";
            if (response.message && (response.message.includes("401") || response.message.includes("invalid token"))) {
                browser.storage.local.remove("github_token").then(() => {
                    updateUI(false);
                    status.textContent = "Token invalid/expired. Please login again.";
                });
            }
          }
        })
        .catch(err => {
          console.error("Error sending fetch repo details message:", err);
          repoDetailsStatus.textContent = `❌ Communication error: ${err.message}`;
          selectedRepoInfo.innerHTML = "";
          createFolderBtn.style.display = "none";
        });
    } else {
      repoDetailsStatus.textContent = "🔒 Not logged in. Please log in first.";
      updateUI(false);
    }
  }).catch(err => {
    console.error("Error accessing storage:", err);
    repoDetailsStatus.textContent = `Error accessing storage: ${err.message}`;
  });
}

// Event Listener for View Repo Details Button
viewRepoDetailsBtn.addEventListener("click", () => {
  const selectedRepoFullName = repoSelect.value;
  viewRepoDetails(selectedRepoFullName);
});

// New: Event Listener for Create Folder Button
createFolderBtn.addEventListener("click", () => {
  const selectedRepoFullName = repoSelect.value;
  if (!selectedRepoFullName) {
    createFolderStatus.textContent = "Please select a repository first!";
    return;
  }

  const folderName = "new-test-folder"; // Define your fixed folder name here
  const fileName = ".gitkeep"; // Standard practice to mark empty folders

  createFolderStatus.textContent = `Creating folder '${folderName}' in '${selectedRepoFullName}'...`;

  browser.storage.local.get("github_token").then(result => {
    if (result.github_token) {
      browser.runtime.sendMessage({
        type: "CREATE_FOLDER",
        token: result.github_token,
        repoFullName: selectedRepoFullName,
        folderPath: `${folderName}/${fileName}` // Path to the dummy file inside the folder
      })
      .then(response => {
        if (response && response.status === "success") {
          createFolderStatus.textContent = `✅ Folder '${folderName}' created successfully!`;
          console.log("Folder creation response:", response.details);
        } else {
          console.error("Failed to create folder:", response.message);
          createFolderStatus.textContent = `❌ Failed to create folder: ${response.message || "Unknown error"}`;
        }
      })
      .catch(err => {
        console.error("Error sending create folder message:", err);
        createFolderStatus.textContent = `❌ Communication error: ${err.message}`;
      });
    } else {
      createFolderStatus.textContent = "🔒 Not logged in. Please log in first.";
      updateUI(false);
    }
  }).catch(err => {
    console.error("Error accessing storage for folder creation:", err);
    createFolderStatus.textContent = `Error accessing storage: ${err.message}`;
  });
});


// Event Listener for Logout Button
logoutBtn.addEventListener("click", () => {
  browser.storage.local.remove("github_token", "last_selected_repo").then(() => { // Also remove last_selected_repo
    console.log("Token and last selected repo removed from storage.");
    updateUI(false);
    status.textContent = "👋 Logged out.";
  }).catch(err => {
    console.error("Error removing token:", err);
    status.textContent = `Error logging out: ${err.message}`;
  });
});


// Initial UI update when popup loads
document.addEventListener("DOMContentLoaded", () => {
  browser.storage.local.get(["github_token", "last_selected_repo"]).then(result => {
    const tokenExists = !!result.github_token;
    const lastSelectedRepo = result.last_selected_repo;
    updateUI(tokenExists, lastSelectedRepo); // Pass last selected repo to updateUI

    if (tokenExists) {
        listRepos(lastSelectedRepo); // Automatically list repos and attempt to pre-select
    }
  }).catch(err => {
    console.error("Error checking storage on load:", err);
    status.textContent = "Error checking storage.";
  });
});