const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

// Use environment variable for API key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyA9aCK7axQLp-myR7uYHCTSEIOaqgjxrrc";
if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable not set!");
  process.exit(1);
}

// Initialize the GoogleGenerativeAI client with the API key.
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

/**
 * Sends a prompt to Gemini API and returns the generated text.
 * @param {string} prompt - The text prompt to send
 * @returns {Promise<string>} - Generated content from Gemini
 */
async function postPrompt(prompt) {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error.response) {
      console.error("Gemini API Error Response Data:", error.response.data);
    }
    throw error;
  }
}

/**
 * Shortcut function for compatibility with older code
 */
async function getGeneratedText(prompt) {
  return postPrompt(prompt);
}

module.exports = {
  getGeneratedText,
  postPrompt,
};
