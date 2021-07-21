const userSchema = require("./user")
const fs = require("fs")
const express = require("express")
const path = require("path")
const mongoose = require("mongoose")

const dbUrl = "mongodb://localhost/userManagement"

mongoose.connect(dbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true 
})

dbSetup(mongoose.connection)
const User = mongoose.model("User", userSchema)

const directories = {
    index: () => "/",
    create: () => "/create",
    users: () => "/users",
    find: () => "/find",
    user: (paramName) => "/user/:" + paramName,
    delete: (paramName) => "/delete/:" + paramName,
    postUpdate: () => "/update",
    postFindUser: () => "/search",
    postCreateUser: () => "/createUser"
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

    app.use(express.json())
    app.use(express.urlencoded({ extended: true }))

    return app
}

function dbSetup(connection) {
    connection.on("error", console.error.bind(console, "Connection error: "))
    connection.once("open", () => {
        console.log("Database connected")
    })
}

function createListeners(app) {
    app.get(directories.index(), (req, res) => {
        res.render("index")
    })

    app.get(directories.users(), (req, res) => {
        User.find({}, (error, data) => {
            if (error) {
                res.render("errorScreen", {
                    message: error.toString(),
                    link
                })
            } else {
                console.log(data)
                res.render("users", { users : data })
            }
        })
    })

    app.get(directories.user("id"), (req, res) => {
        const id = req.params.id

        if (!id) {
            res.render("errorScreen", {
                message: "You must provide an id: url.com/user/SOME-ID-HERE",
                link: getRefererPathUsingRequest(req)
            })
        }

        User.findOne({ _id : id }, (error, data) => {
            if (error) {
                res.render("errorScreen", {
                    message: error.toString(),
                    link
                })
                return
            } else if (data) {
                res.render("userDetails", { user : data })
            } else {
                res.render("errorScreen", {
                    message: "User with id " + id + " does not exist",
                    link: getRefererPathUsingRequest(req)
                })
            }
        })
    })

    app.get(directories.create(), (req, res) => {
        res.render("createUserForm")
    })

    app.get(directories.find(), (req, res) => {
        res.render("findAccountForm")
    })

    app.post(directories.postCreateUser(), createAccount)
    app.post(directories.postFindUser(), search)
    app.post(directories.postUpdate(), updateUser)
    app.post(directories.delete("id"), deleteUser)

    return app
}

function createAccount(req, res) {
    const { firstName, lastName, email, age } = req.body
    const link = getRefererPathUsingRequest(req)

    User.findOne({ email : email }, (error, data) => {
        if (error) {
            res.render("errorScreen", {
                message: error.toString(),
                link
            })
        } else if (data) {
            console.log(data)
            res.render("errorScreen", {
                message: "Email has already been taken",
                link
            })
        } else {
            const newUser = new User({
                firstName: firstName,
                lastName: lastName,
                email: email,
                age: age
            })

            newUser.save((error, data) => {
                if (error) {
                    res.render("errorScreen", {
                        message: error.toString(),
                        link
                    })
                } else {
                    console.log(data)
                    res.redirect("/user/" + user._id)
                }
            })
        }
    })
}

function search(req, res) {
    const { firstName, lastName } = req.body
    const link = getRefererPathUsingRequest(req)

    let filter = {}

    if (firstName) {
        filter["firstName"] = firstName
    }

    if (lastName) {
        filter["lastName"] = lastName
    }

    User.findOne(filter, (error, data) => {
        if (error) { 
            res.render("errorScreen", {
                message: error.toString(),
                link
            })
        } else if (data) {
            console.log(data)
            res.redirect("/user/" + data.id)
        } else {
            res.render("errorScreen", {
                message: "No user with firstName: " + firstName + ", lastName: " + lastName,
                link
            })
        }

    })
}

function updateUser(req, res) {
    const id = req.body.id
    const firstName = req.body.firstName
    const lastName = req.body.lastName
    const email = req.body.email
    const age = req.body.age
    const link = getRefererPathUsingRequest(req)

    if (!id) {
        res.render("errorScreen", {
            message: "Id was nil",
            link
        })
    } else if (isNaN(age)) {
        res.render("errorScreen", {
            message: "Age must be a number",
            link
        })
    } else {
        User.findOneAndUpdate({ _id : id }, { firstName, lastName, email, age }, { new : true }, (error, data) => {
            if (error) {
                res.render("errorScreen", {
                    message: error.toString(),
                    link
                })
                return
            }

            console.log(data)
    
            res.redirect("/user/" + id)
        })
    }
}

function deleteUser(req, res) {
    const id = req.params.id

    if (!id) {
        res.render("errorScreen", {
            message: "Id was nil",
            link
        })
    } else {
        User.deleteOne({ _id : id }, (error) => {
            if (error) {
                res.render("errorScreen", {
                    message: error.toString(),
                    link
                })
            } else {
                res.redirect("/users")
            }
        })
    }
}

function addEndLogic(app) {
    const endAction = () => {
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

const port = process.env.PORT || 3000

var server = addEndLogic(createListeners(setup(express()))).listen(port, () => {
    console.log("App listening on port " + port)
})