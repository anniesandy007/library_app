// server.js
const express = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const bodyParser = require("body-parser");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const MongoStore = require("connect-mongo");
const User = require("./model/User");
const Book = require("./model/Book");
const recommendationService = require("./recommendationService");
const SampleCollectionBook = require("./model/SampleCollectionBook");

const app = express();

// --- Express Setup ---
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public"));

// --- Session Store ---
app.use(
    session({
        secret: process.env.SESSION_SECRET || "Rusty is a dog",
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URI,
            collectionName: "sessions",
        }),
        cookie: { secure: false }, // change to true if using HTTPS
    })
);

// --- Passport Setup ---
app.use(passport.initialize());
app.use(passport.session());

// --- Admin Local Strategy ---
passport.use(
    "admin-local",
    new LocalStrategy((username, password, done) => {
        if (username === "Admin" && password === "12345") {
            return done(null, { username: "Admin" });
        }
        return done(null, false, { message: "Incorrect admin username or password" });
    })
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// --- Routes ---

// Home
app.get("/", (req, res) => res.render("home"));

// Register
app.get("/register", (req, res) => res.render("register"));
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

// Login
app.get("/login", (req, res) => res.render("login"));
app.post("/login", async (req, res) => {
    try {
        const user = await User.findOne({ username: req.body.username });
        if (user && req.body.password === user.password) {
            const books = await Book.find({});
            res.render("booklist", { books });
        } else {
            res.render("error", { errorMessage: "Invalid username or password." });
        }
    } catch (error) {
        console.error("Login error:", error);
        res.render("error", { errorMessage: "An error occurred during login." });
    }
});

// Admin login
app.get("/admin", (req, res) => res.render("admin-login"));
app.post(
    "/admin-login",
    passport.authenticate("admin-local", {
        successRedirect: "/admin-dashboard",
        failureRedirect: "/admin-error",
    })
);

app.get("/admin-error", (req, res) =>
    res.render("admin-error", { errorMessage: "Incorrect admin username or password" })
);

app.get("/admin-dashboard", (req, res) => {
    if (req.isAuthenticated()) return res.render("admin-dashboard");
    res.redirect("/admin");
});

// Add book
app.post("/admin-dashboard/add-book", async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect("/admin");

    try {
        const bookDetails = {
            Book_id: req.body.Book_id,
            Book_name: req.body.Book_name,
            Author_name: req.body.Author_name,
            Price: req.body.Price,
            Age_group: req.body.Age_group,
            Book_type: req.body.Book_type,
        };
        await Book.create(bookDetails);
        res.redirect("/admin-dashboard");
    } catch (error) {
        console.error("Failed to add book:", error);
        res.render("error", { errorMessage: "Failed to add the book." });
    }
});

// Recommendation
app.get("/recommend", (req, res) => res.render("recommend", { books: [] }));
app.post("/recommend", async (req, res) => {
    try {
        const recommendations = await recommendationService.getRecommendations(req.body.prompt);
        res.render("recommend", { books: recommendations });
    } catch (error) {
        console.error("Recommendation error:", error);
        res.render("error", { errorMessage: "Failed to generate recommendations." });
    }
});

// Chat (similar to recommendation)
app.post("/chat", async (req, res) => {
    try {
        const recommendations = await recommendationService.getRecommendations(req.body.prompt);
        res.render("chat", { books: recommendations, prompt: req.body.prompt });
    } catch (error) {
        console.error("Chat recommendation error:", error);
        res.render("error", { errorMessage: "Failed to generate chat recommendations." });
    }
});

// Logout
app.get("/logout", (req, res, next) => {
    req.logout(err => {
        if (err) return next(err);
        res.redirect("/");
    });
});

// Middleware to protect routes
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect("/login");
}

// --- Server Startup ---
const port = process.env.PORT || 3000;

async function startServer() {
    try {
        // Connect to MongoDB first
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("MongoDB connected successfully.");

        // Start Express server immediately
        app.listen(port, "0.0.0.0", () => {
            console.log(`Server is running on port ${port}`);
        });

        // Initialize Recommendation Service asynchronously
        recommendationService.init()
            .then(() => console.log("Recommendation Service initialized."))
            .catch(err => console.error("Failed to initialize recommendation service:", err));

    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

startServer();
