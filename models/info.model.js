const mongoose = require('mongoose')
const Schema = mongoose.Schema

const InfoSchema = new Schema({
    id: {
        type: String,
        require: true,
        trim: true,// no spaces after the email
        minlength: 10
    },
    date: {
        type: Date,
        require: true,
        trim: true
    },
    was: {
        type: Boolean,
        require: true,
        trim: true,// no spaces after the firstname
    }
},
    {
        timestamps: true,
    });
const Info = mongoose.model('Info', InfoSchema);
module.exports = Info;
