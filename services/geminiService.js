const Book = require('../model/Book');

const GEMINI_API_KEY = "AIzaSyCv4QDCNQrd5n0Gtkt_RneMu1ZudjU7kWU";
if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY not set!");
  process.exit(1);
}

// Define the API URL for the Gemini REST endpoint
const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/**
 * Sends a prompt to the Gemini REST API and returns the generated text.
 * @param {string} prompt - The text prompt to send
 * @param {Array<Object>} [bookCollection] - An optional array of book objects with title, author, and description
 * @returns {Promise<string>} - Generated content from Gemini
 */
async function postPrompt(prompt, bookCollection) {

  let combinedPrompt = prompt;

  if (bookCollection && bookCollection.length > 0) {

    const bookDetails = bookCollection
      .map(book => `${book.title} by ${book.authors}`)
      .join('\n');

    combinedPrompt = `You are a helpful and friendly library guide. Your goal is to help readers find books from our library's collection.

You must recommend books ONLY from the "Available books" list provided below. It is a strict rule that you cannot mention, suggest, or invent any book not present in this list.

Here is the reader's request:
"${prompt}"

Here is the complete list of available books in our library:
${bookDetails}

Your task is to:
1. Select up to 5 books from the list that best match the reader's request.
2. For each book you recommend, present its full title.
3. After the title, add a brief, interesting fact or a one-sentence summary about the book to give the reader some online-style context.

If no books from the list match the request, simply respond with: "I'm sorry, but I couldn't find any matching books in our library for your request."`;
  } else {
    console.log("⚠ No book collection was passed. Using raw prompt.\n");
  }

  const requestBody = {
    contents: [{
      parts: [{ text: combinedPrompt }]
    }],
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini Error Response:", errorData);
      throw new Error(`API Error: ${response.status} - ${errorData.error.message}`);
    }

    const jsonResponse = await response.json();

    const generatedText = jsonResponse.candidates[0].content.parts[0].text;

    return generatedText;

  } catch (error) {
    console.error("REST Call Error:", error.message);
    throw error;
  }
}

/**
 * Generates book recommendations for a user prompt by fetching books from the database.
 * @param {string} prompt The user's query for book recommendations.
 * @returns {Promise<string>} The generated recommendations from Gemini.
 */
async function generateBookRecommendations(prompt) {
  try {
    const books = await Book.find({});
    return await postPrompt(prompt, books);

  } catch (error) {
    console.error("Error generating book recommendations:", error);
    throw new Error("Failed to generate book recommendations due to a database or API error.");
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
  generateBookRecommendations,
};
