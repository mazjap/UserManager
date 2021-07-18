const User = require("./user")
const fs = require("fs")
const express = require("express")
const session = require("express-session")
const path = require("path")

let usersFile
let users = []
let current

const usersDbFileName = "usrDb.json"

if (fs.existsSync(path.join(__dirname, usersDbFileName))) {
    usersFile = require("usrDb.json") // Security is not an issue at this point
}

function setup(app) {
    app.set("views", path.join(__dirname, "views"))
    app.set("view engine", "pug")

    app.use(express.urlencoded())

    if (usersFile) {
        for (const usr of usersFile["users"]) {
            users.push(usr)
        }
    
        current = usersFile["current"]
    }

    return app
}

function createListeners(app) {
    app.get("/", (req, res) => {
        res.render("index", {
            user: (current ? users.find((usr) => usr.id === current) : null)
        })
    })

    // app.get("/users", (req, res) => {
    //     res.render("users", { users })
    // })

    // app.get("/user/:id", (req, res) => {
    //     const id = req.params.id
    //     const user = users.find((usr) => usr.id === id)

    //     if (user) {
    //         res.render("userDetails", { user })
    //     } else {
    //     }
    // })

    app.get("/signup", (req, res) => {
        res.render("createUserForm")
    })

    app.get("/login", (req, res) => {
        res.render("logUserInForm")
    })

    app.post("/createAccount", createAccount)

    return app
}

function createAccount(req, res) {
    console.log(req.body)
}

function addEndLogic(app) {
    process.on('exit', function() {
        const obj = {
            current,
            users
        }

        fs.writeFileSync(path.join(__dirname, usersDbFileName), JSON.stringify(obj))
    })

    return app
}

function start(app, port=3000) {
    app.listen(port, () => {
        console.log("App listening on port 3000")
    })

    return app
}

start(addEndLogic(createListeners(setup(express()))))