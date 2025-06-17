// gemini.js

let GEMINI_API_KEY = "";

function getFormattedGeminiExplanation(code, problemTitle = "Unknown Problem") {
  return new Promise((resolve, reject) => {
    if (!GEMINI_API_KEY) {
      showPopup("⚠️ Gemini API key missing!", "red");
      reject("Missing API key");
      return;
    }

    const prompt = `
Problem: ${problemTitle}

Solution Approach: 

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

    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4 }
        })
      }
    )
      .then(res => res.json())
      .then(data => {
        const aiReply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (aiReply) {
          showPopup("📘 Gemini explanation received!", "green");
          resolve(aiReply);
        } else {
          showPopup("❌ Gemini response error", "red");
          reject("Invalid Gemini response");
        }
      })
      .catch(error => {
        console.error("❌ API Error:", error);
        showPopup("❌ Gemini API call failed", "red");
        reject(error);
      });
  });
}

