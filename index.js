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
    usersFile = require(path.join(__dirname, usersDbFileName)) // Security is not an issue at this point
}

function getRefererPath(referer, origin) {
    const link = referer.split(origin).join('')

    console.log(link)

    return link
}

function getRefererPathUsingRequest(request) {
    return getRefererPath(request.headers.referer, request.headers.origin)
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

    app.get("/users", (req, res) => {
        res.render("users", { users })
    })

    app.get("/user/:id", (req, res) => {
        const id = req.params.id

        if (!id) {
            res.render("errorScreen", {
                message: "You must provide an id: url.com/user/SOME-ID-HERE",
                link: getRefererPathUsingRequest(req)
            })
        }

        const user = users.find((usr) => usr.id === id)

        if (user) {
            res.render("userDetails", { user })
        } else {
            res.render("errorScreen", {
                message: "User with id " + id + " does not exist",
                link: getRefererPathUsingRequest(req)
            })
        }
    })

    app.get("/create", (req, res) => {
        res.render("createUserForm")
    })

    app.get("/find", (req, res) => {
        res.render("findAccountForm")
    })

    app.post("/createUser", createAccount)
    app.post("/search", search)
    app.post("/updateUser", updateUser)

    return app
}

function createAccount(req, res) {
    const { name, email, age } = req.body
    const refererPath = getRefererPathUsingRequest(req)
    
    // Error handling
    if (users.find(usr => usr.email === email)) {
        res.render("errorScreen", {
            message: "Email has already been taken",
            link: refererPath
        })
    } else if (!age) {
        res.render("errorScreen", {
            message: "Age cannot be empty",
            link: refererPath
        })
    } else { // The magic
        const user = new User(name, email, age)
        current = user
        users.push(user)
        res.redirect("/user/" + user.id)
    }
}

function search(req, res) {
    const email = req.body.email
    const user = users.find((usr => usr.email === email))
    const link = getRefererPathUsingRequest(req)

    if (!email) {
        res.render("errorScreen", {
            message: "Email cannot be empty",
            link
        })
    } else if (!user) {
        res.render("errorScreen", {
            message: "Email cannot be empty",
            link
        })
    } else {
        current = user

        res.redirect("/user/" + user.id)
    }
}

function updateUser(req, res) {
    const id = req.body.id
    const name = req.body.name
    const email = req.body.email
    const age = req.body.age
    const index = users.findIndex(usr => usr.id === id)
    const link = getRefererPathUsingRequest(req)

    if (!id) {
        res.render("errorScreen", {
            message: "Id was nil",
            link
        })
    } else if (index === -1) {
        res.render("errorScreen", {
            message: "User with id " + id + " could not be found",
            link
        })
    } else {
        if (name) {
            users[index].name = name
        }

        if (email) {
            users[index].email = email
        }

        if (age) {
            users[index].age = age
        }

        res.redirect("/user/" + id)
    }
}

function addEndLogic(app) {
    const endAction = () => {
        const obj = {
            current,
            users
        }

        fs.writeFileSync(path.join(__dirname, usersDbFileName), JSON.stringify(obj))
        process.exit()
    }

    for (const processEvent of ["exit", "SIGINT", "SIGUSR1", "SIGUSR2", "uncaughtException"]) {
        process.on(processEvent, endAction)
    }

    return app
}

function closeServer() {
    server.close()
}

const port = 3000

var server = addEndLogic(createListeners(setup(express()))).listen(port, () => {
    console.log(console.log("App listening on port " + port))
})