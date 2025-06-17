(function () {
  let extractedData = {
    fullTitle: "Unknown Title",
    difficulty: "Unknown",
    content: "",
    notes: "",
    examples: [],
    constraints: [],
    code: "",
    topics: []
  };

  // --- Utility: Safe Text Extraction ---
  const getText = (el) => el?.textContent?.trim() || "";

  // --- Extract Title Safely ---
  const extractTitle = () => {
    const h1s = document.querySelectorAll("h1");
    for (let el of h1s) {
      const text = el.textContent.trim();
      if (text.length > 5) return text;
    }
    return "Unknown Title";
  };

  // --- Extract Metadata ---
  const extractMetadata = () => {
    extractedData.fullTitle = extractTitle();

    const difficultyEl = document.querySelector("[class*=difficulty]");
    if (difficultyEl) {
      extractedData.difficulty = getText(difficultyEl);
    }

    const contentEl = document.querySelector(".problems_problem_content__Xm_eO");
    if (contentEl) {
      const html = contentEl.innerHTML;

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      extractedData.content = doc.body.textContent.trim();

      // Extract Examples
      const preTags = Array.from(doc.querySelectorAll("pre"));
      extractedData.examples = preTags.map((pre, idx) => {
        const text = pre.textContent;
        const inputMatch = text.match(/Input:\s*(.*)/);
        const outputMatch = text.match(/Output:\s*(.*)/);
        const explanationMatch = text.match(/Explanation:\s*(.*)/);
        return {
          exampleNumber: idx + 1,
          input: inputMatch ? inputMatch[1].trim() : "",
          output: outputMatch ? outputMatch[1].trim() : "",
          explanation: explanationMatch ? explanationMatch[1].trim() : ""
        };
      });

      // Extract Notes
      const noteMatch = html.match(/Note:\s*(.*?)<\/p>/i);
      if (noteMatch) {
        extractedData.notes = noteMatch[1].replace(/<[^>]*>/g, "").trim();
      }

      // Extract Constraints
      const constraintsMatch = html.match(/Constraints:(.*?)<\/p>/is);
      if (constraintsMatch) {
        const constraintsText = constraintsMatch[1].replace(/<[^>]*>/g, "").trim();
        extractedData.constraints = constraintsText.split(/\n|<br\s*\/?>/).map(c => c.trim()).filter(Boolean);
      }
    }
  };

  // --- Extract Code from ACE Editor ---
  const extractCode = () => {
    const lines = document.querySelectorAll(".ace_text-layer .ace_line");
    const codeLines = Array.from(lines).map(line => line.textContent);
    extractedData.code = codeLines.join("\n").trim();
  };

  // --- Download JSON ---
  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(extractedData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${extractedData.fullTitle.replace(/[^\w\d]+/g, "_")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // --- Observe DOM to Detect "Problem Solved Successfully" ---
  const watchForSuccess = () => {
    const target = document.body;
    const observer = new MutationObserver(() => {
      const successTag = document.querySelector(".problems_problem_solved_successfully__Zb4yG");
      if (successTag) {
        extractCode();
        downloadJSON();
        observer.disconnect();
      }
    });

    observer.observe(target, { childList: true, subtree: true });
  };

  // --- INIT ---
  const init = () => {
    extractMetadata();
    watchForSuccess();
  };

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
