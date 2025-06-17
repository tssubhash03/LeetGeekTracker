const input = document.getElementById("apiKeyInput");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");
const status = document.getElementById("status");

// Load saved key on popup open
browser.storage.local.get("gemini_api_key").then(res => {
  if(res.gemini_api_key) {
    input.value = res.gemini_api_key;
    browser.storage.local.get("gemini_api_key").then(res => {console.log(res.gemini_api_key)});

  }
});

saveBtn.addEventListener("click", () => {
  const key = input.value;
  if (!key) {
    status.style.color = "red";
    status.textContent = "API key cannot be empty.";
    return;
  }
  browser.storage.local.set({ gemini_api_key: key }).then(() => {
    status.style.color = "green";
    status.textContent = "API key saved.";
  });
});

cancelBtn.addEventListener("click", () => {
  window.close();
});
