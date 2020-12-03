const router = require('express').Router();
const bcrypt = require("bcrypt");
let Lecturer = require('../models/lecturer.model');
const jwt = require('jsonwebtoken');

const cookieparser = require('cookie-parser');//for cookies
router.use(cookieparser());

//for upload students photos
const multer = require('multer');
const upload = multer();

//Piping the Multer stream into our file system
const fs = require("fs");
const { promisify } = require("util");
const pipeline = promisify(require("stream").pipeline);

let refreshTokens = [];

router.post("/signup", (req, res) => {//*handle image
    Lecturer.find({ email: req.body.email })
        .then(emails => {
            if (emails.length) {
                return res.json({
                    message: "Lecturer exists/same Email"
                });
            } else {
                bcrypt.hash(req.body.password, 10, (err, hash) => {
                    if (err) {
                        return res.status(500).json({
                            error: err
                        });
                    } else {
                        let lecturer = new Lecturer({
                            email: req.body.email,
                            password: hash,
                            firstname: req.body.firstname,
                            lastname: req.body.lastname,
                            pic: req.body.pic,
                            gender:req.body.gender,
                            id: req.body.id
                        });
                        lecturer.save()
                            .then(result => {
                                res.json({
                                    message: "Lecturer Added"
                                });
                            })
                            .catch(err => {
                                console.log(err);
                                res.json({
                                    error: err
                                });
                            });
                    }
                });
            }
        });
});

router.post('/login', (req, res) => {
    Lecturer.find({ email: req.body.email })
        .then(emails => {
            if (!emails.length) {
                return res.json({
                    message: "Auth failed"
                });
            }
            bcrypt.compare(req.body.password, emails[0].password, (err, result) => {
                if (err) {
                    return res.json({
                        message: "Auth failed"
                    });
                }
                else {
                    if (result) {
                        let lecturerid = { id: emails[0]._id }
                        let accessToken = generateAccessToken(lecturerid)
                        let refreshToken = jwt.sign(lecturerid, process.env.REFRESH_TOKEN_SECRET)
                        refreshTokens.push(refreshToken)
                        res.json({ accessToken: accessToken, refreshToken: refreshToken, message: "auth succesfull" })

                    } else {
                        return res.json({ message: "InValid Password" });
                    }
                }
            });
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({
                error: err
            });
        });
});

router.post('/update', upload.single("file"), (req, res) => {//you have to check the email
    Lecturer.findById({ _id: req.body._id })
        .then(lecturer => {
            bcrypt.compare(req.body.oldpass, lecturer.password, (err, result) => {
                if (err) {
                    return res.json({
                        message: "failed to compare old-new Paswords"
                    });
                }
                if (result === false) {//old password invalid
                    res.json({ message: "Invalid Old Password" });
                }
                else {//Auth old pass ,update user
                    bcrypt.hash(req.body.password, 10, async (err, hash) => {
                        if (err) {
                            return res.json({ message: "Faild to encrypt the New Password" });
                        } else {//here we have to check image (if uplloaded , if udploaded we have to remove the first one)
                            let imageResult = "";
                            if (req.file) {//check if the lecturer wanna change her image 
                                imageResult = await forUploadPic(req.file, req.body.firstname,lecturer.pic);
                            }
                            if (imageResult === 1) {
                                res.json({ message: "photo name already exsits" })
                            } else if (imageResult === 2) {
                                res.json({ message: "file must be .jpg" })
                            } else {
                                lecturer.password = hash;
                                lecturer.email = req.body.email || lecturer.email;
                                lecturer.firstname = req.body.firstname || lecturer.firstname;
                                lecturer.lastname = req.body.lastname || lecturer.lastname;
                                lecturer.id = req.body.id || lecturer.id;
                                lecturer.gender = req.body.gender || lecturer.gender;
                                lecturer.pic= (imageResult!=="")?imageResult:lecturer.pic;

                                lecturer.save()
                                    .then(() => res.json({ message: "Lecturer updated" }))
                                    .catch(error => res.json({ message: `Lecturer doesn't update ,error:${error}` }));
                            }
                        }
                    })
                }
            });
        })
});

