// content_script.js

// IMPORTANT: This script now directly accesses storage and makes API calls.
// This is generally less secure as it exposes sensitive keys to the webpage's context.

(async () => {
  const SCRIPT_NAME = "LeetCode Gemini Explainer";

  // Function to wait for "Accepted" submission result
  function waitForAcceptedSubmission() {
    return new Promise(resolve => {
      const observer = new MutationObserver(() => {
        const resultSpan = document.querySelector('span[data-e2e-locator="submission-result"]');
        if (resultSpan?.innerText.trim() === "Accepted") {
          observer.disconnect();
          console.log(`[${SCRIPT_NAME}] ✅ Accepted submission detected! Proceeding...`);
          alert(`[${SCRIPT_NAME}] Submission Accepted! Extracting data and fetching explanation...`);
          setTimeout(resolve, 1000); // Give it a moment for the page to fully settle
        }
      });

      console.log(`[${SCRIPT_NAME}] ⏳ Waiting for Accepted Submission...`);
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // Helper functions for data extraction (largely unchanged)
  function extractTitleAndNumber() {
    const titleElement = document.querySelector('div.text-title-large a[href^="/problems/"]');
    const fullTitle = titleElement?.innerText || "Not found";
    let problemNumber = "N/A", problemName = "N/A";

    if (fullTitle.includes(".")) {
      const parts = fullTitle.split(".");
      problemNumber = parts[0].trim();
      problemName = parts.slice(1).join(".").trim();
    }
    return { fullTitle, problemNumber, problemName };
  }

  function extractCode() {
    const codeElement = document.querySelector("div.view-lines");
    if (codeElement) {
      return Array.from(codeElement.querySelectorAll("div.view-line"))
        .map(line => line.innerText)
        .join("\n");
    }
    const fallbackCodeElement = document.querySelector('.CodeMirror-code');
    if (fallbackCodeElement) {
        return Array.from(fallbackCodeElement.querySelectorAll("pre.CodeMirror-line"))
            .map(line => line.innerText)
            .join("\n");
    }
    console.warn(`[${SCRIPT_NAME}] Code element not found.`);
    return "Code not found.";
  }

  function extractDifficulty() {
    const el = document.querySelector('div.text-difficulty-easy, div.text-difficulty-medium, div.text-difficulty-hard');
    return el?.innerText || "Unknown";
  }

  function extractTopics() {
    return Array.from(document.querySelectorAll('a[href^="/tag/"]')).map(el => el.innerText.trim());
  }

  function extractConstraints() {
    const constraintElements = Array.from(document.querySelectorAll("p code, li code, strong code"));
    const raw = constraintElements.map(el => el.innerText.trim());
    return raw.filter(line => /(time|space)\s*complexity/i.test(line) || /O\([^)]*\)/.test(line));
  }

  function extractExamples() {
    const examples = [];
    const preTags = Array.from(document.querySelectorAll("pre"));

    preTags.forEach((pre, i) => {
      const text = pre.innerText;
      const input = (text.match(/Input:\s*([\s\S]*?)(?=\nOutput:|$)/i) || [])[1]?.trim() || "";
      const output = (text.match(/Output:\s*([\s\S]*?)(?=\nExplanation:|$)/i) || [])[1]?.trim() || "";
      const explanation = (text.match(/Explanation:\s*([\s\S]*)/i) || [])[1]?.trim() || "";

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

  // Consolidated function to extract all problem data
  function extractProblemData() {
    const { fullTitle, problemNumber, problemName } = extractTitleAndNumber();
    const extractedData = {
      fullTitle,
      problemNumber,
      problemName,
      submittedCode: extractCode(),
      difficulty: extractDifficulty(),
      topics: extractTopics(),
      constraints: extractConstraints(),
      examples: extractExamples(),
    };
    console.log(`[${SCRIPT_NAME}] 🧠 Extracted Problem Data:`, extractedData);
    return extractedData;
  }

  // Function to get Gemini explanation
  async function getGeminiExplanation(code, problemTitle = "Unknown Problem") {
    // Directly get API key from storage
    const result = await browser.storage.local.get("gemini_ai_api_key");
    const GEMINI_API_KEY = result.gemini_ai_api_key;

    if (!GEMINI_API_KEY) {
      console.error(`[${SCRIPT_NAME}] ❌ Gemini API Key not found in extension storage. Please set it in the popup settings.`);
      alert(`[${SCRIPT_NAME}] Error: Gemini API Key not found. Please set it in the extension settings.`);
      return; // Stop execution if API key is missing
    }

    const prompt = `
Problem: ${problemTitle}

Solution Approach: Analyze the provided code to determine its approach (e.g., Brute Force, Dynamic Programming, Greedy, Two Pointers, etc.) and explain it.

Logic Explanation based on code (likely C++ or Python):
\`\`\`
${code}
\`\`\`

Now give the response in the following format:

Problem: [Problem Name and Number]
Solution Approach: [Brute Force/Optimized/Specific Algorithm]
Logic Explanation based on code:
[Detailed explanation of how the provided code solves the problem, step-by-step, explaining variables and control flow.]

Complexity Analysis:

Time Complexity: O([complexity])
[Justification for time complexity based on code operations, loops, recursion, etc.]

Space Complexity: O([complexity])
[Justification for space complexity based on auxiliary data structures used (arrays, maps, recursion stack), etc.]
`;

    try {
      console.log(`[${SCRIPT_NAME}] 📡 Calling Gemini API for explanation...`);
      alert(`[${SCRIPT_NAME}] Fetching explanation from Gemini AI...`);

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4 }
        })
      });

      const data = await res.json();
      const aiReply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (aiReply) {
        console.log(`[${SCRIPT_NAME}] 📘 Gemini Response:\n\n`, aiReply);
        alert(`[${SCRIPT_NAME}] Gemini Explanation Ready! Check browser console for full details.`);
      } else {
        console.error(`[${SCRIPT_NAME}] ❌ No valid Gemini response:`, data);
        alert(`[${SCRIPT_NAME}] Error: Could not get a valid Gemini explanation. Check console for details.`);
      }
    } catch (error) {
      console.error(`[${SCRIPT_NAME}] 💥 Error calling Gemini API:`, error);
      alert(`[${SCRIPT_NAME}] Error calling Gemini API: ${error.message}. Check console.`);
    }
  }

  // === RUN FLOW ===
  // Only proceed if we are on a submission details page
  if (window.location.href.includes("/submissions/")) {
    await waitForAcceptedSubmission(); // Wait for the submission to be accepted
    const problemData = extractProblemData(); // Extract data after acceptance
    await getGeminiExplanation(problemData.submittedCode, problemData.fullTitle); // Get Gemini explanation
  }
})();