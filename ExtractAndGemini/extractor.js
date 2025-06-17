// extractor.js

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
      setTimeout(() => waitForCodeAndExtract(callback), 2000);
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
