const router = require('express').Router();
const bcrypt = require("bcrypt");
let Students = require('../models/student.model');
const jwt = require('jsonwebtoken');

//for upload students photos
const multer = require('multer');
const upload = multer();

//Piping the Multer stream into our file system
const fs = require("fs");
const { promisify } = require("util");
const pipeline = promisify(require("stream").pipeline);

let refreshTokens = [];

router.post("/signup", upload.single("file"), (req, res) => {
    Students.find({ email: req.body.email })
        .then(emails => {
            if (emails.length) {
                return res.json({
                    message: "Student exists/same Email"
                });
            } else {
                bcrypt.hash(req.body.password, 10, async (err, hash) => {
                    if (err) {
                        return res.status(500).json({
                            error: err
                        });
                    } else {
                        let imageResult = await forUploadPic(req.file, req.body.firstname);

                        if (imageResult === 1) {
                            res.json({ message: "photo name already exsits" })
                        } else if (imageResult === 2) {
                            res.json({ message: "file must be .jpg" })
                        } else {
                            let Student = new Students({
                                email: req.body.email,
                                password: hash,
                                firstname: req.body.firstname,
                                lastname: req.body.lastname,
                                id: req.body.id,
                                gender:req.body.gender,
                                pic: imageResult
                            });
                            Student.save()
                                .then(result => {
                                    res.json({
                                        message: "Student Added"
                                    });
                                })
                                .catch(err => {
                                    console.log(err);
                                    res.json({
                                        error: err
                                    });
                                });
                        }
                    }
                });
            }
        });
});
async function forUploadPic(filee, fname, imgToDelete = "") {
    let file = filee;
    let fileName = fname;
    let flag = false;
    if (file) {
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
                (imgToDelete !== "") ? fs.unlinkSync(`${__dirname}/../../public/studentImages/${imgToDelete}`) : "";
                return `${fileName}-${file.originalName}`
            }

        } else {
            return 2;// "the file must be .jpg"
        }
    } else {//if the student don't has any picture
        return 'person.jpg';
    }
}
router.post('/login', (req, res) => {
    Students.find({ email: req.body.email })
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
                        let studentId = { id: emails[0]._id }
                        let accessToken = generateAccessToken(studentId)
                        let refreshToken = jwt.sign(studentId, process.env.REFRESH_TOKEN_SECRET)
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
    Students.findById({ _id: req.body._id })
        .then(student => {
            bcrypt.compare(req.body.oldpass, student.password, (err, result) => {
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
                                imageResult = await forUploadPic(req.file, req.body.firstname, student.pic);
                            }
                            if (imageResult === 1) {
                                res.json({ message: "photo name already exsits" })
                            } else if (imageResult === 2) {
                                res.json({ message: "file must be .jpg" })
                            } else {
                                student.password = hash;
                                student.email = req.body.email || student.email;
                                student.firstname = req.body.firstname || student.firstname;
                                student.lastname = req.body.lastname || student.lastname;
                                student.id = req.body.id || student.id;
                                student.gender = req.body.gender || student.gender;
                                student.pic = (imageResult !== "") ? imageResult : student.pic;

                                student.save()
                                    .then(() => res.json({ message: "Student updated" }))
                                    .catch(error => res.json({ message: `Student doesn't update ,error:${error}` }));
                            }
                        }
                    })
                }
            });
        })
});

router.post('/updateFromLecturer', (req, res) => {//we add another update route because the lecturer doesn't know student password
    Students.findById({ _id: req.body._id })
        .then(student => {
            student.email = req.body.email || student.email;
            student.firstname = req.body.firstname || student.firstname;
            student.lastname = req.body.lastname || student.lastname;
            student.id = req.body.id || student.id
            student.gender = req.body.gender || student.gender
            student.save()
                .then(() => res.json({ message: "Student updated" }))
                .catch(error => res.json({ message: `Student doesn't update ,error:${error}` }));
        })
});

router.post('/logout', (req, res) => {
    refreshTokens = refreshTokens.filter(token => token !== req.body.refreshToken)
    res.json({ message: "refreshToken deleted" })
});

router.delete('/', (req, res) => {
    id = req.query.id;
    Students.findByIdAndDelete(id, function (err, docs) {
        if (err) {
            res.json({ message: `Student doesn't delete,the error is :${err}` })
        }
        else {
            res.json({ message: "Student Deleted" });
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
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, student) => {
        if (err) return res.json({ accessToken: "" });
        let accessToken = generateAccessToken({ id: student.id })
        res.json({ accessToken: accessToken })
    })
});

function generateAccessToken(studentId) {
    return jwt.sign(studentId, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '30s' })
}
router.post('/loginByGmail', (req, res) => {
    Students.find({ email: req.body.email })
        .then(emails => {
            if (!emails.length) {
                return res.json({
                    message: "Auth failed"
                });
            }
            let lecturerid = { id: emails[0]._id }
            let accessToken = generateAccessToken(lecturerid)
            let refreshToken = jwt.sign(lecturerid, process.env.REFRESH_TOKEN_SECRET)
            refreshTokens.push(refreshToken)
            res.json({ accessToken: accessToken, refreshToken: refreshToken, message: "auth succesfull" })
        });
});

router.post('/getAllStudents', (req, res) => {
    Students.find()
        .then((students) => {
            res.json({ info: students })
        })
        .catch((err) => {
            err.json({ message: "faild to get students" })
        })
})

