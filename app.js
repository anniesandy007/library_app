const express = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const bodyParser = require("body-parser");
const LocalStrategy = require("passport-local");
const passportLocalMongoose = require("passport-local-mongoose");
const User = require("./model/User"); // Assuming User model exists
const Book = require("./model/Book"); // Assuming Book model exists
const recommendationService = require("./recommendationService");
const SampleCollectionBook = require("./model/SampleCollectionBook"); // Assuming SampleCollectionBook model exists

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
app.get("/login", function (req, res) {
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
app.get("/admin", function (req, res) {
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
    res.render("admin-error", { errorMessage: "Incorrect admin username or password" }); // Assuming an admin-error.ejs view exists
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
        // 1. Connect to MongoDB
        await mongoose.connect("mongodb+srv://lindalarrissa91:linda91@cluster0.gktucwf.mongodb.net/Library?retryWrites=true&w=majority");
        console.log("MongoDB connected successfully.");
        
        // 2. Initialize the Recommendation Service
        await recommendationService.init();

        // 3. Start the Express server
        // CRUCIAL FIX: Explicitly binding to '0.0.0.0' is required for containerized environments like Render.
        app.listen(port, '0.0.0.0', () => {
            console.log(`Server Has Started on port ${port}!`);
        }).on('error', (err) => {
            // Log any errors if the server fails to start (e.g., port already in use)
            console.error("Express server failed to start:", err);
            process.exit(1);
        });

    } catch (error) {
        console.error("Failed to start the server:", error);
        // Exit the process if initialization fails
        process.exit(1);
    }
}

startServer();
