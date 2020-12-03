const mongoose=require('mongoose')
const Schema=mongoose.Schema

const StudentsSchema=new Schema({
    email:{
        type:String,
        require:true,
        unique:true,
        trim:true,// no spaces after the email
        minlength:10
    },
    password:{
        type:String,
        require:true,
        trim:true,// no spaces after the username
        minlength:7
    },
    firstname:{
        type:String,
        require:true,
        trim:true,// no spaces after the firstname
        minlength:3
    },
    lastname:{
        type:String,
        require:true,
        trim:true,// no spaces after the lastname
        minlength:3
    },
    gender:{
        type:String,
        require:true,
        trim:true,// no spaces after the lastname
        minlength:3
    },
    pic:{
        type:String,
        require:true,
        trim:true,// no spaces after the lastname
        minlength:3
    },
    id:{
        type:String,
        require:true,
        trim:true,
        unique:true,
        minlength:1
    }},
    {
        timestamps:true,
    });
const Students=mongoose.model('Students',StudentsSchema);
module.exports=Students;
