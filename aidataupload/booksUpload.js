const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

// Schema without strict validation
const bookForAiSchema = new mongoose.Schema({
  bookID: mongoose.Schema.Types.Mixed,
  title: String,
  authors: String,
  average_rating: mongoose.Schema.Types.Mixed,
  ratings_count: mongoose.Schema.Types.Mixed,
  text_reviews_count: mongoose.Schema.Types.Mixed,
  publication_date: String,
  publisher: String,
});

const BookForAi = mongoose.model("BookForAi", bookForAiSchema, "booksforai");

const uri = "mongodb+srv://lindalarrissa91:linda91@cluster0.gktucwf.mongodb.net/Library?retryWrites=true&w=majority";

const filePath = path.join(__dirname, "book.json");

mongoose.connect(uri)
  .then(async () => {
    console.log("Connected to MongoDB");

    const data = fs.readFileSync(filePath, "utf-8");
    const booksData = JSON.parse(data);

    console.log(`Read ${booksData.length} books from JSON file`);

    const chunkSize = 1000;

    for (let i = 0; i < booksData.length; i += chunkSize) {
      const chunk = booksData.slice(i, i + chunkSize);

      const validDocs = [];
      for (const book of chunk) {
        try {
          validDocs.push(new BookForAi(book));
        } catch (err) {
        }
      }

      if (validDocs.length > 0) {
        await BookForAi.insertMany(validDocs, { ordered: false });
      }

      console.log(`Inserted records ${i + 1} to ${i + chunk.length}`);
    }

    console.log("All books processed successfully!");
    mongoose.connection.close();
  })
  .catch(err => {
    console.error("Error:", err);
  });
