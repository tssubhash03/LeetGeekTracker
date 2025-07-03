// content_scripts/leetcodeScript.js (Updated)

// Make sure `alreadyExtracted`, `showPopup`, `extractProblemInfo`, `downloadJSON`, etc.
// are either defined here, or (preferably) in content_scripts/extractor.js
// which leetcodeScript.js will import.

let GEMINI_API_KEY_LOADED = false; // Track if we've attempted to load the key status

async function waitForCodeAndExtract(callback, retries = 10) {
  const codeReady = document.querySelector("div.view-lines");
  if (codeReady) {
    const data = extractProblemInfo(); // Assumes extractProblemInfo is available (from extractor.js)
    console.log("✅ Accepted Submission Extracted:", data);
    showPopup("✅ Problem data extracted successfully!", "green"); // Assumes showPopup is available

    const platform = "leetcode";
    data.platform = platform;

    // --- NEW: Request Gemini explanation from background script ---
    try {
      showPopup("Asking Gemini for explanation...", "blue");
      const response = await browser.runtime.sendMessage({
        type: "GET_GEMINI_EXPLANATION",
        submittedCode: data.submittedCode,
        fullTitle: data.fullTitle
      });

      if (response.status === "success") {
        data.aiResponse = response.explanation;
        console.log("✅ Gemini explanation received:", response.explanation);
        showPopup("📘 Gemini explanation received!", "green");
      } else {
        console.error("⚠️ Gemini explanation failed (from background):", response.message, response.details);
        showPopup(`❌ Gemini explanation failed: ${response.message}`, "red");
      }

      const safeTitle = data.fullTitle.replace(/[^\w\s\-]/g, "").replace(/\s+/g, "_");
      downloadJSON(data, `leetcode_metadata_${safeTitle}.json`); // Renamed to leetcode_metadata
    } catch (err) {
      console.error("⚠️ Error sending message to background for Gemini:", err);
      showPopup("❌ Communication error with background script for Gemini.", "red");
    }

    if (callback) callback();
  } else if (retries > 0) {
    setTimeout(() => waitForCodeAndExtract(callback, retries - 1), 500);
  } else {
    showPopup("❌ Code not loaded in time", "red");
  }
}

function runExtractor() {
  if (alreadyExtracted) return; // Assumes alreadyExtracted is available (from extractor.js)
  waitForAcceptedSubmission(() => { // Assumes waitForAcceptedSubmission is available (from extractor.js)
    if (!alreadyExtracted) {
      waitForCodeAndExtract();
    }
  });
}

let lastUrl = location.href;
new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    alreadyExtracted = false;
    console.log("🔁 URL changed:", currentUrl);
    setTimeout(runExtractor, 1000);
  }
}).observe(document, { subtree: true, childList: true });


// --- NEW: Check for Gemini API key on script load (once) ---
// This ensures showPopup is called if the key isn't set, without making an actual API call.
browser.storage.local.get("gemini_ai_api_key").then(res => {
  if (!res.gemini_ai_api_key && !GEMINI_API_KEY_LOADED) {
    showPopup("⚠️ Set Gemini API key in extension popup!", "red");
  }
  GEMINI_API_KEY_LOADED = true; // Mark that we've checked the key status
  setTimeout(runExtractor, 1000); // Only run the extractor after checking API key status
});

// Remove the global GEMINI_API_KEY variable from here
// The content script will never directly access the key.