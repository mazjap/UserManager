const express = require("express")
const path = require("path")
const { Pool, Client } = require("pg")
const baseUrl = "postgres://postgres:postgress@localhost:5432/"
const bufferUrl = baseUrl + "postgres"
const dbUrl = baseUrl + "usermanager"

const bufferClient = new Client({
    connectionString: bufferUrl,
})

const pool = new Pool({
    connectionString: dbUrl,
})

const port = process.env.PORT || 3000
var server;

bufferClient.connect()
.catch(error => console.log(error))
.finally(() => {
    bufferClient.query("create database usermanager")
    .catch(error => console.log(error))
    .finally(() => {
        bufferClient.end()
        dbSetup(pool.connect())
    })
})

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
    connection.then(() => {
        console.log("Database connected")

        pool.query("create table if not exists users (firstname varchar not null, lastname varchar not null, email varchar not null, age int not null, id varchar primary key not null)")
        .catch(error => console.log(error))
        .finally(() => {
            console.log("Created user table, if it didn't already exist.")

            server = addEndLogic(createListeners(setup(express()))).listen(port, () => {
                console.log("App listening on port " + port)
            })
        })
    })
    .catch(error => console.log(error))
}

function createListeners(app) {
    app.get(directories.index(), (req, res) => {
        res.render("index")
    })

    app.get(directories.users(), (req, res) => {
        res.redirect("/users/firstname")
    })

    app.get(directories.sortedUsers("sortedBy"), (req, res) => {
        const keys = ["firstname", "lastname", "email", "age"]
        const validSortKeys = [...keys, ...keys.map(key => "-" + key)]
        const sortKey = req.params.sortedBy.toLowerCase()
        const link = getRefererPathUsingRequest(req)
        
        if (validSortKeys.includes(sortKey)) {
            let query = "select * from users order by "

            if (sortKey[0] === "-") {
                query += sortKey.slice(1) + " DESC"
            } else {
                query += sortKey + " ASC"
            }

            console.log(query)
            pool.query(query)
            .then(data => {
                res.render("users", { users: data.rows })
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
        .then((response => {
            if (response.rowCount > 0) {
                res.render("userDetails", { user : response.rows[0] })
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
    const { firstname, lastname, email, age } = req.body
    const link = getRefererPathUsingRequest(req)

    pool.query("select email from users where email = $1", [email])
    .then(data => {
        if (data.rowCount > 0) {
            res.render("errorScreen", {
                message: `Email ${data} has already been taken`,
                link
            })
        } else {
            const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
                return v.toString(16)
            })

            pool.query("insert into users (id,firstname,lastname,email,age) values ($1,$2,$3,$4,$5)", [id, firstname, lastname, email, age])
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
    const { firstname, lastname } = req.body
    const link = getRefererPathUsingRequest(req)

    let query = "select * from users where "
    let variables = []

    if (firstname) {
        variables.push(firstname)
        query += `firstname = $${variables.length}`

        if (lastname) {
            variables.push(lastname)
            query += ` and lastname = $${variables.length}`
        }
    } else if (lastname) {
        variables.push(lastname)
        query += `lastname = $${variables.length}`
    } else {
        res.render("errorScreen", {
            message: "You must provide a first and/or last name",
            link
        })
        return
    }

    pool.query(query, variables)
    .then(data => {
        if (data.rowCount > 0) {
            res.redirect("/user/" + data.rows[0].id)
        } else {
            res.render("errorScreen", {
                message: "No user with firstname: " + firstname + ", lastname: " + lastname,
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
    .finally(() => console.log(`Search with ${firstname} ${lastname} requested`))
}

function updateUser(req, res) {
    const id = req.body.id
    const firstname = req.body.firstname
    const lastname = req.body.lastname
    const email = req.body.email
    const age = req.body.age
    const link = getRefererPathUsingRequest(req)

    const arr = [{
        key: "firstname",
        value: firstname
    }, {
        key: "lastname",
        value: lastname
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

    arr.forEach((item) => {
        if (item.value != null) {
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
        console.log(query)
        pool.query(query, variables)
        .then(data => {
            console.log("Updated user:")
            console.log(data)
            res.redirect("/user/" + id)
        })
        .catch(error => {
            res.render("errorScreen", {
                message: error.toString(),
                link
            })
            return
        })
        .finally(() => console.log("User update requested"))
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
        .finally(() => console.log(`Delete user with id ${id} requested`))
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
    pool.end(() => {
        console.log("Pool closed")
    })
}