async function forUploadPic(filee, fname,imgToDelete="") {
    let file = filee;
    let fileName = fname;
    let flag = false;//to check if image name already in same folder
    let str = `${fileName}-${file.originalName}`;
    if (file.detectedFileExtension === '.jpg') {
        let filenames = fs.readdirSync(`${__dirname}/../../public/studentImages`);//check if fileName exists
        filenames.forEach((file) => {
            if (file === str) {
                flag = true;
            }
        });
        if (flag) {
            return 1;//"fileName has already exists plz change file name";
        } else {
            await pipeline(
                file.stream,
                fs.createWriteStream(`${__dirname}/../../public/studentImages/${fileName}-${file.originalName}`)
            );
            (imgToDelete!=="")?fs.unlinkSync(`${__dirname}/../../public/studentImages/${imgToDelete}`):"";
            return `${fileName}-${file.originalName}`
        }

    } else {
        return 2;// "the file must be .jpg"
    }
}
router.post('/logout', (req, res) => {
    refreshTokens = refreshTokens.filter(token => token !== req.body.refreshToken)
    res.json({ message: "refreshToken deleted" })
});

router.delete('/', (req, res) => {
    id = req.body.id;
    Lecturer.findByIdAndDelete(id, function (err, docs) {
        if (err) {
            res.json({ message: `lecturer doesn't delete,the error is :${err}` })
        }
        else {
            res.json({ message: "lecturer Deleted" });
        }
    });
});

router.post('/checkAccessToken', (req, res) => {
    jwt.verify(req.body.accessToken, process.env.ACCESS_TOKEN_SECRET, (err, succ) => {
        if (err) {//this will happend only if access token has expired or not valid
            // console.log(`-------------${err}/${err.message}`)
            if (!err.message.includes("expired")) {
                return res.json({ message: "jwt malformed" });//attack /Access token has changed by someone
            } else {
                return res.json({ message: "jwt expired" });//access token has expired
            }
        }
        return res.json({ id: succ.id, message: "auth succesfull" });
    })
});

router.post('/token', (req, res) => {
    let refreshToken = req.body.refreshToken
    if (refreshToken == null) res.json({ accessToken: "" });
    if (!refreshTokens.includes(refreshToken)) return res.json({ accessToken: "" });
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, lecturer) => {
        if (err) return res.json({ accessToken: "" });
        let accessToken = generateAccessToken({ id: lecturer.id })
        res.json({ accessToken: accessToken })
    })
});

function generateAccessToken(lecturerid) {
    return jwt.sign(lecturerid, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '30s' })
}
router.post('/loginByGmail', (req, res) => {
    Lecturer.find({ email: req.body.email })
        .then(emails => {
            if (!emails.length) {
                return res.json({
                    message: "Auth failed"
                });
            }
            let lecturerid = { id: emails[0]._id }
            let accessToken = generateAccessToken(lecturerid)
            let refreshToken = jwt.sign(lecturerid, process.env.REFRESH_TOKEN_SECRET)
            refreshTokens.push(refreshToken);


            res.json({ accessToken: accessToken, refreshToken: refreshToken, message: "auth succesfull" })
        });
});

router.post('/areYouLecturer', (req, res) => {
    let refreshToken = req.body.RT
    if (refreshTokens.includes(refreshToken))
        return res.json({ status: 'yes' });
    return res.json({ status: 'no' });

});

router.get('/getLecturerInfo', (req, res) => {
    console.log(req.query);
    Lecturer.findById(req.query.id || "123456789", function (err, docs) {
        if (err) {
            res.json({ message: `faild to get user ,the error is :${err}` })
        }
        else
            if (docs._id !== null) {
                res.json({ lecturer: docs });
            }
    });
});

module.exports = router;