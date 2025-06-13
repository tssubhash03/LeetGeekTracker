// popup/popup.js

// --- Constants ---
const CLIENT_ID = "Ov23li5yyflTNfRcNjhc"; // <--- REPLACE THIS with your actual GitHub Client ID
const DEFAULT_FOLDER_NAME = "new-test-folder"; // Define your fixed folder name here

// --- Page Navigation Elements ---
const page1 = document.getElementById("page1");
const page2 = document.getElementById("page2");
const pageContainer = document.getElementById("pageContainer"); // Assuming a container div for pages

// --- GitHub Elements (Page 1) ---
const loginBtn = document.getElementById("loginBtn");
const listReposBtn = document.getElementById("listReposBtn");
const logoutBtn = document.getElementById("logoutBtn");
const githubStatus = document.getElementById("status"); // This correctly points to the 'status' ID in HTML

const repoSelectionDiv = document.getElementById("repoSelection");
const repoSelect = document.getElementById("repoSelect");
const viewRepoDetailsBtn = document.getElementById("viewRepoDetailsBtn");
const createFolderBtn = document.getElementById("createFolderBtn");
const createFolderStatus = document.getElementById("createFolderStatus");

const repoDetailsDiv = document.getElementById("repoDetails");
const repoDetailsStatus = document.getElementById("repoDetailsStatus");
const selectedRepoInfo = document.getElementById("selectedRepoInfo");

// --- API Key Elements (Page 2) ---
const aiKeyInput = document.getElementById("aiKey");
const editAIBtn = document.getElementById("editAI");
const saveAIBtn = document.getElementById("saveAI");
const cancelAIBtn = document.getElementById("cancelAI");

const excelKeyInput = document.getElementById("excelKey");
const editExcelBtn = document.getElementById("editExcel");
const saveExcelBtn = document.getElementById("saveExcel");
const cancelExcelBtn = document.getElementById("cancelExcel");

// --- Navigation Buttons (from your new HTML) ---
const gotoPage2Btn = document.getElementById("gotoPage2");
const backToPage1Btn = document.getElementById("backToPage1");

// --- Page Navigation Functions ---
function showPage(pageToShow) {
  if (pageToShow === "page1") {
    page1.classList.remove("hidden-left", "hidden-right");
    page1.classList.add("active");
    page2.classList.remove("active");
    page2.classList.add("hidden-right"); // Slide page 2 out to the right
  } else if (pageToShow === "page2") {
    page2.classList.remove("hidden-left", "hidden-right");
    page2.classList.add("active");
    page1.classList.remove("active");
    page1.classList.add("hidden-left"); // Slide page 1 out to the left
  }
  // Adjust container height dynamically based on the active page's content
  if (pageContainer) {
    // A small delay to allow content to render before measuring height
    setTimeout(() => {
      pageContainer.style.height = document.getElementById(pageToShow).offsetHeight + 'px';
    }, 50);
  }
}

// --- GitHub Related Functions ---

// Function to update UI based on login status
function updateGitHubUI(tokenExists, lastSelectedRepo = null) {
  if (tokenExists) {
    loginBtn.style.display = "none";
    listReposBtn.style.display = "block";
    logoutBtn.style.display = "block";
    repoSelectionDiv.style.display = "block";
    githubStatus.textContent = "✅ Token ready!";
  } else {
    loginBtn.style.display = "block";
    listReposBtn.style.display = "none";
    logoutBtn.style.display = "none";
    repoSelectionDiv.style.display = "none";
    createFolderBtn.style.display = "none"; // Hide create folder button
    createFolderStatus.textContent = ""; // Clear status
    githubStatus.textContent = "🔒 Not logged in.";
    repoDetailsStatus.textContent = "Select a repository and click 'View Details'.";
    selectedRepoInfo.innerHTML = "";
    repoSelect.innerHTML = '<option value="">-- Please select a repo --</option>'; // Clear dropdown
  }
}

// Helper function to list repos and potentially pre-select
async function listRepos(preSelectRepoFullName = null) {
  repoDetailsStatus.textContent = "Loading repositories...";
  repoSelect.innerHTML = '<option value="">-- Please select a repo --</option>'; // Clear and reset dropdown
  selectedRepoInfo.innerHTML = ""; // Clear previous details
  createFolderBtn.style.display = "none"; // Hide create folder button until repo is selected
  createFolderStatus.textContent = "";

  try {
    const result = await browser.storage.local.get("github_token");
    if (result.github_token) {
      const response = await browser.runtime.sendMessage({ type: "LIST_REPOS", token: result.github_token });
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
            await browser.storage.local.remove("github_token");
            updateGitHubUI(false);
            githubStatus.textContent = "Token invalid/expired. Please login again.";
        }
      }
    } else {
      repoDetailsStatus.textContent = "🔒 Not logged in. Please log in first.";
      updateGitHubUI(false);
    }
  } catch (err) {
    console.error("Error accessing storage or sending list repos message:", err);
    repoDetailsStatus.textContent = `❌ Communication error: ${err.message}`;
  }
}

