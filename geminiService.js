require("dotenv").config();

// Use environment variable for API key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCfyYHLXi68ZjlhrqE7vBEbqvaEoUyPTwQ";
if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable not set!");
  process.exit(1);
}

// Define the API URL for the Gemini REST endpoint
const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/**
 * Sends a prompt to the Gemini REST API and returns the generated text.
 * @param {string} prompt - The text prompt to send
 * @returns {Promise<string>} - Generated content from Gemini
 */
async function postPrompt(prompt) {
  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The API key is passed in a specific header for REST calls
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      // Handle API errors (e.g., bad request, invalid key, rate limit)
      const errorData = await response.json();
      throw new Error(`API Error: ${response.status} - ${errorData.error.message}`);
    }

    const jsonResponse = await response.json();

    // Manually navigate the nested JSON structure to find the text
    const generatedText = jsonResponse.candidates[0].content.parts[0].text;
    return generatedText;

  } catch (error) {
    console.error("REST Call Error:", error.message);
    throw error;
  }
}

/**
 * Shortcut function for backward compatibility.
 */
async function getGeneratedText(prompt) {
  return postPrompt(prompt);
}

module.exports = {
  getGeneratedText,
  postPrompt,
};
