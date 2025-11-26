const express = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const bodyParser = require("body-parser");
const LocalStrategy = require("passport-local");
const passportLocalMongoose = require("passport-local-mongoose");
const User = require("./model/User");
const Book = require("./model/Book");
const tensorflowService = require("./tensorflowService");
const geminiService = require('./geminiService');
const SampleCollectionBook = require('./model/SampleCollectionBook');

const app = express();

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  require("express-session")({
    secret: "Rusty is a dog",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname + "/public"));
app.use(express.json());


// Add the admin local strategy
passport.use(
  "admin-local",
  new LocalStrategy(function (username, password, done) {
    if (username === "Admin" && password === "12345") {
      return done(null, { username: "Aptech" });
    }
    return done(null, false, { message: "Incorrect admin username or password" });
  })
);
passport.serializeUser(function (user, done) {
  // Here, you might want to serialize user data if needed (e.g., user.id)
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  // Implement deserialization logic here if needed
  done(null, user);
});


// Showing home page
app.get("/", function (req, res) {
  res.render("home");
});


// Showing register form
app.get("/register", function (req, res) {
  res.render("register");
});

// Handling user signup
app.post("/register", async (req, res) => {
  const user = await User.create({
    username: req.body.username,
    password: req.body.password,
  });

  //return res.status(200).json(user);
  res.redirect("/");
});

// Showing login form
app.get("/login", function (req, res) {
  res.render("login");
});

// Handling user login
// Handling user login
app.post("/login", async function (req, res) {
  try {
    // check if the user exists
    const user = await User.findOne({ username: req.body.username });
    if (user) {
      // check if password matches
      const result = req.body.password === user.password;
      if (result) {
        const books = await Book.find({});
        res.render("booklist", { books: books });
      } else {
        res.render("error", { errorMessage: "Password doesn't match" });
      }
    } else {
      res.render("error", { errorMessage: "User doesn't exist" });
    }
  } catch (error) {
    res.render("error", { errorMessage: "An error occurred" });
  }
});

// Admin login route
app.get("/admin", function (req, res) {
  res.render("admin-login");
});

// Admin login form
app.post(
  "/admin-login",
  passport.authenticate("admin-local", {
    successRedirect: "/admin-dashboard",
    failureRedirect: "/admin-error",
  })
);
// Admin error route
app.get("/admin-error", function (req, res) {
  res.render("admin-error", { errorMessage: "Incorrect admin username or password" });
});

// Admin dashboard route
app.get("/admin-dashboard", function (req, res) {
  if (req.isAuthenticated()) {
    res.render("admin-dashboard");
  } else {
    res.redirect("/admin");
  }
});

app.post("/admin-dashboard/add-book", function (req, res) {
  if (req.isAuthenticated()) {
    // Get book details from the form
    const bookDetails = {
      Book_id: req.body.Book_id,
      Book_name: req.body.Book_name,
      Author_name: req.body.Author_name,
      Price: req.body.Price,
      Age_group: req.body.Age_group,
      Book_type: req.body.Book_type,
    };

    // Create a new book in the "books" collection
    Book.create(bookDetails)
      .then((newBook) => {
        console.log("Book added successfully:", newBook);
        res.redirect("/admin-dashboard"); 
      })
      .catch((err) => {
        console.error("Failed to add the book:", err);
        res.status(500).json({ error: "Failed to add the book" });
      });
  } else {
    res.redirect("/admin");
  }
});


// === ROUTES FOR TENSORFLOW.JS CHAT ===

// 1. Route to render the TensorFlow.js chat page
app.get('/tensorflow-chat', (req, res) => {
    // Just render the chat page. The history will be handled by client-side JavaScript.
    res.render('tensorflowChat'); // Renders views/tensorflowChat.ejs
});

// 2. Route to handle the TensorFlow.js chat POST request (as an API endpoint)
app.post('/tensorflow-chat', async (req, res) => {
    try {
        const { prompt } = req.body; // Expecting JSON: { "prompt": "..." }
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Get recommendations using the TensorFlow.js service
        const recommendations = await tensorflowService.getRecommendations(prompt);

        // Create a conversational response
        let responseMessage;
        if (recommendations.length > 0) {
            const bookTitles = recommendations.map(book => `"${book.title}" by ${book.authors}`).join(', ');
            responseMessage = `Based on your query, I recommend: ${bookTitles}.`;
        } else {
            responseMessage = `I couldn't find any specific book recommendations for "${prompt}" in our library. Please try a different query.`;
        }

        // Send the response back as JSON to the client-side script
        res.json({
            response: responseMessage,
            books: recommendations
        });

    } catch (error) {
        console.error('Error in /tensorflow-chat API route:', error);
        res.status(500).json({ error: 'Failed to get response from TensorFlow.js service' });
    }
});


// 1. Route to render the chat page
app.get('/gemini-chat', (req, res) => {
    res.render('geminiChat'); // Renders views/geminiChat.ejs
});

// 2. Route to handle the chat POST request
// 2. Route to handle the chat POST request
app.post('/gemini-chat', async (req, res) => {
    try {
        const { prompt } = req.body;
        // console.log('Server received prompt:', prompt); // Add this line to check what the server gets
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // === New Approach: Direct chat with Gemini ===
        // Send the user's prompt directly to the Gemini service for a general response.
        const geminiResponse = await geminiService.postPrompt(prompt);
        res.json({ response: geminiResponse });

    } catch (error) {
        console.error('Error in /gemini-chat route:', error);
        res.status(500).json({ error: 'Failed to get response from Gemini' });
    }
});


// Handling user logout
app.get("/logout", function (req, res) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}

const port = process.env.PORT || 3000;
async function startServer() {
    try {
        // 1. Connect to MongoDB (Must be awaited)
        await mongoose.connect("mongodb+srv://lindalarrissa91:linda91@cluster0.gktucwf.mongodb.net/Library?retryWrites=true&w=majority");
        console.log("MongoDB connected successfully.");
        
        // 2. Start the Express server immediately.
        // This ensures the port is open and deployment platforms won't time out.
        app.listen(port, '0.0.0.0', () => {
            console.log(`Server Has Started on port ${port}!`);
        }).on('error', (err) => {
            console.error("Express server failed to start:", err);
            process.exit(1);
        });

        // 3. Initialize the TensorFlow.js Service in the BACKGROUND.
        console.log("Starting TensorFlow.js Service Initialization in the background...");
        tensorflowService.init().catch(err => {
            console.error("Background TensorFlow.js Service Initialization Failed:", err);
        });

    } catch (error) {
        console.error("Failed to start the server (MongoDB connection failed):", error);
        process.exit(1);
    }
}

startServer();
