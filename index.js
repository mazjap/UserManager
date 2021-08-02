const userSchema = require("./user")
const express = require("express")
const path = require("path")
const { Pool } = require("pg")

const dbUrl = "postgres://postgres:postgress@localhost:5432/user"

const pool = new Pool({
    connectionString: dbUrl,
})

dbSetup(pool.connect())

const directories = {
    index: () => "/",
    create: () => "/create",
    users: () => "/users",
    sortedUsers: (firstParamName) => "/users/:" + firstParamName,
    find: () => "/find",
    user: (paramName) => "/user/:" + paramName,
    delete: (paramName) => "/delete/:" + paramName,
    postUpdate: () => "/update",
    postFindUser: () => "/search",
    postCreateUser: () => "/createUser"
}

function getRefererPath(referer, origin) {
    return referer.split(origin).join('')
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
    connection.then(() => console.log("Database connected"))
    .catch(error => console.log(error))
}

function createListeners(app) {
    app.get(directories.index(), (req, res) => {
        res.render("index")
    })

    app.get(directories.users(), (req, res) => {
        res.redirect("/users/firstName")
    })

    app.get(directories.sortedUsers("sortedBy"), (req, res) => {
        const keys = ["firstName", "lastName", "email", "age"]
        const validSortKeys = [...keys, ...keys.map(key => "-" + key)]
        const sortKey = req.params.sortedBy
        
        if (validSortKeys.includes(sortKey)) {
            let query = "select * from users order by "

            if (sortKey[0] === "-") {
                query += sortKey.slice(1) + " DESC"
            } else {
                query += sortKey + " ASC"
            }

            pool.query(query)
            .then(users => {
                console.log(users)
                res.render("users", { users })
            })
            .catch(error => {
                res.render("errorScreen", {
                    message: error.toString(),
                    link
                })
            })
            .finally(() => console.log("Users sorted by " + sortKey + " requested"))
        } else {
            res.render("errorScreen", {
                message: "/users/" + sortKey + " is not a valid filter path.",
                link
            })
        }
    })

    app.get(directories.user("id"), (req, res) => {
        const id = req.params.id

        if (!id) {
            res.render("errorScreen", {
                message: "You must provide an id: url.com/user/SOME-ID-HERE",
                link: getRefererPathUsingRequest(req)
            })
        }

        pool.query("select * from users where id = $1", [id])
        .then((user => {
            console.log("Array or single user object? " + user)
            if (user) {
                res.render("userDetails", { user : data })
            } else {
                res.render("errorScreen", {
                    message: "User with id " + id + " does not exist",
                    link: getRefererPathUsingRequest(req)
                })
            }
        }))
        .catch(error => {
            console.log("Error for no response? " + error.message)
            res.render("errorScreen", {
                message: error.message,
                link: getRefererPathUsingRequest(req)
            })
        })
        .finally(() => console.log("User with id " + id + " requested"))
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

    pool.query("select email from users where email = $1", [email])
    .then(data => {
        if (data) {
            res.render("errorScreen", {
                message: "Email has already been taken",
                link
            })
        } else {
            const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
                return v.toString(16)
            })

            pool.query("insert into users (id,firstName,lastName,email,age) values ($1,$2,$3,$4,$5)", [id, firstName, lastName, email, age])
            .then(() => {
                res.redirect("/user/" + id)
            })
            .catch(error => {
                res.render("errorScreen", {
                    message: error.toString(),
                    link
                })
            })
        }
    })
    .catch(error => {
        res.render("errorScreen", {
            message: error.toString(),
            link
        })
    })
    .finally(() => console.log("New account requested"))
}

function search(req, res) {
    const { firstName, lastName } = req.body
    const link = getRefererPathUsingRequest(req)

    let query = "select * from users where "
    let variables = []

    if (firstName) {
        variables.push(firstName)
        query += `firstName = $${variables.length}`

        if (lastName) {
            variables.push(lastName)
            query += ` and lastName = $${variables.length}`
        }
    } else if (lastName) {
        variables.push(lastName)
        query += `lastName = $${variables.length}`
    } else {
        res.render("errorScreen", {
            message: error.toString(),
            link
        })
        return
    }

    pool.query(query)
    .then(data => {
        if (data) {
            console.log("Check if one or many: " + data)
            res.redirect("/user/" + data.id)
        } else {
            res.render("errorScreen", {
                message: "No user with firstName: " + firstName + ", lastName: " + lastName,
                link
            })
        }
    })
    .catch(error => {
        res.render("errorScreen", {
            message: error.toString(),
            link
        })
    })
    .finally(() => console.log(`Search with ${firstName} ${lastName} requested`))
}

function updateUser(req, res) {
    const id = req.body.id
    const firstName = req.body.firstName
    const lastName = req.body.lastName
    const email = req.body.email
    const age = req.body.age
    const link = getRefererPathUsingRequest(req)

    const arr = [{
        key: "firstName",
        value: firstName
    }, {
        key: "lastName",
        value: lastName
    }, {
        key: "email",
        value: email
    }, {
        key: "age",
        value: age
    }]

    let query = "update users set "
    let variables = []
    let queryStarted = false

    arr.forEach((item, index) => {
        if (Boolean(item.value)) {
            if (queryStarted) {
                query += "and "
            }

            variables.push(item.value)
            query += `${item.key} = $${variables.length} `

            queryStarted = true
        }
    })

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
        pool.query(query)
        .then(data => {
            if (data) {
                console.log(data)
        
                res.redirect("/user/" + id)
            } else {
                res.render("errorScreen", {
                    message: "Unable to update user. Please try again later"
                })
            }
        })
        .catch(error => {
            res.render("errorScreen", {
                message: error.toString(),
                link
            })
            return
        })
        .finally(() => console.log("Something requested"))
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
        pool.query("delete from users where id = $1", [id])
        .then(() => {
            console.log(`User with id ${id} was deleted`)
            res.redirect("/users")
        })
        .catch(error => {
            res.render("errorScreen", {
                message: error.toString(),
                link
            })
        })
        .finally(() => console.log(`Delete id ${id} requested`))
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
    pool.end(() => {
        console.log("Pool closed")
    })
}

const port = process.env.PORT || 3000

var server = addEndLogic(createListeners(setup(express()))).listen(port, () => {
    console.log("App listening on port " + port)
})