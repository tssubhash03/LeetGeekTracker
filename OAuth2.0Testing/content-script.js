// content_script.js

// IMPORTANT: This script runs in the context of the LeetCode page.
// It cannot directly access browser.storage.local or make cross-origin requests
// to the Gemini API due to CORS, so it communicates with background.js.

(async () => {
  // Function to wait for "Accepted" submission result
  function waitForAcceptedSubmission() {
    return new Promise(resolve => {
      const observer = new MutationObserver(() => {
        const resultSpan = document.querySelector('span[data-e2e-locator="submission-result"]');
        if (resultSpan?.innerText.trim() === "Accepted") {
          observer.disconnect();
          // Log to the LeetCode page's console for immediate visual confirmation
          console.log("✅ Accepted submission detected (on LeetCode page console)!");
          setTimeout(resolve, 1000); // Give it a moment for the page to fully settle
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // Helper functions for data extraction
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
    // Common selector for LeetCode code editor
    const codeElement = document.querySelector("div.view-lines");
    if (codeElement) {
      return Array.from(codeElement.querySelectorAll("div.view-line"))
        .map(line => line.innerText)
        .join("\n");
    }

    // Fallback for older UI or different sections (e.g., in discussion posts)
    const fallbackCodeElement = document.querySelector('.CodeMirror-code');
    if (fallbackCodeElement) {
        // CodeMirror structures lines in `pre` tags within `div.CodeMirror-code`
        return Array.from(fallbackCodeElement.querySelectorAll("pre.CodeMirror-line"))
            .map(line => line.innerText)
            .join("\n");
    }

    console.warn("Code element not found using standard or fallback selectors.");
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
    // Look for constraints usually within `li` tags or `p` tags that contain `code`
    const constraintElements = Array.from(document.querySelectorAll("p code, li code, strong code"));
    const raw = constraintElements.map(el => el.innerText.trim());
    // Filter for common complexity notations or keywords
    return raw.filter(line => /(time|space)\s*complexity/i.test(line) || /O\([^)]*\)/.test(line));
  }

  function extractExamples() {
    const examples = [];
    // LeetCode's structure for examples can vary. Look for common patterns.
    // Usually, examples are in <pre> tags following input/output text.
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

    // Send extracted data to background script for logging
    browser.runtime.sendMessage({
      type: "LOG_TO_BACKGROUND",
      payload: {
        source: "content_script",
        message: "Extracted Problem Data",
        data: extractedData
      }
    });
    return extractedData;
  }

  // Function to get Gemini explanation
  async function getGeminiExplanation(code, problemTitle = "Unknown Problem") {
    // Request API key from background script
    const response = await browser.runtime.sendMessage({ type: "GET_GEMINI_API_KEY" });
    const GEMINI_API_KEY = response.key;

    if (!GEMINI_API_KEY) {
      console.error("❌ Gemini API Key not available from extension storage.");
      // Send error to background script
      browser.runtime.sendMessage({
        type: "LOG_TO_BACKGROUND",
        payload: {
          source: "content_script",
          message: "Error: Gemini API Key not found.",
          error: "API key not set in extension popup or storage issue."
        }
      });
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
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4 } // Adjust temperature as needed
        })
      });

      const data = await res.json();
      const aiReply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      // Send Gemini response to background script for logging
      if (aiReply) {
        browser.runtime.sendMessage({
          type: "LOG_TO_BACKGROUND",
          payload: {
            source: "content_script",
            message: "Gemini Response Received",
            data: aiReply
          }
        });
        // Also log to the LeetCode page's console for immediate visual confirmation
        console.log("📘 Gemini Response (on LeetCode page console):\n\n", aiReply);
      } else {
        console.error("❌ No valid Gemini response:", data);
        // Send error to background script
        browser.runtime.sendMessage({
          type: "LOG_TO_BACKGROUND",
          payload: {
            source: "content_script",
            message: "Error: No valid Gemini response",
            data: data
          }
        });
      }
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      // Send fetch error to background script
      browser.runtime.sendMessage({
        type: "LOG_TO_BACKGROUND",
        payload: {
          source: "content_script",
          message: "Error calling Gemini API",
          error: error.message
        }
      });
    }
  }

  // === RUN FLOW ===
  // Only proceed if we are on a submission details page
  // The manifest.json `matches` ensures this, but an extra check doesn't hurt.
  if (window.location.href.includes("/submissions/")) {
    // Send initial status to background script
    browser.runtime.sendMessage({
      type: "LOG_TO_BACKGROUND",
      payload: {
        source: "content_script",
        message: "Content script initialized on LeetCode submission page. Waiting for 'Accepted' status."
      }
    });

    // An alert can be intrusive. Consider replacing with UI elements later.
    alert("📢 Waiting for Accepted Submission...");

    await waitForAcceptedSubmission(); // Wait for the submission to be accepted
    const problemData = extractProblemData(); // Extract data after acceptance
    await getGeminiExplanation(problemData.submittedCode, problemData.fullTitle); // Get Gemini explanation
  }
})();