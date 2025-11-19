const mongoose = require("mongoose");

// Define the book schema
const bookSchema = new mongoose.Schema({
  Book_id: Number,
  Book_name: String,
  Author_name: String,
  Price: String, // Assuming price is a number
  Age_group: String,
  Book_type: String,
});

// Create the "Book" model
const Book = mongoose.model("Book", bookSchema);

module.exports = Book;
