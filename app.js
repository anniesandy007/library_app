const express = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const bodyParser = require("body-parser");
const LocalStrategy = require("passport-local");
const passportLocalMongoose = require("passport-local-mongoose");
const User = require("./model/User"); // Assuming User model exists
const Book = require("./model/Book"); // Assuming Book model exists
const recommendationService = require("./recommendationService");
const tensorflowService = require("./tensorflowService"); // Import the new TensorFlow.js service
const geminiService = require('./geminiService');

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
app.use(express.json()); // Middleware to parse JSON bodies
app.use(express.static(__dirname + "/public")); // Assuming a public directory exists

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
    done(null, user);
});

passport.deserializeUser(function (user, done) {
    done(null, user);
});

// Showing home page
app.get("/", function (req, res) {
    res.render("home"); // Assuming a home.ejs view exists
});

// Showing register form
app.get("/register", function (req, res) {
    res.render("register"); // Assuming a register.ejs view exists
});

// Handling user signup
app.post("/register", async (req, res) => {
    try {
        const user = await User.create({
            username: req.body.username,
            password: req.body.password,
        });
        res.redirect("/");
    } catch (error) {
        console.error("Registration error:", error);
        res.render("error", { errorMessage: "Registration failed." });
    }
});

// Showing login form
app.get("/login", function(req, res) {
    res.render("login"); // Assuming a login.ejs view exists
});

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
                res.render("booklist", { books: books }); // Assuming a booklist.ejs view exists
            } else {
                res.render("error", { errorMessage: "Password doesn't match" }); // Assuming an error.ejs view exists
            }
        } else {
            res.render("error", { errorMessage: "User doesn't exist" });
        }
    } catch (error) {
        res.render("error", { errorMessage: "An error occurred during login" });
    }
});

// Admin login route
app.get("/admin", function(req, res) {
    res.render("admin-login"); // Assuming an admin-login.ejs view exists
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
        res.render("admin-dashboard"); // Assuming an admin-dashboard.ejs view exists
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
                res.status(500).render("error", { errorMessage: "Failed to add the book to the database." });
            });
    } else {
        res.redirect("/admin");
    }
});

// Show the recommendation search page
app.get("/recommend", function (req, res) {
    res.render("recommend", { books: [] }); // Assuming a recommend.ejs view exists
});

// Handle the recommendation logic
app.post("/recommend", async function (req, res) {
    try {
        const userPrompt = req.body.prompt;
        // Get recommendations using the new service
        const recommendations = await recommendationService.getRecommendations(userPrompt);
        // Render the results
        res.render("recommend", { books: recommendations });
    } catch (error) {
        console.error("Recommendation error:", error);
        res.status(500).render("error", { errorMessage: "An error occurred while generating recommendations." });
    }
});

// Handle the chat prompt submission (assuming this refers to a chat/recommendation page)
app.post("/chat", async function (req, res) {
    try {
        const userPrompt = req.body.prompt;
        // Get recommendations using the recommendation service
        const recommendations = await recommendationService.getRecommendations(userPrompt);
        // Render the results on the same chat page
        res.render("chat", { books: recommendations, prompt: userPrompt }); // Assuming a chat.ejs view exists
    } catch (error) {
        console.error("Chat recommendation error:", error);
        res.status(500).render("error", { errorMessage: "An error occurred while generating recommendations." });
    }
});

// === ROUTES FOR GEMINI CHAT ===

// 1. Route to render the chat page
app.get('/gemini-chat', (req, res) => {
    res.render('geminiChat'); // Renders views/geminiChat.ejs
});

// 2. Route to handle the chat POST request
app.post('/gemini-chat', async (req, res) => {
    try {
        const { prompt } = req.body;
        // console.log('Server received prompt:', prompt); // Add this line to check what the server gets
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Step 1: Get a shortlist of relevant books from your database
        const bookRecommendations = await recommendationService.getRecommendations(prompt);
        const topBooks = bookRecommendations.slice(0, 5); // Let's use the top 5

        // Step 2: Create an enhanced prompt for Gemini with context from your library
        let enhancedPrompt;
        if (topBooks.length > 0) {
            const bookListForPrompt = topBooks.map(book => `- "${book.title}" by ${book.authors}`).join('\n');
            enhancedPrompt = `You are a helpful librarian for a local library. Your primary role is to assist users in finding books from our collection. A user is asking for book recommendations related to: "${prompt}".

Based on a search of the library's catalog, here are some relevant books available:
${bookListForPrompt}

Please provide a friendly, conversational response. Recommend one or two of these specific books and briefly explain why they are a good match for the user's request. Do not suggest any books that are not on this list. If the user asks a question unrelated to book recommendations from our catalog, politely state that you can only assist with finding books.`;
        } else {
            enhancedPrompt = `You are a helpful librarian for a local library. Your primary role is to assist users in finding books from our collection. A user is asking for book recommendations related to: "${prompt}".

Unfortunately, a search of the library's catalog did not return any specific matches for "${prompt}". Please provide a friendly, conversational response informing the user about this. Politely suggest they try a different search term or ask about another type of book. Do not discuss general topics or answer questions unrelated to our library's collection.`;
        }

        // Step 3: Get a smart, conversational response from Gemini
        const geminiResponse = await geminiService.postPrompt(enhancedPrompt);
        res.json({ response: geminiResponse });

    } catch (error) {
        console.error('Error in /gemini-chat route:', error);
        res.status(500).json({ error: 'Failed to get response from Gemini' });
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

const port = process.env.PORT || 4000;

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

        // 3. Initialize the Recommendation Service in the BACKGROUND (no 'await').
        // The service logic must handle requests gracefully while this runs (by checking if embeddings are ready).
        console.log("Starting Recommendation Service Initialization in the background...");
        recommendationService.init().catch(err => {
            console.error("Background Recommendation Service Initialization Failed:", err);
            // Non-fatal, the app can still serve non-recommendation routes
        });

        // 4. Initialize the TensorFlow.js Service in the BACKGROUND.
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
