const mongoose=require('mongoose')
const Schema=mongoose.Schema

const LecturerSchema=new Schema({
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
    pic:{
        type:String,
        require:true    
    },
    gender:{
        type:String,
        require:true    
    },
    id:{
        type:Number,
        require:true,
        trim:true,
        unique:true,
        minlength:9
    }},
    {
        timestamps:true,
    });
const Lecturer=mongoose.model('Lecturers',LecturerSchema);
module.exports=Lecturer;
