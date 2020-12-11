const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// const cookieparser = require('cookie-parser');//for cookies

//enviroment varibles
require('dotenv').config();

//create my express server
const app = express();
const port = process.env.PORT||8080;

// app.use(cookieparser());
app.use(cors());
app.use(express.json());//to send and recieve JSON's

//connect to mongo db
const uri = process.env.ATLAS_URI||'mongodb+srv://ofer:ofer@cluster0.g23zl.mongodb.net/final-full-stack?retryWrites=true&w=majority';
mongoose.connect(uri, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true }
);
/********** */
const path = require('path');
app.use(express.static(path.join(__dirname,'../my-app/build')));
/************* */

const InfoRouter=require('./routes/info');
app.use('/info',InfoRouter);

const LecturerRouter=require('./routes/lecturer');
app.use('/lecturer',LecturerRouter);

const StudentRouter=require('./routes/student');
app.use('/student',StudentRouter);

app.get('/',(req,res)=>{
  res.sendFile(path.join(__dirname,'../my-app/build/index.html'))
})

const connection = mongoose.connection;
connection.once('open', () => {
  console.log("MongoDB database connection established successfully");
})

//to start the server listening  
app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
