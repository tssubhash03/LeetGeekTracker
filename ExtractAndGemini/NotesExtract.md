Let's trace the journey of your "LeetCode + GFG Extractor" Firefox extension from the moment a user installs it to the point where they successfully download problem data and an AI explanation.

**1. The Starting Point: Extension Installation and Initial Setup**

* **User Action:** A user discovers your "LeetCode + GFG Extractor" extension and installs it from the Firefox Add-ons store (or loads it as a temporary add-on for development).
* **`manifest.json`'s Role:** Firefox reads your `manifest.json`.
    * It understands the extension's name, version, and description.
    * It knows it needs `storage` permission to save data (like the Gemini API key) and permission to make requests to `generativelanguage.googleapis.com`.
    * It registers the `browser_action`, meaning a small icon will appear in the user's browser toolbar, and clicking it will open `popup.html`.
* **Initial API Key Setup:** The user, at some point, clicks on the extension's icon in the toolbar, opening `popup.html`. (While `popup.html`'s content isn't provided, this is the typical place where users would enter and save their Gemini API key, which then gets stored using `browser.storage.local`).

**2. User Navigates to a LeetCode Problem Page**

* **Triggering Content Scripts:** The user opens a new tab or navigates to a URL matching `https://leetcode.com/problems/*`.
* **Injection:** Because of the `content_scripts` definition in `manifest.json`, Firefox injects your `extractor.js`, `gemini.js`, and `leetcodeScript.js` files directly into that LeetCode page's environment. The `run_at: "document_idle"` ensures these scripts wait until the page's HTML, CSS, and JavaScript have largely settled.
* **Initial `leetcodeScript.js` Execution:**
    * `leetcodeScript.js` immediately tries to fetch the `GEMINI_API_KEY` from the browser's local storage (`browser.storage.local.get`).
    * If the key isn't found, a "⚠️ Set Gemini API key in extension popup!" warning pops up on the LeetCode page.
    * Regardless of the key's presence, it then calls `runExtractor()`.

**3. Waiting for an "Accepted" Submission**

* **`runExtractor()`'s First Step:** `runExtractor()` sets the `alreadyExtracted` flag to `false` (in case of a URL change) and then calls `waitForAcceptedSubmission()`.
* **The Watcher (`waitForAcceptedSubmission` in `extractor.js`):** This is where the core monitoring begins. A `MutationObserver` is set up to continuously watch the entire `document.body` of the LeetCode page for any changes (additions, removals, or modifications of elements).
* **User Solves the Problem:** The user writes their code in the LeetCode editor and clicks "Submit".
* **Monitoring Submission Status:** The `MutationObserver` constantly checks for the presence and text content of a specific HTML element: `span[data-e2e-locator="submission-result"]`. It's looking for that element's `innerText` to become "Accepted".
* **"Accepted" Detected:** Once the user's code passes all test cases and LeetCode displays "Accepted", the `MutationObserver` triggers.
    * It immediately sets `alreadyExtracted = true` to prevent re-triggering for the same submission.
    * It disconnects itself (no need to watch anymore for *this* submission).
    * It then calls `setTimeout(() => waitForCodeAndExtract(callback), 2000);` to give the page a moment to fully render the accepted code.

**4. Extracting Data and Requesting AI Explanation**

* **Code Readiness Check (`waitForCodeAndExtract` in `leetcodeScript.js`):** After the short delay, `waitForCodeAndExtract()` is called. It checks for the `div.view-lines` element, which contains the user's submitted code. It has a retry mechanism (up to 10 times) with a 500ms delay, in case the code editor takes a moment to load.
* **Core Data Extraction (`extractProblemInfo` in `extractor.js`):** Once the code is confirmed to be present, `extractProblemInfo()` springs into action:
    * It calls `extractTitleAndNumber()` to get the problem's full title, number, and name.
    * It calls `extractProblemDescription()` to get the main problem statement.
    * It calls `extractCode()` to grab the user's accepted code from the editor.
    * It calls `extractDifficulty()` to determine if it's Easy, Medium, or Hard.
    * It calls `extractTopics()` to list related concepts.
    * It calls `extractConstraints()` to find any input/output constraints or follow-up questions.
    * It calls `extractExamples()` to parse the input/output examples.
    * It calls `extractComplexity()` to find the displayed time and space complexity.
    * All this gathered information is assembled into a single JavaScript object (`data`).
    * A "✅ Problem data extracted successfully!" popup appears.
* **Gemini AI Interaction (`getFormattedGeminiExplanation` in `gemini.js`):**
    * `leetcodeScript.js` then checks if a `GEMINI_API_KEY` is available.
    * If yes, it calls `getFormattedGeminiExplanation()`, passing the extracted `submittedCode` and `fullTitle`.
    * Inside `gemini.js`, a detailed prompt is constructed, guiding the Gemini model on what kind of explanation is expected (Problem, Solution Approach, Logic, Complexity Analysis).
    * A `fetch` request (a network call) is made to the Gemini API endpoint.
    * The extension waits for the Gemini API's response.
    * Upon receiving the response, `gemini.js` parses it, extracts the AI's explanation, and resolves its promise.
    * A "📘 Gemini explanation received!" popup appears. If there's an error with the API call or response, a "❌ Gemini response error/API call failed" popup appears, and the promise is rejected.
* **Integrating AI Response:** The AI explanation (or an error message if the API call failed) is added to the `data` object.

**5. The Ending Point: Downloading the Data**

* **Filename Preparation:** `leetcodeScript.js` takes the `fullTitle` and sanitizes it (removes special characters, replaces spaces with underscores) to create a safe filename for the JSON.
* **File Download (`downloadJSON` in `extractor.js`):**
    * The complete `data` object (including problem metadata and AI explanation) is converted into a beautifully formatted JSON string (`JSON.stringify(data, null, 2)`).
    * This string is then wrapped in a `Blob` (a binary large object).
    * A temporary URL is created for this `Blob` using `URL.createObjectURL()`.
    * An invisible `<a>` (anchor) element is dynamically created in the document.
    * Its `href` attribute is set to the temporary URL, and its `download` attribute is set to the prepared filename (e.g., `gfg_metadata_Two_Sum.json`).
    * The `click()` method is programmatically called on this `<a>` element, simulating a user clicking a download link. This triggers the browser's download prompt (or automatically downloads the file to the user's default download directory).
    * The temporary `<a>` element is removed from the DOM, and the temporary URL is revoked (`URL.revokeObjectURL()`) to free up memory.

**6. Handling Page Navigation (SPA Support)**

* **The URL Change Observer (`leetcodeScript.js`):** While the user is still on LeetCode, if they navigate to another problem using internal LeetCode links (which doesn't always trigger a full page reload, common in Single Page Applications like LeetCode):
    * The `MutationObserver` (watching the entire `document`) detects the change in `location.href`.
    * If the URL has indeed changed, `lastUrl` is updated, `alreadyExtracted` is reset to `false`, and `setTimeout(runExtractor, 1000)` is called again. This effectively restarts the entire waiting-for-submission and extraction process for the *new* problem.

This entire sequence ensures that your extension intelligently waits for the right moment (an accepted submission), gathers all relevant data, optionally enhances it with AI, and then provides a convenient download to the user, even across in-page navigations.