// Helper function to view repo details
async function viewRepoDetails(repoFullName) {
  if (!repoFullName) {
    repoDetailsStatus.textContent = "Please select a repository first.";
    selectedRepoInfo.innerHTML = "";
    createFolderBtn.style.display = "none";
    return;
  }

  repoDetailsStatus.textContent = `Loading details for ${repoFullName}...`;
  selectedRepoInfo.innerHTML = "";
  createFolderBtn.style.display = "none"; // Hide until loaded

  try {
    const result = await browser.storage.local.get("github_token");
    if (result.github_token) {
      const response = await browser.runtime.sendMessage({ type: "FETCH_REPO_DETAILS", token: result.github_token, repoFullName: repoFullName });
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
        await browser.storage.local.set({ last_selected_repo: repoFullName });
        console.log("Last selected repo stored:", repoFullName);

      } else {
        console.error("Failed to fetch repo details:", response.message);
        repoDetailsStatus.textContent = `❌ Failed to fetch repo details: ${response.message || "Unknown error"}`;
        selectedRepoInfo.innerHTML = "";
        createFolderBtn.style.display = "none";
        if (response.message && (response.message.includes("401") || response.message.includes("invalid token"))) {
            await browser.storage.local.remove("github_token");
            updateGitHubUI(false);
            githubStatus.textContent = "Token invalid/expired. Please login again.";
        }
      }
    } else {
      repoDetailsStatus.textContent = "🔒 Not logged in. Please log in first.";
      updateGitHubUI(false);
    }
  } catch (err) {
    console.error("Error accessing storage or sending fetch repo details message:", err);
    repoDetailsStatus.textContent = `❌ Communication error: ${err.message}`;
    selectedRepoInfo.innerHTML = "";
    createFolderBtn.style.display = "none";
  }
}

// --- API Key Management Functions ---

async function loadApiKeys() {
  const result = await browser.storage.local.get(["gemini_ai_api_key", "google_excel_sheet_key"]);
  aiKeyInput.value = result.gemini_ai_api_key || "";
  excelKeyInput.value = result.google_excel_sheet_key || "";
}

function toggleEditMode(input, editBtn, saveBtn, cancelBtn, enable) {
  input.disabled = !enable;
  editBtn.style.display = enable ? "none" : "inline-block";
  saveBtn.style.display = enable ? "inline-block" : "none";
  cancelBtn.style.display = enable ? "inline-block" : "none";
}

// --- Event Listeners ---

// Page Navigation
if (gotoPage2Btn) { // Check if button exists before adding listener
  gotoPage2Btn.addEventListener("click", () => showPage("page2"));
}
if (backToPage1Btn) { // Check if button exists before adding listener
  backToPage1Btn.addEventListener("click", () => showPage("page1"));
}