router.post('/addUsersByApi', (req, res) => {
    addToDB();
});
async function addToDB() {
    let i = 1;
    let id = 208997;
    data.results.forEach(curr => {
        console.log(`${i++}-${curr.name.first}-${curr.name.last}-${curr.id.value}-${curr.gender}-${curr.picture.large}-${curr.email}`);
        let Student = new Students({
            email: curr.email,
            password: "123456789",
            firstname: curr.name.first,
            lastname: curr.name.last,
            id: id++,
            gender: curr.gender,
            pic: curr.picture.large
        });
        Student.save().then(() => { console.log("1") }).catch((err) => { console.log(err) });
    })
}
//get student from Api :https://randomuser.me/api/?results=27
let data = {
    "results": [
        {
            "gender": "male",
            "name": {
                "title": "Mr",
                "first": "Mattias",
                "last": "Hågensen"
            },
            "location": {
                "street": {
                    "number": 7083,
                    "name": "Olav Selvaags plass"
                },
                "city": "Tromsdalen",
                "state": "Oslo",
                "country": "Norway",
                "postcode": "7421",
                "coordinates": {
                    "latitude": "47.8662",
                    "longitude": "-132.1126"
                },
                "timezone": {
                    "offset": "+10:00",
                    "description": "Eastern Australia, Guam, Vladivostok"
                }
            },
            "email": "mattias.hagensen@example.com",
            "login": {
                "uuid": "96ebad95-f6e2-4a35-9359-e05185b68306",
                "username": "goldenlion900",
                "password": "buttons",
                "salt": "0x3jQowJ",
                "md5": "fcf1a5b94f589a536a1dc551d57cacbf",
                "sha1": "07ce3f119da12978a05e6c78f0c72e686802af37",
                "sha256": "e1b487f3c172433ad61f7d7a5eb753e7db4b553ef78e41159f8078948ee1ad39"
            },
            "dob": {
                "date": "1945-02-11T06:05:30.155Z",
                "age": 75
            },
            "registered": {
                "date": "2008-07-02T05:00:52.032Z",
                "age": 12
            },
            "phone": "63745204",
            "cell": "43914129",
            "id": {
                "name": "FN",
                "value": "11024507329"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/men/11.jpg",
                "medium": "https://randomuser.me/api/portraits/med/men/11.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/men/11.jpg"
            },
            "nat": "NO"
        },
        {
            "gender": "female",
            "name": {
                "title": "Mrs",
                "first": "Ellie",
                "last": "Terry"
            },
            "location": {
                "street": {
                    "number": 9508,
                    "name": "Killarney Road"
                },
                "city": "Castlebar",
                "state": "Monaghan",
                "country": "Ireland",
                "postcode": 94966,
                "coordinates": {
                    "latitude": "-32.2260",
                    "longitude": "-64.6835"
                },
                "timezone": {
                    "offset": "-9:00",
                    "description": "Alaska"
                }
            },
            "email": "ellie.terry@example.com",
            "login": {
                "uuid": "f1613edc-9a5e-451f-a3bf-8dae7ba059f2",
                "username": "purplezebra264",
                "password": "dshade",
                "salt": "GZN3CSOd",
                "md5": "c68ce066bc1f861e7eccb3189437c2b5",
                "sha1": "a5df5691e8ecdd08c740dfc2fd726fa57dc2da11",
                "sha256": "0d2fbc1051f30483d9e74e4b523697a6a1f6fdb6c587614e16a5a098bbddff39"
            },
            "dob": {
                "date": "1979-06-17T17:10:37.083Z",
                "age": 41
            },
            "registered": {
                "date": "2015-05-15T07:54:01.247Z",
                "age": 5
            },
            "phone": "031-926-4460",
            "cell": "081-607-1764",
            "id": {
                "name": "PPS",
                "value": "0866396T"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/women/52.jpg",
                "medium": "https://randomuser.me/api/portraits/med/women/52.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/women/52.jpg"
            },
            "nat": "IE"
        },
        {
            "gender": "female",
            "name": {
                "title": "Miss",
                "first": "Milja",
                "last": "Hokkanen"
            },
            "location": {
                "street": {
                    "number": 4659,
                    "name": "Satakennankatu"
                },
                "city": "Saltvik",
                "state": "Åland",
                "country": "Finland",
                "postcode": 97735,
                "coordinates": {
                    "latitude": "25.8204",
                    "longitude": "90.2718"
                },
                "timezone": {
                    "offset": "+5:45",
                    "description": "Kathmandu"
                }
            },
            "email": "milja.hokkanen@example.com",
            "login": {
                "uuid": "86f3967b-090b-42ba-a0e9-a5f97a923c7c",
                "username": "goldenleopard702",
                "password": "potato",
                "salt": "PFrTjn4t",
                "md5": "89090703bb794cf7728150db982b883d",
                "sha1": "0b7398cf6a0d6ff8b56bcd8d9fdd07404d899f66",
                "sha256": "0332569d5025e95321649ca340c24363d22f27b778e868ad99d60575acc11d0f"
            },
            "dob": {
                "date": "1985-07-25T06:51:15.303Z",
                "age": 35
            },
            "registered": {
                "date": "2005-06-05T13:34:56.030Z",
                "age": 15
            },
            "phone": "02-131-105",
            "cell": "042-735-22-65",
            "id": {
                "name": "HETU",
                "value": "NaNNA996undefined"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/women/48.jpg",
                "medium": "https://randomuser.me/api/portraits/med/women/48.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/women/48.jpg"
            },
            "nat": "FI"
        },
        {
            "gender": "female",
            "name": {
                "title": "Miss",
                "first": "Hayley",
                "last": "Scheper"
            },
            "location": {
                "street": {
                    "number": 269,
                    "name": "Derde Wittenburgerdwarsstraat"
                },
                "city": "Zeddam",
                "state": "Noord-Brabant",
                "country": "Netherlands",
                "postcode": 24308,
                "coordinates": {
                    "latitude": "47.8292",
                    "longitude": "164.0225"
                },
                "timezone": {
                    "offset": "+3:30",
                    "description": "Tehran"
                }
            },
            "email": "hayley.scheper@example.com",
            "login": {
                "uuid": "fa84b23e-4b48-4ac2-8016-22083c5843a8",
                "username": "whiteduck138",
                "password": "blaine",
                "salt": "EtOAMFN9",
                "md5": "85c904e16346c313e0320172b7572f79",
                "sha1": "a67bdcac1eeff292968108173a1b644b00d931bd",
                "sha256": "a4efb17738a4ccb3f735b60f32c2b06b1fe880cbce2b11584a13fb3e279429b8"
            },
            "dob": {
                "date": "1964-05-16T16:53:04.862Z",
                "age": 56
            },
            "registered": {
                "date": "2014-11-18T02:57:04.829Z",
                "age": 6
            },
            "phone": "(165)-197-5568",
            "cell": "(026)-406-1076",
            "id": {
                "name": "BSN",
                "value": "99801800"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/women/82.jpg",
                "medium": "https://randomuser.me/api/portraits/med/women/82.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/women/82.jpg"
            },
            "nat": "NL"
        },
        {
            "gender": "female",
            "name": {
                "title": "Mrs",
                "first": "Dana",
                "last": "Hughes"
            },
            "location": {
                "street": {
                    "number": 7253,
                    "name": "Homestead Rd"
                },
                "city": "Celina",
                "state": "New Mexico",
                "country": "United States",
                "postcode": 56379,
                "coordinates": {
                    "latitude": "78.6669",
                    "longitude": "166.2651"
                },
                "timezone": {
                    "offset": "-9:00",
                    "description": "Alaska"
                }
            },
            "email": "dana.hughes@example.com",
            "login": {
                "uuid": "cbf59390-6f82-475a-a98a-f2e305bd1a83",
                "username": "purpledog153",
                "password": "redrose",
                "salt": "LuEuj2Xc",
                "md5": "57088a7fc34536586516049ced685db9",
                "sha1": "6eb36d090db39faa948053a220563094bdc9ff0c",
                "sha256": "6118e77bf6b12034f159accd1bbdcd9534d2b65d3bbea0a3e1bdedaaed63bf70"
            },
            "dob": {
                "date": "1946-12-18T09:14:11.733Z",
                "age": 74
            },
            "registered": {
                "date": "2003-08-25T05:05:23.442Z",
                "age": 17
            },
            "phone": "(949)-647-5936",
            "cell": "(648)-957-2844",
            "id": {
                "name": "SSN",
                "value": "722-51-7094"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/women/86.jpg",
                "medium": "https://randomuser.me/api/portraits/med/women/86.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/women/86.jpg"
            },
            "nat": "US"
        },
        {
            "gender": "male",
            "name": {
                "title": "Mr",
                "first": "Benjamin",
                "last": "Kristensen"
            },
            "location": {
                "street": {
                    "number": 8790,
                    "name": "Løvsangervej"
                },
                "city": "Aalborg S.Ø.",
                "state": "Sjælland",
                "country": "Denmark",
                "postcode": 65825,
                "coordinates": {
                    "latitude": "86.0252",
                    "longitude": "80.0913"
                },
                "timezone": {
                    "offset": "+1:00",
                    "description": "Brussels, Copenhagen, Madrid, Paris"
                }
            },
            "email": "benjamin.kristensen@example.com",
            "login": {
                "uuid": "989e04a7-1921-4caf-bd02-e01ff3691b62",
                "username": "silverwolf478",
                "password": "mandrake",
                "salt": "WqvKVci8",
                "md5": "cc37d7221ba717d7ced6e927eab2af8a",
                "sha1": "96f2f49f00def24607c95fede6473694ca0c1370",
                "sha256": "a177deb78eb07a21835de83a37ba92933f7a6a541c4a8cfeebed64fab4233738"
            },
            "dob": {
                "date": "1990-04-18T16:26:56.856Z",
                "age": 30
            },
            "registered": {
                "date": "2004-05-08T23:50:39.442Z",
                "age": 16
            },
            "phone": "64882023",
            "cell": "39522702",
            "id": {
                "name": "CPR",
                "value": "180490-8820"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/men/99.jpg",
                "medium": "https://randomuser.me/api/portraits/med/men/99.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/men/99.jpg"
            },
            "nat": "DK"
        },
        {
            "gender": "female",
            "name": {
                "title": "Mrs",
                "first": "Amanda",
                "last": "Lassila"
            },
            "location": {
                "street": {
                    "number": 9749,
                    "name": "Pirkankatu"
                },
                "city": "Kokkola",
                "state": "Satakunta",
                "country": "Finland",
                "postcode": 55422,
                "coordinates": {
                    "latitude": "21.4260",
                    "longitude": "5.5197"
                },
                "timezone": {
                    "offset": "+8:00",
                    "description": "Beijing, Perth, Singapore, Hong Kong"
                }
            },
            "email": "amanda.lassila@example.com",
            "login": {
                "uuid": "95752dc0-ba20-401e-b6ea-6b9e5aa7ef8b",
                "username": "browngoose384",
                "password": "sticky",
                "salt": "ABaZhpw8",
                "md5": "8928d94e02a85e7cb7958adcc25c204e",
                "sha1": "c712cbf321f6778f1bd57441baa3fe899b2d6121",
                "sha256": "159b53b428147a1b58b92dd6de1a95238fa4ed10b0ea617179c520f353cd3ca5"
            },
            "dob": {
                "date": "1968-12-06T08:55:40.495Z",
                "age": 52
            },
            "registered": {
                "date": "2003-06-10T06:43:24.657Z",
                "age": 17
            },
            "phone": "09-389-648",
            "cell": "042-659-05-92",
            "id": {
                "name": "HETU",
                "value": "NaNNA438undefined"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/women/21.jpg",
                "medium": "https://randomuser.me/api/portraits/med/women/21.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/women/21.jpg"
            },
            "nat": "FI"
        },
        {
            "gender": "male",
            "name": {
                "title": "Mr",
                "first": "Vicente",
                "last": "Santiago"
            },
            "location": {
                "street": {
                    "number": 3764,
                    "name": "Calle de Bravo Murillo"
                },
                "city": "Oviedo",
                "state": "Asturias",
                "country": "Spain",
                "postcode": 49381,
                "coordinates": {
                    "latitude": "-45.5215",
                    "longitude": "117.4691"
                },
                "timezone": {
                    "offset": "-8:00",
                    "description": "Pacific Time (US & Canada)"
                }
            },
            "email": "vicente.santiago@example.com",
            "login": {
                "uuid": "76c3391b-1f75-4026-be80-d9c459c02f9c",
                "username": "crazyelephant361",
                "password": "montecar",
                "salt": "NrBz9jGp",
                "md5": "173726f948ea835123aaaed35109f7a4",
                "sha1": "de32e2cdc3dd25dd5a0b6e367d02f1d94ada9388",
                "sha256": "1059186403b88a1655beee934d418b38912f8e36cfad34850edb0bfe67a0e6d4"
            },
            "dob": {
                "date": "1980-12-10T05:59:34.541Z",
                "age": 40
            },
            "registered": {
                "date": "2012-04-22T02:01:25.901Z",
                "age": 8
            },
            "phone": "958-874-080",
            "cell": "647-557-719",
            "id": {
                "name": "DNI",
                "value": "46491565-B"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/men/58.jpg",
                "medium": "https://randomuser.me/api/portraits/med/men/58.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/men/58.jpg"
            },
            "nat": "ES"
        },
        {
            "gender": "male",
            "name": {
                "title": "Mr",
                "first": "Samu",
                "last": "Koistinen"
            },
            "location": {
                "street": {
                    "number": 2903,
                    "name": "Pirkankatu"
                },
                "city": "Nastola",
                "state": "Northern Ostrobothnia",
                "country": "Finland",
                "postcode": 88296,
                "coordinates": {
                    "latitude": "76.8054",
                    "longitude": "-28.6085"
                },
                "timezone": {
                    "offset": "-10:00",
                    "description": "Hawaii"
                }
            },
            "email": "samu.koistinen@example.com",
            "login": {
                "uuid": "d1fa7ed4-0465-4f83-8c04-dd307a178df8",
                "username": "goldenostrich564",
                "password": "bounty",
                "salt": "iahwVnsR",
                "md5": "4c8471ca69d0d0da3df7b0d3f04134e2",
                "sha1": "665fe9ed1084a44f02bc32020d8b6142f5a49313",
                "sha256": "47ec9deb7781092d0b191e8f7df69224b5bd5f304db66d8367a0ea13bc1a7d4f"
            },
            "dob": {
                "date": "1989-04-18T01:25:16.812Z",
                "age": 31
            },
            "registered": {
                "date": "2018-04-28T13:14:21.960Z",
                "age": 2
            },
            "phone": "02-019-607",
            "cell": "043-580-29-60",
            "id": {
                "name": "HETU",
                "value": "NaNNA753undefined"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/men/26.jpg",
                "medium": "https://randomuser.me/api/portraits/med/men/26.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/men/26.jpg"
            },
            "nat": "FI"
        },
        {
            "gender": "female",
            "name": {
                "title": "Mrs",
                "first": "Jennie",
                "last": "Stephens"
            },
            "location": {
                "street": {
                    "number": 600,
                    "name": "Ranchview Dr"
                },
                "city": "Shreveport",
                "state": "Wisconsin",
                "country": "United States",
                "postcode": 32068,
                "coordinates": {
                    "latitude": "-30.1225",
                    "longitude": "55.1591"
                },
                "timezone": {
                    "offset": "-3:30",
                    "description": "Newfoundland"
                }
            },
            "email": "jennie.stephens@example.com",
            "login": {
                "uuid": "8670d145-fd35-4571-be5d-e97e3b8f08f4",
                "username": "beautifuldog992",
                "password": "charlie",
                "salt": "skXAq89E",
                "md5": "3fba9c6bd1d7d02d65634c1dac74e5c5",
                "sha1": "14afcd4619590c325937af2851fcd0358fe8136f",
                "sha256": "724f6655665e424af1dd283844a4c773739175294c7b58a39eedabccdf07371b"
            },
            "dob": {
                "date": "1996-07-07T03:33:40.132Z",
                "age": 24
            },
            "registered": {
                "date": "2005-07-11T02:39:49.586Z",
                "age": 15
            },
            "phone": "(534)-286-1315",
            "cell": "(802)-407-4909",
            "id": {
                "name": "SSN",
                "value": "256-33-4752"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/women/82.jpg",
                "medium": "https://randomuser.me/api/portraits/med/women/82.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/women/82.jpg"
            },
            "nat": "US"
        },
        {
            "gender": "male",
            "name": {
                "title": "Mr",
                "first": "Jorge",
                "last": "Leon"
            },
            "location": {
                "street": {
                    "number": 1227,
                    "name": "Ronda de Toledo"
                },
                "city": "Guadalajara",
                "state": "Cantabria",
                "country": "Spain",
                "postcode": 84028,
                "coordinates": {
                    "latitude": "-4.3615",
                    "longitude": "-48.3718"
                },
                "timezone": {
                    "offset": "+3:00",
                    "description": "Baghdad, Riyadh, Moscow, St. Petersburg"
                }
            },
            "email": "jorge.leon@example.com",
            "login": {
                "uuid": "d62fd266-a17a-4466-b283-9434a999ddb7",
                "username": "brownfish689",
                "password": "gizmo",
                "salt": "NTo0o4pk",
                "md5": "afa0f40256e06148335f83e534c938cb",
                "sha1": "2b81d1ac65b7b85c41dce728ca8dae54ed832611",
                "sha256": "e1a9a7cc5d2fa6251e58e91268fbb419df79c421b96946cea8a7db41fc24db6c"
            },
            "dob": {
                "date": "1965-10-09T11:18:31.251Z",
                "age": 55
            },
            "registered": {
                "date": "2017-02-04T17:36:32.174Z",
                "age": 3
            },
            "phone": "964-797-669",
            "cell": "605-940-979",
            "id": {
                "name": "DNI",
                "value": "10031513-D"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/men/77.jpg",
                "medium": "https://randomuser.me/api/portraits/med/men/77.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/men/77.jpg"
            },
            "nat": "ES"
        },
        {
            "gender": "male",
            "name": {
                "title": "Mr",
                "first": "Jaber",
                "last": "Wolsink"
            },
            "location": {
                "street": {
                    "number": 8812,
                    "name": "Fugalaan"
                },
                "city": "Ijzendijke",
                "state": "Noord-Brabant",
                "country": "Netherlands",
                "postcode": 42430,
                "coordinates": {
                    "latitude": "-82.6211",
                    "longitude": "125.6068"
                },
                "timezone": {
                    "offset": "+10:00",
                    "description": "Eastern Australia, Guam, Vladivostok"
                }
            },
            "email": "jaber.wolsink@example.com",
            "login": {
                "uuid": "16c88bb2-f7a6-4f18-a917-0d514986d201",
                "username": "silverrabbit694",
                "password": "entry",
                "salt": "OMNsF2lH",
                "md5": "9dd3753e9a35078e2eec97e11d2a9aef",
                "sha1": "6507df85cf2a6d6edfab5e3b183c38a817dc350f",
                "sha256": "d04efb79fa97f14cc75d0e0ddc128826b53daebb2ce2d2e5dc495ca5baffcae6"
            },
            "dob": {
                "date": "1949-02-18T13:27:55.851Z",
                "age": 71
            },
            "registered": {
                "date": "2010-05-02T03:01:20.886Z",
                "age": 10
            },
            "phone": "(981)-139-2650",
            "cell": "(380)-517-6244",
            "id": {
                "name": "BSN",
                "value": "23947020"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/men/60.jpg",
                "medium": "https://randomuser.me/api/portraits/med/men/60.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/men/60.jpg"
            },
            "nat": "NL"
        },
        {
            "gender": "male",
            "name": {
                "title": "Mr",
                "first": "Nooa",
                "last": "Mantyla"
            },
            "location": {
                "street": {
                    "number": 2941,
                    "name": "Aleksanterinkatu"
                },
                "city": "Lieto",
                "state": "Finland Proper",
                "country": "Finland",
                "postcode": 16881,
                "coordinates": {
                    "latitude": "-24.9974",
                    "longitude": "93.2120"
                },
                "timezone": {
                    "offset": "+2:00",
                    "description": "Kaliningrad, South Africa"
                }
            },
            "email": "nooa.mantyla@example.com",
            "login": {
                "uuid": "34b25a8d-e401-41f9-8b48-d13fa1c95fd7",
                "username": "ticklishgoose365",
                "password": "konyor",
                "salt": "I1XwBRN5",
                "md5": "8892af8726c9ac343608ef76cdf63d60",
                "sha1": "f76d1298049a64a74eae19cae2dca649110b080c",
                "sha256": "a4478dc5b60e5b2a372aec707fb7b70e857fc21e57d8f2dd8e4c8ecbaddf4e82"
            },
            "dob": {
                "date": "1988-08-30T08:23:50.752Z",
                "age": 32
            },
            "registered": {
                "date": "2008-01-13T11:28:16.380Z",
                "age": 12
            },
            "phone": "06-782-343",
            "cell": "040-908-39-14",
            "id": {
                "name": "HETU",
                "value": "NaNNA677undefined"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/men/32.jpg",
                "medium": "https://randomuser.me/api/portraits/med/men/32.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/men/32.jpg"
            },
            "nat": "FI"
        },
        {
            "gender": "male",
            "name": {
                "title": "Mr",
                "first": "Graciano",
                "last": "da Luz"
            },
            "location": {
                "street": {
                    "number": 9214,
                    "name": "Rua Um"
                },
                "city": "Vespasiano",
                "state": "Roraima",
                "country": "Brazil",
                "postcode": 60832,
                "coordinates": {
                    "latitude": "65.4337",
                    "longitude": "-31.9053"
                },
                "timezone": {
                    "offset": "-10:00",
                    "description": "Hawaii"
                }
            },
            "email": "graciano.daluz@example.com",
            "login": {
                "uuid": "40adf342-c64f-4f73-92ff-3d9473da2528",
                "username": "happywolf198",
                "password": "entrance",
                "salt": "OhVrsFCc",
                "md5": "d5af742317d0470eb654ac59d7bc047b",
                "sha1": "97df81cd11b3c4ceb6ba075fc970aa59e945c0eb",
                "sha256": "390ebc29fef5da5e0c1e2ccc84ceb1646d81a4e29a051ef0175c89f000e75df8"
            },
            "dob": {
                "date": "1976-11-01T12:44:32.218Z",
                "age": 44
            },
            "registered": {
                "date": "2014-12-23T00:36:43.642Z",
                "age": 6
            },
            "phone": "(68) 7707-1711",
            "cell": "(35) 7174-5330",
            "id": {
                "name": "",
                "value": null
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/men/34.jpg",
                "medium": "https://randomuser.me/api/portraits/med/men/34.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/men/34.jpg"
            },
            "nat": "BR"
        },
        {
            "gender": "female",
            "name": {
                "title": "Miss",
                "first": "Sherri",
                "last": "Rodriquez"
            },
            "location": {
                "street": {
                    "number": 4796,
                    "name": "Wycliff Ave"
                },
                "city": "Tamworth",
                "state": "Queensland",
                "country": "Australia",
                "postcode": 4455,
                "coordinates": {
                    "latitude": "59.0734",
                    "longitude": "-157.2390"
                },
                "timezone": {
                    "offset": "+5:45",
                    "description": "Kathmandu"
                }
            },
            "email": "sherri.rodriquez@example.com",
            "login": {
                "uuid": "370c7e1e-4895-457b-9366-9781f53dab3f",
                "username": "purplebutterfly103",
                "password": "maxima",
                "salt": "Me6EeUO4",
                "md5": "378535568249b0d0aeeaf547570e55b1",
                "sha1": "2da61e3fed9842542bdedaf335ad2c394089b62a",
                "sha256": "8c80520609975261122973f567522cabc43fbc5c890b8880cd53b18b53399dfe"
            },
            "dob": {
                "date": "1962-02-18T02:44:56.096Z",
                "age": 58
            },
            "registered": {
                "date": "2008-12-04T03:01:43.516Z",
                "age": 12
            },
            "phone": "06-4381-7347",
            "cell": "0452-154-973",
            "id": {
                "name": "TFN",
                "value": "443808708"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/women/76.jpg",
                "medium": "https://randomuser.me/api/portraits/med/women/76.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/women/76.jpg"
            },
            "nat": "AU"
        },
        {
            "gender": "male",
            "name": {
                "title": "Mr",
                "first": "Mustafa",
                "last": "Limoncuoğlu"
            },
            "location": {
                "street": {
                    "number": 988,
                    "name": "Abanoz Sk"
                },
                "city": "Aksaray",
                "state": "Samsun",
                "country": "Turkey",
                "postcode": 14862,
                "coordinates": {
                    "latitude": "-48.4670",
                    "longitude": "140.6721"
                },
                "timezone": {
                    "offset": "+8:00",
                    "description": "Beijing, Perth, Singapore, Hong Kong"
                }
            },
            "email": "mustafa.limoncuoglu@example.com",
            "login": {
                "uuid": "32634a6d-ca6b-4fbb-9f18-f70fbf200628",
                "username": "brownkoala424",
                "password": "smiles",
                "salt": "YXRO7xCN",
                "md5": "00ebbc68aae5f1091c43f230ec5bee5d",
                "sha1": "0c98d46517b9ee040e683230f50130d597d40cc5",
                "sha256": "1e299889b2f08bdf0e7510efcedda6f26954b720c5e229c6b3953039b8c66f1d"
            },
            "dob": {
                "date": "1952-11-16T07:20:50.753Z",
                "age": 68
            },
            "registered": {
                "date": "2004-12-23T09:46:45.912Z",
                "age": 16
            },
            "phone": "(412)-078-3385",
            "cell": "(169)-849-8670",
            "id": {
                "name": "",
                "value": null
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/men/78.jpg",
                "medium": "https://randomuser.me/api/portraits/med/men/78.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/men/78.jpg"
            },
            "nat": "TR"
        },
        {
            "gender": "male",
            "name": {
                "title": "Mr",
                "first": "Jerzy",
                "last": "Worst"
            },
            "location": {
                "street": {
                    "number": 7176,
                    "name": "Kleigraversstraat"
                },
                "city": "Oudehorne",
                "state": "Overijssel",
                "country": "Netherlands",
                "postcode": 72114,
                "coordinates": {
                    "latitude": "-65.6812",
                    "longitude": "-55.8114"
                },
                "timezone": {
                    "offset": "-5:00",
                    "description": "Eastern Time (US & Canada), Bogota, Lima"
                }
            },
            "email": "jerzy.worst@example.com",
            "login": {
                "uuid": "1c66fee8-695a-4aa4-8d38-5cca179fd216",
                "username": "tinyzebra459",
                "password": "sssssss",
                "salt": "7l9x3MGW",
                "md5": "2835fff80cf4937776e0bc3af26caedf",
                "sha1": "cfd224b043543689cb06b3ec4fc61b246f14b789",
                "sha256": "2c5b1c2ce067dd81f89e5ed6f36cd8def2356df2a4c6bf800115b0451bbc3466"
            },
            "dob": {
                "date": "1946-08-28T03:13:50.909Z",
                "age": 74
            },
            "registered": {
                "date": "2018-08-30T20:30:47.931Z",
                "age": 2
            },
            "phone": "(901)-989-7003",
            "cell": "(361)-313-8219",
            "id": {
                "name": "BSN",
                "value": "44408225"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/men/86.jpg",
                "medium": "https://randomuser.me/api/portraits/med/men/86.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/men/86.jpg"
            },
            "nat": "NL"
        },
        {
            "gender": "female",
            "name": {
                "title": "Miss",
                "first": "Antonia",
                "last": "Van Koot"
            },
            "location": {
                "street": {
                    "number": 4828,
                    "name": "Dedelstraat"
                },
                "city": "Slagharen",
                "state": "Utrecht",
                "country": "Netherlands",
                "postcode": 73866,
                "coordinates": {
                    "latitude": "78.5592",
                    "longitude": "-73.2298"
                },
                "timezone": {
                    "offset": "+1:00",
                    "description": "Brussels, Copenhagen, Madrid, Paris"
                }
            },
            "email": "antonia.vankoot@example.com",
            "login": {
                "uuid": "a816d191-ca46-4645-b7b1-4064a9840721",
                "username": "goldenelephant442",
                "password": "southpar",
                "salt": "Ishmyc87",
                "md5": "301303e458d62a15df097431088dee28",
                "sha1": "7d5f2e6f8b1bf556a67b6bb6dd9e8f83b1d7ef6d",
                "sha256": "881474c00bce6cb656b1ffd2870510b756493c0503759cb9340f4a4149568bd8"
            },
            "dob": {
                "date": "1976-06-21T01:59:36.613Z",
                "age": 44
            },
            "registered": {
                "date": "2014-12-08T17:06:38.525Z",
                "age": 6
            },
            "phone": "(710)-808-5616",
            "cell": "(918)-871-9558",
            "id": {
                "name": "BSN",
                "value": "65952215"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/women/68.jpg",
                "medium": "https://randomuser.me/api/portraits/med/women/68.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/women/68.jpg"
            },
            "nat": "NL"
        },
        {
            "gender": "female",
            "name": {
                "title": "Miss",
                "first": "غزل",
                "last": "صدر"
            },
            "location": {
                "street": {
                    "number": 6786,
                    "name": "شهید کامبیز خشی"
                },
                "city": "سنندج",
                "state": "تهران",
                "country": "Iran",
                "postcode": 61918,
                "coordinates": {
                    "latitude": "9.6359",
                    "longitude": "122.0388"
                },
                "timezone": {
                    "offset": "+9:30",
                    "description": "Adelaide, Darwin"
                }
            },
            "email": "gzl.sdr@example.com",
            "login": {
                "uuid": "c57bae8d-64d5-459b-9447-60f0d5e279bb",
                "username": "greenbear420",
                "password": "carol",
                "salt": "aovqzMvP",
                "md5": "3654175ad72455097e93615648eeba75",
                "sha1": "ed0a9234c13c985cbbbf3717c49f3dc1d41ba30b",
                "sha256": "403592705d20d6e09087ecd5315107155b484eac9eba59a493b30ade2377a939"
            },
            "dob": {
                "date": "1957-01-04T03:51:33.143Z",
                "age": 63
            },
            "registered": {
                "date": "2011-02-22T05:49:39.852Z",
                "age": 9
            },
            "phone": "009-56789928",
            "cell": "0981-417-6741",
            "id": {
                "name": "",
                "value": null
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/women/17.jpg",
                "medium": "https://randomuser.me/api/portraits/med/women/17.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/women/17.jpg"
            },
            "nat": "IR"
        },
        {
            "gender": "male",
            "name": {
                "title": "Mr",
                "first": "Ertugrul",
                "last": "Verheijen"
            },
            "location": {
                "street": {
                    "number": 5691,
                    "name": "Krakenburgsestraat"
                },
                "city": "Enkhuizen",
                "state": "Limburg",
                "country": "Netherlands",
                "postcode": 14657,
                "coordinates": {
                    "latitude": "-75.0278",
                    "longitude": "-96.1497"
                },
                "timezone": {
                    "offset": "-12:00",
                    "description": "Eniwetok, Kwajalein"
                }
            },
            "email": "ertugrul.verheijen@example.com",
            "login": {
                "uuid": "741eefd9-a1c4-4487-856f-19b59ccc1c1b",
                "username": "happycat702",
                "password": "qweasd",
                "salt": "uwyBz5pR",
                "md5": "519b3ec27374ec87326c47b60e0c48dd",
                "sha1": "b7d2f39777dda8bb0eec3ff32c7c1b132116c173",
                "sha256": "618f81a51fe82d80c11f414c77069ed20b8f23d2844569d3cd6c0e25ec946cad"
            },
            "dob": {
                "date": "1981-06-26T16:24:41.365Z",
                "age": 39
            },
            "registered": {
                "date": "2014-03-04T04:38:13.975Z",
                "age": 6
            },
            "phone": "(791)-847-7619",
            "cell": "(091)-553-7766",
            "id": {
                "name": "BSN",
                "value": "36028920"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/men/95.jpg",
                "medium": "https://randomuser.me/api/portraits/med/men/95.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/men/95.jpg"
            },
            "nat": "NL"
        },
        {
            "gender": "female",
            "name": {
                "title": "Mrs",
                "first": "Tracey",
                "last": "Robertson"
            },
            "location": {
                "street": {
                    "number": 175,
                    "name": "Main Street"
                },
                "city": "Clonakilty",
                "state": "Laois",
                "country": "Ireland",
                "postcode": 70839,
                "coordinates": {
                    "latitude": "-57.6381",
                    "longitude": "-128.4054"
                },
                "timezone": {
                    "offset": "-3:30",
                    "description": "Newfoundland"
                }
            },
            "email": "tracey.robertson@example.com",
            "login": {
                "uuid": "59b2c795-5009-4dc4-87fd-7ea1e71cae99",
                "username": "crazymouse579",
                "password": "footjob",
                "salt": "IwMLCm0K",
                "md5": "6585a3fcfc374d88283726d4bbeffc23",
                "sha1": "4fd116d6c6226e8b18515086a6733d6c9a853a93",
                "sha256": "6c3ebfed54efa3633f00b076d7408d1c997ce209d8f90172dbfb3cbe305b0c4c"
            },
            "dob": {
                "date": "1986-11-25T06:11:09.357Z",
                "age": 34
            },
            "registered": {
                "date": "2009-06-30T12:44:40.163Z",
                "age": 11
            },
            "phone": "071-365-3276",
            "cell": "081-463-0690",
            "id": {
                "name": "PPS",
                "value": "6752125T"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/women/71.jpg",
                "medium": "https://randomuser.me/api/portraits/med/women/71.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/women/71.jpg"
            },
            "nat": "IE"
        },
        {
            "gender": "female",
            "name": {
                "title": "Mrs",
                "first": "Tatiana",
                "last": "Barros"
            },
            "location": {
                "street": {
                    "number": 787,
                    "name": "Avenida Brasil "
                },
                "city": "Volta Redonda",
                "state": "Santa Catarina",
                "country": "Brazil",
                "postcode": 99217,
                "coordinates": {
                    "latitude": "-74.8402",
                    "longitude": "-178.6073"
                },
                "timezone": {
                    "offset": "+2:00",
                    "description": "Kaliningrad, South Africa"
                }
            },
            "email": "tatiana.barros@example.com",
            "login": {
                "uuid": "56cb74d3-c67b-4942-87fc-4775e1dc1d6e",
                "username": "organicswan969",
                "password": "cannabis",
                "salt": "uDvcqHf4",
                "md5": "f1f2d1314c8a627ae852d230d089dfd9",
                "sha1": "0618763a8e479ab0dcc019370013aea94e19e799",
                "sha256": "a0a2b6f7b0ba5243f2613c546eb3bdaf0eaea5a1fff9851ed36e7a522c627cc6"
            },
            "dob": {
                "date": "1971-01-22T03:03:26.096Z",
                "age": 49
            },
            "registered": {
                "date": "2007-09-02T04:23:47.431Z",
                "age": 13
            },
            "phone": "(41) 8781-1097",
            "cell": "(89) 1119-2332",
            "id": {
                "name": "",
                "value": null
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/women/36.jpg",
                "medium": "https://randomuser.me/api/portraits/med/women/36.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/women/36.jpg"
            },
            "nat": "BR"
        },
        {
            "gender": "male",
            "name": {
                "title": "Mr",
                "first": "Christopher",
                "last": "Simmmons"
            },
            "location": {
                "street": {
                    "number": 7333,
                    "name": "South Street"
                },
                "city": "Leeds",
                "state": "Northumberland",
                "country": "United Kingdom",
                "postcode": "Y5 6YZ",
                "coordinates": {
                    "latitude": "-74.8000",
                    "longitude": "69.5277"
                },
                "timezone": {
                    "offset": "+3:30",
                    "description": "Tehran"
                }
            },
            "email": "christopher.simmmons@example.com",
            "login": {
                "uuid": "9d16da0d-cbae-457a-9375-22c7241bd46c",
                "username": "tinywolf530",
                "password": "goats",
                "salt": "D5n4nn0M",
                "md5": "b3f981937647c6c1e063861e34bb4f13",
                "sha1": "11296b59f0aac5aced3b2e437666427c832133c1",
                "sha256": "bf0d32e7ec7dcfcefc5d4295ea3e355b5bc56526bca06c2d6b5bce6113266f44"
            },
            "dob": {
                "date": "1966-06-29T12:44:33.869Z",
                "age": 54
            },
            "registered": {
                "date": "2013-05-24T15:35:32.676Z",
                "age": 7
            },
            "phone": "019467 05093",
            "cell": "0750-426-956",
            "id": {
                "name": "NINO",
                "value": "KJ 45 64 82 Z"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/men/87.jpg",
                "medium": "https://randomuser.me/api/portraits/med/men/87.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/men/87.jpg"
            },
            "nat": "GB"
        },
        {
            "gender": "female",
            "name": {
                "title": "Ms",
                "first": "Victoria",
                "last": "Mortensen"
            },
            "location": {
                "street": {
                    "number": 1407,
                    "name": "Vejlby Toften"
                },
                "city": "Randers Nø",
                "state": "Syddanmark",
                "country": "Denmark",
                "postcode": 44125,
                "coordinates": {
                    "latitude": "1.0666",
                    "longitude": "-111.9389"
                },
                "timezone": {
                    "offset": "-6:00",
                    "description": "Central Time (US & Canada), Mexico City"
                }
            },
            "email": "victoria.mortensen@example.com",
            "login": {
                "uuid": "afd6fd9c-0b67-4f4b-aaab-e3f6e98cdef6",
                "username": "crazymeercat616",
                "password": "waffle",
                "salt": "CoYDPw9z",
                "md5": "81ac009b255904a3c17e14d13b526027",
                "sha1": "75eee10e5c9e1e3418897ad081732ab5ad39105c",
                "sha256": "abde228bdf20e056c59595fb01486b7921673dbc23fc3f8712253178e8a833aa"
            },
            "dob": {
                "date": "1966-12-23T17:53:50.965Z",
                "age": 54
            },
            "registered": {
                "date": "2003-01-19T16:31:27.405Z",
                "age": 17
            },
            "phone": "20284640",
            "cell": "53926870",
            "id": {
                "name": "CPR",
                "value": "231266-6305"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/women/95.jpg",
                "medium": "https://randomuser.me/api/portraits/med/women/95.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/women/95.jpg"
            },
            "nat": "DK"
        },
        {
            "gender": "female",
            "name": {
                "title": "Miss",
                "first": "Pinja",
                "last": "Elo"
            },
            "location": {
                "street": {
                    "number": 4313,
                    "name": "Hämeenkatu"
                },
                "city": "Kyyjärvi",
                "state": "North Karelia",
                "country": "Finland",
                "postcode": 13710,
                "coordinates": {
                    "latitude": "-83.3282",
                    "longitude": "157.9945"
                },
                "timezone": {
                    "offset": "+5:30",
                    "description": "Bombay, Calcutta, Madras, New Delhi"
                }
            },
            "email": "pinja.elo@example.com",
            "login": {
                "uuid": "df02fdfb-0154-4b24-a5d3-2f7771d339ba",
                "username": "lazyfish641",
                "password": "beemer",
                "salt": "Qp1ttkI1",
                "md5": "450c526e135c0adefa610773242d3fab",
                "sha1": "92b89fb90e5f0aa6839fa3339a3a8d01876ff576",
                "sha256": "dc193a7e6374d6f17b7c53eea35d6b41dae080456b7d15c34bd2ff88983077cd"
            },
            "dob": {
                "date": "1947-03-01T23:06:42.822Z",
                "age": 73
            },
            "registered": {
                "date": "2005-07-14T11:57:15.451Z",
                "age": 15
            },
            "phone": "02-941-420",
            "cell": "045-386-33-06",
            "id": {
                "name": "HETU",
                "value": "NaNNA220undefined"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/women/5.jpg",
                "medium": "https://randomuser.me/api/portraits/med/women/5.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/women/5.jpg"
            },
            "nat": "FI"
        },
        {
            "gender": "male",
            "name": {
                "title": "Mr",
                "first": "Byron",
                "last": "Marshall"
            },
            "location": {
                "street": {
                    "number": 2138,
                    "name": "Park Lane"
                },
                "city": "Sligo",
                "state": "Sligo",
                "country": "Ireland",
                "postcode": 75322,
                "coordinates": {
                    "latitude": "-77.8244",
                    "longitude": "123.1753"
                },
                "timezone": {
                    "offset": "-7:00",
                    "description": "Mountain Time (US & Canada)"
                }
            },
            "email": "byron.marshall@example.com",
            "login": {
                "uuid": "0776ccb8-4136-40ff-9546-9bbc21d1d993",
                "username": "greenfrog367",
                "password": "smokey1",
                "salt": "U0waZbvV",
                "md5": "4c7a9e25c63927ce7fe343982689e12e",
                "sha1": "aade0a05c7c8df213883c6b559fb90b305231027",
                "sha256": "1959a9dfb8fbd5526fb535fd2670b2dc94811480001b4dda76585f79619bef25"
            },
            "dob": {
                "date": "1980-10-02T12:48:19.585Z",
                "age": 40
            },
            "registered": {
                "date": "2008-09-13T09:41:59.744Z",
                "age": 12
            },
            "phone": "051-900-8100",
            "cell": "081-482-9874",
            "id": {
                "name": "PPS",
                "value": "8708563T"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/men/95.jpg",
                "medium": "https://randomuser.me/api/portraits/med/men/95.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/men/95.jpg"
            },
            "nat": "IE"
        },
        {
            "gender": "female",
            "name": {
                "title": "Ms",
                "first": "Milla",
                "last": "Saksa"
            },
            "location": {
                "street": {
                    "number": 9882,
                    "name": "Visiokatu"
                },
                "city": "Kaustinen",
                "state": "Päijät-Häme",
                "country": "Finland",
                "postcode": 94180,
                "coordinates": {
                    "latitude": "34.5331",
                    "longitude": "156.3718"
                },
                "timezone": {
                    "offset": "+5:45",
                    "description": "Kathmandu"
                }
            },
            "email": "milla.saksa@example.com",
            "login": {
                "uuid": "2cdc3e88-cb8e-4843-a8b8-860ea8849035",
                "username": "smallkoala280",
                "password": "fidelio",
                "salt": "lVhMbtHU",
                "md5": "2f5f846456902dc2867b25b23277b541",
                "sha1": "14d3eebcf422f0a7c460a6f6d170fed184512eb0",
                "sha256": "28b7ee171b454a333a56b0122230ccdddd8457514fec336d5fceb0c1f8a3e06a"
            },
            "dob": {
                "date": "1979-04-24T11:17:57.600Z",
                "age": 41
            },
            "registered": {
                "date": "2002-10-21T08:14:09.504Z",
                "age": 18
            },
            "phone": "05-541-739",
            "cell": "043-431-15-76",
            "id": {
                "name": "HETU",
                "value": "NaNNA770undefined"
            },
            "picture": {
                "large": "https://randomuser.me/api/portraits/women/34.jpg",
                "medium": "https://randomuser.me/api/portraits/med/women/34.jpg",
                "thumbnail": "https://randomuser.me/api/portraits/thumb/women/34.jpg"
            },
            "nat": "FI"
        }
    ],
    "info": {
        "seed": "fc143351fe1e2872",
        "results": 27,
        "page": 1,
        "version": "1.3"
    }
}
router.get('/getStudentInfo', (req, res) => {
    Students.findById(req.query.id || "123456789", function (err, docs) {
        if (err) {
            res.json({ message: `faild to get user ,the error is :${err}` })
        }
        else
            if (docs._id !== null) {
                res.json({ student: docs });
            }
    });
});

router.post('/areYouStudent', (req, res) => {
    let refreshToken = req.body.RT
    if (refreshTokens.includes(refreshToken))
        return res.json({ status: 'yes' });
    return res.json({ status: 'no' });

});
module.exports = router;

