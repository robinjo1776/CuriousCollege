//#region - All the requirements and initial setups
const db = require("./modules/application.js")

const exphbs = require("express-handlebars")
var express = require("express")

const clientSessions = require("client-sessions")
const e = require("express")

var app = express()
app.set("view engine", ".hbs")

var HTTP_PORT = process.env.PORT || 8000

//allows us to access files within public and views
app.use(express.static("public"))
app.use(express.static("views"))
//allows us to read from the body
app.use(express.urlencoded({ extended: true }))

app.engine(
  ".hbs",
  exphbs.engine({
    extname: ".hbs",
    helpers: {
      navLink: (url, options) => {
        return (
          "<li" +
          (url == app.locals.activeRoute
            ? ' class="nav-item active" '
            : ' class="nav-item" ') +
          '><a class="nav-link" href="' +
          url +
          '">' +
          options.fn(this) +
          "</a></li>"
        )
      },

      equal: (lvalue, rvalue, options) => {
        if (arguments.length < 3)
          throw new Error("Handlebars Helper equal needs 2 parameters")
        if (lvalue != rvalue) {
          return options.inverse(this)
        } else {
          return options.fn(this)
        }
      },
    },
  })
)

//to fix the highlighting of the nav
app.use((req, res, next) => {
  let route = req.path.substring(1)
  app.locals.activeRoute =
    "/" +
    (isNaN(route.split("/")[1])
      ? route.replace(/\/(?!.*)/, "")
      : route.replace(/\/(.*)/, ""))
  next()
})

//#endregion

//#region - setting up cookie
app.use(
  clientSessions({
    cookieName: "capsession",
    secret: "cap805_cc",
    duration: 60 * 1000,
    activeDuration: 5 * 60 * 1000,
  })
)
//#endregion

//#region - Main pages of the website that is open to everyone
//Routes
app.get("/", (req, res) => {
  //console.log("home: " + req.capsession.user.username)
  db.getPopularPosts()
    .then((popularPosts) => {
      db.getPosts()
        .then((posts) => {
          res.render("home", {
            forumPost: posts,
            user: req.capsession.user,
            popularPosts: popularPosts,
          })
        })
        .catch()
    })
    .catch()
})

//get the categories page
app.get("/categories", (req, res) => {
  db.getCategories().then((categories) => {
    res.render("categories", {
      user: req.capsession.user,
      Categories: categories,
    })
  })
})

//go to th top threads page
app.get("/topthreads", (req, res) => {
  db.getTopPosts()
    .then((result) => {
      res.render("topthreads", { user: req.capsession.user, threads: result })
    })
    .catch()
})

//get the about us page
app.get("/aboutus", (req, res) => {
  res.render("aboutus")
})

//get the contact us page
app.get("/contact", (req, res) => {
  res.render("contact", { user: req.capsession.user })
})
//#endregion

//#region - Registration function - Checks if username, email is already in use and password has to following a certain guide
//get the register page
app.get("/register", (req, res) => {
  res.render("register")
})

//registering a new user
app.post("/register", (req, res) => {
  const username = req.body.username
  const email = req.body.email
  const password = req.body.password
  const passwordConfirm = req.body.passwordconfirm

  if (db.isEmpty(username)) {
    return res.render("register", {
      errorMsg: "Username cannot be empty",
    })
  }
  if (db.hasSpaces(username)) {
    return res.render("register", { errorMsg: "Username cannot have Spaces" })
  }

  if (!db.passwordGuide(password)) {
    return res.render("register", {
      pwMsg:
        "Password must be at least 6 characters, contain at least one special character, one capital letter, one lower case letter, and a number.",
    })
  }

  if (!db.isPasswordSame(password, passwordConfirm)) {
    return res.render("register", {
      pwMsg: "Passwords do not match",
    })
  }

  db.register(username, email, password)
    .then((msg) => {
      console.log(msg)
      res.redirect("/")
    })
    .catch((err) => {
      if (
        err.includes(
          'duplicate key value violates unique constraint "users_email_key"'
        )
      ) {
        console.log("Email already taken")
        res.render("register", {
          errorMsg: "Email already taken.",
        })
      } else if (
        err.includes(
          'duplicate key value violates unique constraint "users_username_key"'
        )
      ) {
        console.log("Username already taken")
        res.render("register", {
          errorMsg: "Username already taken.",
        })
      } else {
        console.log(err)
      }
    })
})
//#endregion

