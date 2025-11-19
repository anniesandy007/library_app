const express = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const bodyParser = require("body-parser");
const LocalStrategy = require("passport-local");
const passportLocalMongoose = require("passport-local-mongoose");
const User = require("./model/User");
const Book = require("./model/Book");

const app = express();

mongoose.connect("mongodb://localhost:27017/Library");

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
app.listen(port, function () {
  console.log("Server Has Started!");
});
