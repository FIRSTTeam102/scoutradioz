const express = require('express');
const router = express.Router();

//import multer and the AvatarStorage engine
const _ = require('lodash');
const multer = require('multer');
const AvatarStorage = require('../helpers/AvatarStorage');

var storageMethod;

if( process.env.UPLOAD_LOCAL == "false" ){
    
    storageMethod = "s3";
    console.log("Images will be uploaded to S3. To upload to local filesystem, set process.env.UPLOAD_LOCAL=true.")
}
else{
    
    storageMethod = "local"
    console.log("Images will be uploaded to local filesystem. To upload to S3, set process.env.UPLOAD_LOCAL=false." );
}

//create AvatarStorage object with our own parameters
var storage = AvatarStorage({
    storage: storageMethod,
    square: false,
    responsive: true,
    output: "jpg",
    greyscale: false,
    quality: 60,
    threshold: 500
});

//create image limits (10MB max)
var limits = {
    files: 1, // allow only 1 file per request
    fileSize: 10 * 1024 * 1024, // 10 MB (max file size)
};

//file filter to guarantee filetype is image
var fileFilter = function (req, file, cb) {
    
    console.log("Entering file filter");
    
    //supported image file mimetypes
    var allowedMimes = ['image/jpeg', 'image/pjpeg', 'image/png', 'image/gif'];

    if (_.includes(allowedMimes, file.mimetype)) {
        // allow supported image files
        cb(null, true);
    } else {
        // throw error for invalid files
        cb(new Error('Invalid file type. Only jpg, png and gif image files are allowed.'));
    }
};

//create basic multer function upload
var upload = multer({
    storage: storage,
    limits: limits,
    fileFilter: fileFilter
}).any();


router.post('/ping', async function(req, res) {
    
    res.status(200).send({message:"Pong!"});
    
});

router.post('/image*', function (req, res, next) {
    
    var team_key = req.query.team_key;
    
    res.log("going to upload");
    
    var year = 2019;
    
    req.baseFilename = year + "_" + team_key;
    
    upload(req, res, function (e) {
        
        console.log("req.file=" + JSON.stringify(req.file));
        
        res.status(200).send({message:"We're back!"});
    });
});


module.exports = router;