//#region the Login function and logout (clear session)
//get the login page
app.get("/login", (req, res) => {
  res.render("login", { user: req.capsession.user })
})

//performing the actual logging in
app.post("/login", (req, res) => {
  const username = req.body.username
  const password = req.body.password

  if (username == "" || password == "") {
    return res.render("login", {
      user: req.capsession.user,
      errorMsg: "Missing username or password",
    })
  }
  db.login(username)
    .then((usr) => {
      //console.log(usr)
      if (db.isEmpty(usr)) {
        res.render("login", {
          user: req.capsession.user,
          errorMsg: "Incorrect Credentials",
        })
      } else {
        // console.log(password, usr[0].password)
        if (db.isPasswordSame(password, usr[0].password)) {
          // console.log("reached here as well")
          var isAdmin = false
          //see if user is admin
          //console.log(admins)
          admins.forEach((usr) => {
            if (usr.username.includes(username)) {
              isAdmin = true
            }
          })

          req.capsession.user = {
            userid: usr[0].user_id,
            username: usr[0].username,
            email: usr[0].email,
            isAdmin: isAdmin,
          }

          console.log(
            "Is this user an admin: " +
              isAdmin +
              ", username = " +
              usr[0].username
          )

          res.redirect("/")
        } else {
          res.render("login", {
            user: req.capsession.user,
            errorMsg: "Incorrect Credentials",
          })
        }
      }
    })
    .catch((err) => {
      console.log(err)
    })
})

//log out, clear cookie
app.get("/logout", (req, res) => {
  req.capsession.reset()
  res.redirect("/")
})
//#endregion

//#region Changing user profile and account settings (Username, email, password)

//go to your own profile page (add post function to update username, profile picture and description)
app.get("/profile", ensureLogin, (req, res) => {
  db.getUser(req.capsession.user.username).then((result) => {
    if(db.checkUserSetting(result[0])===true){
      res.render("profile", {
        user: req.capsession.user,
        userSetting: result[0],
      })
      //console.log("User setting property checked.")
    }else{
      res.render("profile", {
        user: req.capsession.user,
        userSetting: req.capsession.user,
        errorMsg: "No profile info found",
      })
    }
  })
})

//updating the profile settings
app.post("/profile", ensureLogin, (req, res) => {
  const username = req.body.username
  const about = req.body.about
  const userid = req.capsession.user.userid

  db.updateProfile(username, about, userid)
    .then(() => {
      if(db.checkUserSessionProperty(req.capsession.user)===true)
      {
        req.capsession.user = {
          userid: userid,
          username: username,
          email: req.capsession.user.email,
          isAdmin: req.capsession.user.isAdmin,
        }
        //console.log("User session property checked.")
      }else{
          req.capsession.user = {
          userid: userid,
          username: username,
          email: req.capsession.user.email,
          isAdmin: req.capsession.user.isAdmin,
          errorMsg: "No session info found",
        }
      }

      db.getUser(req.capsession.user.username).then((result) => {
        if(db.checkUserSetting(result[0])===true){
          res.render("profile", {
            user: req.capsession.user,
            userSetting: result[0],
            errorMsg: "Account settings changed",
          })
          }else{
            res.render("profile", {
              user: req.capsession.user,
              userSetting: req.capsession.user,
              errorMsg: "No profile info found",
            })
          //console.log("User setting property checked.")
        }
      })
    })
    .catch((err) => {
      if (
        err.includes(
          'duplicate key value violates unique constraint "users_username_key"'
        )
      ) {
        res.render("profile", {
          user: req.capsession.user,
          userSetting: req.capsession.user,
          errorMsg: "Username already exists!",
        })
      }
    })
})

