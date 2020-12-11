const router = require('express').Router();
const bcrypt = require("bcrypt");
let Info = require('../models/info.model');
const jwt = require('jsonwebtoken');

router.post('/giveme',(req,res)=>{//test for me to check deleting information
    Info.findById({ _id: req.body._id })
    .then(infoo=>{
        res.json({message:infoo})
    });

})
router.post('/add', (req, res) => {
    Info.find({ id: req.body.id, date: req.body.date })
        .then(infos => {
            if (infos.length) {
                res.json({ message: "There are same information in the DB" })
            } else {
                let info = new Info({
                    id: req.body.id,
                    date: req.body.date,
                    was: req.body.was
                });
                info.save()
                    .then((curr) => {// cuur will be the new saved object
                        res.json({ message: "Information added",_id:curr._id});
                    })
                    .catch((err) => {
                        res.json({ message: err });
                    })
            }
        })
        .catch(err => { console.log(err) });
});

router.delete('/', (req, res) => {
    let id = req.query.id;
    Info.findByIdAndDelete(id, (err, succ) => {
        if (err) {
            res.json({ message: "faild to delete this information" });
        } else {
            res.json({ message: "Succsefully deleted" })
        }
    })
});

router.put('/', (req, res) => {
    Info.findById({ _id: req.body.idd })
        .then(inf => {
            inf.id= req.body.id || inf.id;
            inf.date = req.body.date || inf.date;
            inf.was = req.body.was || inf.was;
            inf.save()
                .then(() => res.json({ message: "updated info" }))
                .catch(() => res.json({ message: "faild while updating" }));
        })
        .catch(err => {
            console.log(err);
            res.json({ message: "faild" })
        })
})

router.post('/attendances', (req, res) => {
    Info.find({ id: req.body.id })
        .then((studentAtt) => {
            res.json({ info: studentAtt })
        })
        .catch((err) => {
            err.json({ message: "faild to get information" })
        })
})
module.exports = router;

