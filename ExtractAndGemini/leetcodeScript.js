// leetcodeScript.js

async function waitForCodeAndExtract(callback, retries = 10) {
  const codeReady = document.querySelector("div.view-lines");
  if (codeReady) {
    const data = extractProblemInfo();
    console.log("✅ Accepted Submission Extracted:", data);
    showPopup("✅ Problem data extracted successfully!", "green");

    try {
      const aiResponse = await getFormattedGeminiExplanation(data.submittedCode, data.fullTitle);
      data.aiResponse = aiResponse;
      console.log(aiResponse);
      
      const safeTitle = data.fullTitle.replace(/[^\w\s\-]/g, "").replace(/\s+/g, "_");
      downloadJSON(data, `gfg_metadata_${safeTitle}.json`);
    } catch (err) {
      console.error("⚠️ Gemini explanation failed:", err);
    }

    if (callback) callback();
  } else if (retries > 0) {
    setTimeout(() => waitForCodeAndExtract(callback, retries - 1), 500);
  } else {
    showPopup("❌ Code not loaded in time", "red");
  }
}


function runExtractor() {
  if (alreadyExtracted) return;
  waitForAcceptedSubmission(() => {
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

browser.storage.local.get("gemini_api_key").then(res => {
  GEMINI_API_KEY = res.gemini_api_key;
  if (!GEMINI_API_KEY) {
    showPopup("⚠️ Set Gemini API key in extension popup!", "red");
  }
  setTimeout(runExtractor, 1000);
});
