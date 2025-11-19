const mongoose = require("mongoose");

// Define the schema for the new book collection
const sampleBookSchema = new mongoose.Schema({
  bookID: Number,
  title: String,
  authors: String,
  average_rating: Number,
  isbn: String,
  isbn13: String,
  language_code: String,
  num_pages: Number,
  ratings_count: Number,
  text_reviews_count: Number,
  publication_date: String,
  publisher: String,
  FIELD13: String,
});

// Create the model for the "SampleCollectionBooks" collection
// The third argument explicitly sets the collection name
const SampleCollectionBook = mongoose.model("SampleCollectionBook", sampleBookSchema, "samplecollectionbooks");

module.exports = SampleCollectionBook;