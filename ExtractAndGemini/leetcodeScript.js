let GEMINI_API_KEY = "";
let alreadyExtracted = false;

function showPopup(message, color = "green") {
  const popup = document.createElement("div");
  popup.textContent = message;
  popup.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: ${color};
    color: white;
    padding: 8px 12px;
    border-radius: 5px;
    z-index: 9999;
    font-size: 14px;
  `;
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 3000);
}

function waitForAcceptedSubmission(callback) {
  const observer = new MutationObserver(() => {
    const acceptedElement = document.querySelector('span[data-e2e-locator="submission-result"]');
    const isAccepted = acceptedElement && acceptedElement.innerText.trim() === "Accepted";

    if (isAccepted && !alreadyExtracted) {
      alreadyExtracted = true;
      observer.disconnect();
      console.log("✅ Submission accepted");
      setTimeout(() => waitForCodeAndExtract(callback), 2000); // Allow DOM to settle
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function extractTitleAndNumber() {
  const titleElement = document.querySelector('div.text-title-large a[href^="/problems/"]');
  const fullTitle = titleElement?.innerText || "Not found";
  let problemNumber = "N/A";
  let problemName = "N/A";

  if (fullTitle.includes(".")) {
    const parts = fullTitle.split(".");
    problemNumber = parts[0].trim();
    problemName = parts.slice(1).join(".").trim();
  }

  return { fullTitle, problemNumber, problemName };
}

function extractProblemDescription() {
  const descriptionDiv = document.querySelector('div[data-track-load="description_content"]');
  if (!descriptionDiv) return "Description not found.";

  const clone = descriptionDiv.cloneNode(true);
  const paragraphs = Array.from(clone.querySelectorAll("p, pre, div, strong"));

  for (let i = 0; i < paragraphs.length; i++) {
    if (/example/i.test(paragraphs[i].textContent)) {
      // Remove everything after this paragraph
      while (paragraphs[i] && paragraphs[i].nextSibling) {
        paragraphs[i].parentNode.removeChild(paragraphs[i].nextSibling);
      }
      break;
    }
  }

  return clone.innerText.trim();
}


function extractCode() {
  const codeElement = document.querySelector("div.view-lines");
  if (!codeElement) return "Code not found.";
  return Array.from(codeElement.querySelectorAll("div.view-line"))
    .map(line => line.innerText)
    .join("\n");
}

function extractDifficulty() {
  const el = document.querySelector('div.text-difficulty-easy, div.text-difficulty-medium, div.text-difficulty-hard');
  return el?.innerText || "Unknown";
}

function extractTopics() {
  return Array.from(document.querySelectorAll('a[href^="/tag/"]')).map(el => el.innerText.trim());
}

function extractConstraints() {
  const constraintLines = [];

  const constraintHeading = Array.from(document.querySelectorAll("p, h3, h4")).find(
    el => el.textContent.trim().toLowerCase().includes("constraints")
  );

  if (constraintHeading) {
    const ul = constraintHeading.nextElementSibling;
    if (ul && ul.tagName === "UL") {
      const items = Array.from(ul.querySelectorAll("li")).map(li => li.innerText.trim());
      constraintLines.push(...items);
    }
  }

  const followUpEl = Array.from(document.querySelectorAll("strong")).find(
    el => el.textContent.trim().toLowerCase().startsWith("follow-up")
  );

  if (followUpEl) {
    const parent = followUpEl.parentElement;
    const followUpText = parent?.innerText?.trim() || followUpEl.innerText.trim();
    constraintLines.push(followUpText);
  }

  return constraintLines;
}

function extractExamples() {
  const examples = [];
  const preTags = Array.from(document.querySelectorAll("pre"));

  preTags.forEach((pre, i) => {
    const text = pre.innerText;
    const input = (text.match(/Input:\s*(.+)/) || [])[1]?.trim() || "";
    const output = (text.match(/Output:\s*(.+)/) || [])[1]?.trim() || "";
    const explanation = (text.match(/Explanation:\s*([\s\S]*)/) || [])[1]?.trim() || "";

    if (input && output) {
      examples.push({
        exampleNumber: i + 1,
        input,
        output,
        explanation,
      });
    }
  });

  return examples;
}

function extractProblemInfo() {
  const { fullTitle, problemNumber, problemName } = extractTitleAndNumber();
  const submittedCode = extractCode();
  const difficulty = extractDifficulty();
  const topics = extractTopics();
  const constraints = extractConstraints();
  const examples = extractExamples();
  const problemDescription = extractProblemDescription();

  return {
    fullTitle,
    problemNumber,
    problemName,
    submittedCode,
    difficulty,
    topics,
    constraints,
    problemDescription,
    examples
  };
}

function downloadJSON(data, filename = "metadata.json") {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function getFormattedGeminiExplanation(code, problemTitle = "Unknown Problem") {
  if (!GEMINI_API_KEY) {
    showPopup("⚠️ Gemini API key missing!", "red");
    return;
  }

  const prompt = `
Problem: ${problemTitle}

Solution Approach: Brute Force

Logic Explanation based on code:
${code}

Now give the response in the following format:

Problem: [Problem Name and Number]
Solution Approach: [Brute Force/Optimized]
Logic Explanation based on code:
[Your explanation here]

Complexity Analysis:

Time Complexity: O([complexity])
[Brief explanation of why this is the time complexity]

Space Complexity: O([complexity])
[Brief explanation of memory usage]
[Note any additional data structures created]
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4 }
        })
      }
    );

    const data = await response.json();
    console.log("🔍 Raw Gemini Response:", data);

    const aiReply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (aiReply) {
      console.log("📘 Gemini AI Explanation:\n\n", aiReply);
      showPopup("📘 Gemini explanation received!", "green");
    } else {
      console.error("❌ No valid response from Gemini:", data);
      showPopup("❌ Gemini response error", "red");
    }
  } catch (error) {
    console.error("❌ API Error:", error);
    showPopup("❌ Gemini API call failed", "red");
  }
}

function waitForCodeAndExtract(callback, retries = 10) {
  const codeReady = document.querySelector("div.view-lines");
  if (codeReady) {
    const data = extractProblemInfo();
    console.log("✅ Accepted Submission Extracted:", data);
    showPopup("✅ Problem data extracted successfully!", "green");

    const safeTitle = data.fullTitle.replace(/[^\w\s\-]/g, "").replace(/\s+/g, "_");
    downloadJSON(data, `gfg_metadata_${safeTitle}.json`);

    getFormattedGeminiExplanation(data.submittedCode, data.fullTitle);
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


// SPA Detection
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

// Load Gemini API Key and Start
browser.storage.local.get("gemini_api_key").then(res => {
  GEMINI_API_KEY = res.gemini_api_key || "";
  if (!GEMINI_API_KEY) {
    showPopup("⚠️ Set Gemini API key in extension popup!", "red");
  }
  setTimeout(runExtractor, 1000);
});
