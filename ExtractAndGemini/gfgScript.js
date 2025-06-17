(function extractGFGMetadataOnLoad() {
  const metadata = {
    fullTitle: "",
    difficulty: "Unknown",
    content: "",
    notes: "",
    examples: [],
    constraints: [],
    code: "",
    topics: []
  };

  function showPopup(msg, color = "green") {
    const popup = document.createElement("div");
    popup.textContent = msg;
    popup.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: ${color};
      color: white;
      padding: 8px 14px;
      border-radius: 6px;
      z-index: 9999;
      font-size: 14px;
    `;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 3000);
  }

  function extractMetadata() {
    try {
      const titleEl = document.querySelector("h1");
      metadata.fullTitle = titleEl?.textContent.trim() || "Unknown Title";

      const diffEl = document.querySelector(".problem-tags span[class*='difficulty']");
      metadata.difficulty = diffEl?.textContent.trim() || "Unknown";

      const contentEl = document.querySelector(".problem-statement");
      if (contentEl) {
        metadata.content = contentEl.innerText.trim();

        const exampleBlocks = contentEl.querySelectorAll("pre");
        metadata.examples = Array.from(exampleBlocks).map((pre, i) => {
          const text = pre.innerText.trim();
          // Attempt to parse Input/Output/Explanation more robustly
          const inputMatch = text.match(/Input:\s*([\s\S]*?)(?=(Output:|Explanation:|^\s*$))/i);
          const outputMatch = text.match(/Output:\s*([\s\S]*?)(?=(Explanation:|^\s*$))/i);
          const explanationMatch = text.match(/Explanation:\s*([\s\S]*)/i);

          const input = inputMatch ? inputMatch[1].trim() : "";
          const output = outputMatch ? outputMatch[1].trim() : "";
          const explanation = explanationMatch ? explanationMatch[1].trim() : text.replace(/Input:.*|Output:.*/gis, "").trim(); // Fallback if no specific explanation tag

          return { exampleNumber: i + 1, input, output, explanation };
        });

        const constraintMatch = contentEl.innerText.match(/Constraints:([\s\S]*)/i);
        if (constraintMatch) {
          metadata.constraints = constraintMatch[1]
            .split(/\n|<br>|<\/?[^>]+>/)
            .map(line => line.trim())
            .filter(Boolean);
        }

        const noteMatch = contentEl.innerText.match(/Note:([\s\S]*?)(?=Examples?:|$)/i);
        if (noteMatch) {
          metadata.notes = noteMatch[1].trim();
        }
      }

      // Extract code from the Ace Editor. This is generally robust.
      const codeLines = Array.from(document.querySelectorAll(".ace_line"))
        .map(line => line.textContent)
        .join("\n");
      metadata.code = codeLines;

      const topicEl = document.querySelectorAll(".problem-tags a");
      metadata.topics = Array.from(topicEl).map(el => el.textContent.trim());

      console.log("✅ GFG Metadata Extracted:", metadata);
      showPopup("✅ GFG Metadata Extracted!", "green");

      const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${metadata.fullTitle.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_")}_metadata.json`;
      a.click();
      URL.revokeObjectURL(a.href); // Clean up the URL object
    } catch (err) {
      console.error("❌ Extraction Error:", err);
      showPopup("❌ GFG Extraction Failed", "red");
    }
  }

  // Use a MutationObserver to detect when the main content of the page has loaded.
  // GFG often loads content dynamically.
  let observer = null;
  function setupContentObserver() {
    observer = new MutationObserver((mutations, obs) => {
      // Check for a reliable indicator that the main problem content is present
      const problemStatement = document.querySelector(".problem-statement");
      const title = document.querySelector("h1");
      const codeEditor = document.querySelector(".ace_editor"); // Check for the code editor

      if (problemStatement && title && codeEditor) {
        obs.disconnect(); // Stop observing once content is found
        console.log("📄 GFG problem content detected.");
        extractMetadata(); // Extract immediately
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Function to handle URL changes in Single Page Application (SPA) style navigation
  function onRouteChangeGFG() {
    let lastUrl = location.href;
    new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log("🔁 URL changed:", currentUrl);
        // If the URL changes to another problem page, re-setup the observer
        if (currentUrl.includes("practice.geeksforgeeks.org/problems")) {
          if (observer) observer.disconnect(); // Disconnect previous observer if active
          setupContentObserver(); // Re-setup for the new page
        }
      }
    }).observe(document, { subtree: true, childList: true });
  }

  // Initial check and setup
  if (location.href.includes("practice.geeksforgeeks.org/problems")) {
    // Attempt to extract immediately in case content is already there
    // This handles direct page loads without dynamic content loading taking too long
    const problemStatement = document.querySelector(".problem-statement");
    const title = document.querySelector("h1");
    const codeEditor = document.querySelector(".ace_editor");

    if (problemStatement && title && codeEditor) {
      console.log("📄 GFG problem content found immediately.");
      extractMetadata();
    } else {
      // If not immediately available, set up observer
      console.log("👀 GFG problem content not found immediately, setting up observer.");
      setupContentObserver();
    }

    // Set up the route change observer for SPA navigation
    onRouteChangeGFG();
  }
})();