//go to your account page (add post function to update email and password)
app.get("/account", ensureLogin, (req, res) => {
  db.getUser(req.capsession.user.username)
    .then((result) => {
      if(db.checkUserSetting(result[0])===true){
        res.render("account", {
          user: req.capsession.user,
          userSetting: result[0],
        })
      //console.log("User setting property checked.");
      }else{
        res.render("account", {
          user: req.capsession.user,
          userSetting: req.capsession.user,
          errorMsg: "No account info found",
        })
      }
    })
    .catch((err) => {
      console.log(err.message)
    })
})

//update profile email and password
//need to add password validations.
app.post("/account", ensureLogin, (req, res) => {
  const email = req.body.email
  const password = req.body.password
  const userid = req.capsession.user.userid

  db.getUserByID(userid)
    .then((result) => {
      if (!db.passwordGuide(password)&&db.checkUserSetting(result[0])===true){
        res.render("account", {
          user: req.capsession.user,
          userSetting: result[0],
          pwMsg:
            "Password must be over 6 characters long and must have atleast one capital, one lower case letter, a special character and a number",
        })
      } else {
        db.updateAccount(email, password, userid)
          .then(() => {
            req.capsession.user = {
              userid: userid,
              username: req.capsession.user.username,
              email: email,
              isAdmin: req.capsession.user.isAdmin,
            }
            if(db.checkUserSessionProperty(req.capsession.user)===true){
              db.getUser(req.capsession.user.username).then((result) => {
                res.render("account", {
                  user: req.capsession.user,
                  userSetting: result[0],
                  errorMsg: "Account settings changed",
                })
              })
              //console.log("User session property checked.")
            }else{
              res.render("account", {
                user: req.capsession.user,
                userSetting: req.capsession.user,
                errorMsg: "No account info found",
              })
            }
          })
          .catch((err) => {
            if (
              err.includes(
                'duplicate key value violates unique constraint "users_email_key"'
              )
            ) {
              db.getUser(req.capsession.user.username).then((result) => {
                if(db.checkUserSetting(result[0])===true){
                  res.render("account", {
                    user: req.capsession.user,
                    userSetting: result[0],
                    errorMsg: "Email already exists!",
                  })
                }
              })
            }
          })
      }
    })
    .catch((err) => {
      console.log(err.message)
    })
})
//#endregion

//#region - getting user notifications
//get to the notifications page (probably not going to end up implementing)
app.get("/notifications", ensureLogin, (req, res) => {
  db.getNotifications(req.capsession.user.userid)
    .then((result) => {
      //console.log(result)
      res.render("notifications", {
        user: req.capsession.user,
        notifications: result,
      })
    })
    .catch((err) => {
      console.log(err)
    })
})
//#endregion

//#region - Not finished functions and future implementations (Current work station)

//finish up view post, edit post, comment, edit comment, liking a post, subscribing to a category, admin panel, changing roles on admin panel, clicking into a category and showing all the posts.
//Prakhar, Robin, yu cheng

app.get("/categories/:id", (req, res) => {
  let id = req.params.id

  //get the posts from a certain category by cat_id
})

//#endregion

//#region Functions and helper functions

//ensure that the user is logged in before being able to access the page
function ensureLogin(req, res, next) {
  if (!req.capsession.user) {
    //console.log(req.capsession.user.username)
    res.redirect("/login")
  } else {
    //console.log("not working" + req.capsession.user.username)
    next()
  }
}

//ensure that the user is an admin because being able to access the page.
function ensureAdmin(req, res, next) {
  if (!req.capsession.user.isAdmin) {
    res.redirect("/login")
  } else {
    next()
  }
}

//#endregion

//#region initialization of the database and starting up server.js
db.initialize()
  .then(() => {
    app.listen(HTTP_PORT, () => {
      console.log("server listening on port: " + HTTP_PORT)
    })
  })
  .catch((err) => {
    console.log(err.message)
  })
//#endregion
