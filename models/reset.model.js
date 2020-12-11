const mongoose = require('mongoose')
const Schema = mongoose.Schema

const ResetSchema = new Schema({
    email:{
        type:String,
        require:true,
        unique:true,
        trim:true,// no spaces after the email
        minlength:10
    }
},
    {
        timestamps: true,
    });
const Reset = mongoose.model('Reset-Password', ResetSchema);
module.exports = Reset;
