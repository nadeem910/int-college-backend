const router = require('express').Router();
let bcrypt = require("bcrypt");//to hash password
let Reset = require('../models/reset.model');
let Students = require('../models/student.model');
let Lecturer = require('../models/lecturer.model');
// let crypto = require('crypto');//for random 32 bits
let nodemailer= require('nodemailer');//to send mail 

let transporter = nodemailer.createTransport({// transporter to connect you to whichever host domain(make the connection with the host)
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,// TODO: your gmail account
        pass: process.env.PASSWORD// TODO: your gmail password
    }
});


async function ContentOfMailAndSendIt(forEmail,DocId,whichUser){
// mail content
// console.log(forEmail+"/"+DocId+"/"+whichUser)
let mailOptions = {
    from: process.env.EMAIL, // TODO: email sender
    to: forEmail, // TODO: email receiver
    subject: 'Reset Password',
    html: `<p>You requested for password reset !!</p>
    <h5>Click on this <a href="http://localhost:5000/reset/delete?id=${DocId}&&me=${whichUser}">Link</a></h5>`
};
transporter.sendMail(mailOptions, (err) => {
    if (err) {
     console.log('Error occurs:'+err)
    }else{
    console.log('Email sent!!!');
    }
});
}
router.post('/add', (req, res) => {
    let isStu = 0;//(default value)
        Reset.find({ email: req.body.email })
            .then(async (docs) => {
                if (docs.length > 0) {// i delete all old keys if i have that the same email
                    await Reset.deleteMany({ email: req.body.email }, (err) => {
                        //to delete keys of same student/lecturer from resetpaswords  table
                        if (err) {
                            res.json({ message: "faild to delete key/s" });
                        }
                    })
                }
                await Students.find({ email: req.body.email })//check if the email is valid (student/lecturer)
                    .then(students => {
                        if (students.length) {
                            isStu = 1;//thats mean that the email for student
                        }
                    })
                    .catch(err => res.json({ message: err }))
                if (isStu === 0) {
                    await Lecturer.find({ email: req.body.email })
                        .then(lecturers => {
                            if (lecturers.length) {
                                isStu = 2;//thats mean that the email for lecturer
                            }
                        })
                        .catch(err => res.json({ message: err }))
                }
                if (isStu > 0) {
                    let reset = new Reset({
                        email: req.body.email
                    })//save only one collection for each email(collection contains key for reset pass)
                    reset.save()
                        .then((doc) => {
                            ContentOfMailAndSendIt(req.body.email,doc._id,isStu) //we have to send email for email with is stu(varibale)
                            res.json({ message: "check your email"})
                        })
                        .catch((err) => {
                            res.json({ message: `error :${err}` })
                        })
                } else {
                    res.json({ message: "wrong email" });
                }
            })
});

router.get('/delete', (req, res) => {
    let id = req.query.id;
    let me = req.query.me;
    Reset.findById({ _id: id })
        .then((doc) => {
            updateUser(doc.email, res,whichModel(me));
        })
        .catch((err) => {
            res.json({ message: "faild to find this reset information" });

        })
});

function whichModel(num) {
    switch (num) {
        case "1": return Students;
        case "2":return Lecturer;
    }
}
function updateUser(studentEmail, res,whichMoodel) {
    let defaultPass = (Math.floor(Math.random()*9000000) + 1000000).toString();//random new pass for reset
    whichMoodel.find({ email: studentEmail })
        .then(docs => {
            bcrypt.hash(defaultPass, 10, async (err, hash) => {
                if (err) {
                    return res.json({ message: "Faild to encrypt the New Password" });
                } else {
                    docs[0].password = hash;
                    docs[0].save()
                        .then((stu) => {
                            Reset.deleteMany({ email: studentEmail }, (err) => {
                                //to delete keys of same student/lecturer from resetpaswords  table
                                if (err) {
                                    res.json({ message: "faild to delete key/s" });
                                }
                                res.send(`user updated your your new password is ${defaultPass}`)
                            })
                        })
                        .catch(error => res.json({ message: `user doesn't update ,error:${error}` }));
                }
            })
        });
}
module.exports = router;