// GitHub Integration
loginBtn.addEventListener("click", () => {
  const REDIRECT_URI_FOR_IDENTITY = browser.identity.getRedirectURL();
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI_FOR_IDENTITY)}&scope=repo&state=${crypto.randomUUID()}`;

  console.log("Initiating OAuth flow with Redirect URI:", REDIRECT_URI_FOR_IDENTITY);

  browser.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true
  }, async function(redirectUrl) {
    if (browser.runtime.lastError) {
      console.error("Auth flow failed:", browser.runtime.lastError.message);
      githubStatus.textContent = "Login failed: " + browser.runtime.lastError.message;
      updateGitHubUI(false);
      return;
    }
    if (redirectUrl) {
      console.log("Redirect URL from auth flow:", redirectUrl);
      const urlParams = new URLSearchParams(new URL(redirectUrl).search);
      const code = urlParams.get("code");
      const state = urlParams.get("state");

      if (code) {
        githubStatus.textContent = "🚀 Exchanging code...";
        try {
          const response = await browser.runtime.sendMessage({ type: "EXCHANGE_CODE", code: code, state: state });
          if (response && response.status === "success") {
            const storageResult = await browser.storage.local.get("last_selected_repo");
            updateGitHubUI(true);
            listRepos(storageResult.last_selected_repo);
          } else {
            console.error("Token exchange failed:", response.message);
            githubStatus.textContent = `❌ Token exchange failed: ${response.message || "Unknown error"}`;
            updateGitHubUI(false);
          }
        } catch (err) {
          console.error("Error sending code to background:", err);
          githubStatus.textContent = `❌ Error communicating with background: ${err.message}`;
          updateGitHubUI(false);
        }
      } else {
        githubStatus.textContent = "❌ No code received in redirect.";
        updateGitHubUI(false);
      }
    } else {
      githubStatus.textContent = "Login cancelled.";
      updateGitHubUI(false);
    }
  });
});

listReposBtn.addEventListener("click", () => listRepos());

viewRepoDetailsBtn.addEventListener("click", () => {
  const selectedRepoFullName = repoSelect.value;
  viewRepoDetails(selectedRepoFullName);
});

createFolderBtn.addEventListener("click", async () => {
  const selectedRepoFullName = repoSelect.value;
  if (!selectedRepoFullName) {
    createFolderStatus.textContent = "Please select a repository first!";
    return;
  }

  const folderName = DEFAULT_FOLDER_NAME;
  const fileName = ".gitkeep";

  createFolderStatus.textContent = `Creating folder '${folderName}' in '${selectedRepoFullName}'...`;

  try {
    const result = await browser.storage.local.get("github_token");
    if (result.github_token) {
      const response = await browser.runtime.sendMessage({
        type: "CREATE_FOLDER",
        token: result.github_token,
        repoFullName: selectedRepoFullName,
        folderPath: `${folderName}/${fileName}`
      });
      if (response && response.status === "success") {
        createFolderStatus.textContent = `✅ Folder '${folderName}' created successfully!`;
        console.log("Folder creation response:", response.details);
      } else {
        console.error("Failed to create folder:", response.message);
        createFolderStatus.textContent = `❌ Failed to create folder: ${response.message || "Unknown error"}`;
      }
    } else {
      createFolderStatus.textContent = "🔒 Not logged in. Please log in first.";
      updateGitHubUI(false);
    }
  } catch (err) {
    console.error("Error accessing storage or sending create folder message:", err);
    createFolderStatus.textContent = `❌ Communication error: ${err.message}`;
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await browser.storage.local.remove("github_token", "last_selected_repo");
    console.log("Token and last selected repo removed from storage.");
    updateGitHubUI(false);
    githubStatus.textContent = "👋 Logged out.";
  } catch (err) {
    console.error("Error removing token:", err);
    githubStatus.textContent = `Error logging out: ${err.message}`;
  }
});

// API Key Management Listeners
editAIBtn.addEventListener("click", () => toggleEditMode(aiKeyInput, editAIBtn, saveAIBtn, cancelAIBtn, true));
saveAIBtn.addEventListener("click", async () => {
  await browser.storage.local.set({ gemini_ai_api_key: aiKeyInput.value });
  toggleEditMode(aiKeyInput, editAIBtn, saveAIBtn, cancelAIBtn, false);
  console.log("Gemini AI Key saved.");
});
cancelAIBtn.addEventListener("click", () => {
  loadApiKeys();
  toggleEditMode(aiKeyInput, editAIBtn, saveAIBtn, cancelAIBtn, false);
});

editExcelBtn.addEventListener("click", () => toggleEditMode(excelKeyInput, editExcelBtn, saveExcelBtn, cancelExcelBtn, true));
saveExcelBtn.addEventListener("click", async () => {
  await browser.storage.local.set({ google_excel_sheet_key: excelKeyInput.value });
  toggleEditMode(excelKeyInput, editExcelBtn, saveExcelBtn, cancelExcelBtn, false);
  console.log("Google Excel Sheet Key saved.");
});
cancelExcelBtn.addEventListener("click", () => {
  loadApiKeys();
  toggleEditMode(excelKeyInput, editExcelBtn, saveExcelBtn, cancelExcelBtn, false);
});

// --- Initial Setup ---
document.addEventListener("DOMContentLoaded", async () => {
  showPage("page1"); // Start on page 1

  // Load GitHub state
  try {
    const result = await browser.storage.local.get(["github_token", "last_selected_repo"]);
    const tokenExists = !!result.github_token;
    const lastSelectedRepo = result.last_selected_repo;
    updateGitHubUI(tokenExists, lastSelectedRepo);

    if (tokenExists) {
        listRepos(lastSelectedRepo);
    } else {
        githubStatus.textContent = "🔒 Not logged in to GitHub.";
    }
  } catch (err) {
    console.error("Error checking GitHub storage on load:", err);
    githubStatus.textContent = "Error checking GitHub login status.";
  }

  // Load API Keys for settings page
  loadApiKeys();
});