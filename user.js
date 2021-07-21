const mongoose = require("mongoose")

module.exports = new mongoose.Schema({
    firstName: String,
    lastName: String,
    email: String,
    age: Number
})

// module.exports = class User {
//     constructor(name, email, age) {
//         this.name = name
//         this.email = email
//         this.age = age
//         this.id = User.generateId()
//     }

//     toString() {
//         return `User:\nName: ${this.name}\nEmail: ${this.email}\nAge: ${this.age}\nId: ${this.id}`
//     }

//     static generateId() {
//         return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
//             let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
//             return v.toString(16)
//         })
//     }
// }