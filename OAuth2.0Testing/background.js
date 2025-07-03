// background.js

// --- GitHub OAuth Constants (if applicable, but likely defined in popup.js) ---
// const CLIENT_ID_GH = "Ov23li5yyflTNfRcNjhc"; // Usually not needed in background unless handling direct redirects

// --- Message Listener for all communication from popup and content scripts ---
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    // IMPORTANT: Make sure this listener callback itself is 'async'
    // This is crucial for using 'await' inside its blocks.

    if (message.type === "EXCHANGE_CODE") {
        const { code, state } = message;
        console.log("Background: Received EXCHANGE_CODE", code);
        try {
            // Your backend server's URL, ensure it matches your setup
            const backendUrl = `http://localhost:4000/exchange-code`;

            const response = await fetch(backendUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, state })
            });
            const data = await response.json();

            if (data.access_token) {
                await browser.storage.local.set({ github_token: data.access_token });
                sendResponse({ status: "success", access_token: data.access_token });
            } else {
                sendResponse({ status: "error", message: data.error || "Failed to get access token" });
            }
        } catch (err) {
            console.error("Background: Error exchanging code:", err);
            sendResponse({ status: "error", message: `Communication error with backend: ${err.message}` });
        }
        return true; // Keep the message channel open for async response
    }

    else if (message.type === "LIST_REPOS") {
        const { token } = message;
        try {
            const response = await fetch("https://api.github.com/user/repos?per_page=100", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const repos = await response.json();

            if (response.ok) {
                sendResponse({ status: "success", repos: repos });
            } else {
                const errorMessage = repos.message || "Failed to fetch repositories.";
                console.error("Background: GitHub API error (LIST_REPOS):", errorMessage, repos);
                sendResponse({ status: "error", message: errorMessage, details: repos });
            }
        } catch (err) {
            console.error("Background: Error listing repos:", err);
            sendResponse({ status: "error", message: `Network error: ${err.message}` });
        }
        return true;
    }

    else if (message.type === "FETCH_REPO_DETAILS") {
        const { token, repoFullName } = message;
        try {
            const response = await fetch(`https://api.github.com/repos/${repoFullName}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const repoDetails = await response.json();

            if (response.ok) {
                sendResponse({ status: "success", repo: repoDetails });
            } else {
                const errorMessage = repoDetails.message || "Failed to fetch repository details.";
                console.error("Background: GitHub API error (FETCH_REPO_DETAILS):", errorMessage, repoDetails);
                sendResponse({ status: "error", message: errorMessage, details: repoDetails });
            }
        } catch (err) {
            console.error("Background: Error fetching repo details:", err);
            sendResponse({ status: "error", message: `Network error: ${err.message}` });
        }
        return true;
    }

    else if (message.type === "CREATE_FOLDER") {
        const { token, repoFullName, folderPath } = message;
        const [owner, repoName] = repoFullName.split("/");
        const content = btoa(' '); // Base64 encode a space for .gitkeep

        try {
            const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${folderPath}`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: `feat: add ${folderPath} (via extension)`,
                    content: content,
                    committer: {
                        name: "Extension User", // Replace with actual user info if desired
                        email: "extension@example.com"
                    }
                })
            });

            const result = await response.json();

            if (response.ok) {
                sendResponse({ status: "success", details: result });
            } else {
                let errorMessage = result.message || "Failed to create folder.";
                if (response.status === 409) {
                    errorMessage = `Folder/file '${folderPath}' already exists.`;
                }
                console.error("Background: GitHub API error (CREATE_FOLDER):", errorMessage, result);
                sendResponse({ status: "error", message: errorMessage, details: result });
            }
        } catch (err) {
            console.error("Background: Error creating folder:", err);
            sendResponse({ status: "error", message: `Network error: ${err.message}` });
        }
        return true;
    }

    // --- Handling Gemini explanation request from content scripts ---
    // background.js (FOCUSED on GET_GEMINI_EXPLANATION block)

// ... (Existing message listeners for GitHub operations) ...

// --- Handling Gemini explanation request from content scripts ---
else if (message.type === "GET_GEMINI_EXPLANATION") {
    const { submittedCode, fullTitle } = message;
    console.log("Background: Received GET_GEMINI_EXPLANATION message.");
    console.log("Background: Problem Title:", fullTitle);
    // console.log("Background: Submitted Code (first 100 chars):", submittedCode.substring(0, 100)); // Log part of code for debugging

    try {
        const result = await browser.storage.local.get("gemini_ai_api_key");
        const GEMINI_API_KEY = result.gemini_ai_api_key;

        if (!GEMINI_API_KEY) {
            console.error("Background ERROR: Gemini API key not found in storage.");
            sendResponse({ status: "error", message: "Gemini API key not set in extension storage." });
            return true;
        }
        console.log("Background: Gemini API key successfully retrieved (first 5 chars):", GEMINI_API_KEY.substring(0,5) + "...");

        const prompt = `
Problem: ${fullTitle}

Solution Approach:

Logic Explanation based on code:
${submittedCode}

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
        console.log("Background: Sending request to Gemini API...");

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

        // --- IMPORTANT: Check if the HTTP response itself was successful ---
        if (!response.ok) {
            let errorText = await response.text(); // Get the raw error text from API
            console.error(`Background ERROR: Gemini API HTTP error! Status: ${response.status}, Status Text: ${response.statusText}, Response Body:`, errorText);
            sendResponse({
                status: "error",
                message: `Gemini API HTTP error (${response.status}): ${response.statusText}`,
                details: errorText
            });
            return true;
        }

        const data = await response.json();
        console.log("Background: Raw Gemini API response data:", data);

        const aiReply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (aiReply) {
            console.log("Background: Gemini explanation found in response.");
            sendResponse({ status: "success", explanation: aiReply });
        } else {
            console.error("Background ERROR: Gemini response structure missing 'candidates' or 'text'. Full data:", data);
            let errorMessage = "Invalid Gemini response structure.";
            if (data.error && data.error.message) {
                errorMessage = `Gemini API error: ${data.error.message}`;
            } else if (data.candidates && data.candidates.length === 0) {
                 errorMessage = "Gemini returned no candidates (possible safety block or content error).";
            }
            sendResponse({ status: "error", message: errorMessage, details: data });
        }
    } catch (error) {
        console.error("Background ERROR: Exception during Gemini API call:", error);
        sendResponse({ status: "error", message: `Exception during Gemini API call: ${error.message || error}`, details: error });
    }
    return true; // Keep the message channel open for the async response
}

// ... (Rest of your background.js file, including the IIFE) ...

    // Default case if message type is not recognized
    // sendResponse({ status: "error", message: "Unknown message type." });
    // return false; // Or just don't return true if no async response is expected
});

// If you had any top-level `await` operations that needed to run on background script start,
// you would put them inside an async IIFE like this:
(async () => {
    try {
        // Example: If you wanted to log something from storage immediately on startup
        const tokenCheck = await browser.storage.local.get("github_token");
        console.log("Background script initialized. GitHub token exists:", !!tokenCheck.github_token);

        // You might also use this for initial setup or listening for other events
        // that require async operations at startup.
    } catch (error) {
        console.error("Background script initialisation error:", error);
    }
})();