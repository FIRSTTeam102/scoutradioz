var express = require('express');
var router = express.Router();


//import multer and the AvatarStorage engine
var _ = require('lodash');
var path = require('path');
var multer = require('multer');
var AvatarStorage = require('../helpers/AvatarStorage');

//create AvatarStorage object with our own parameters
var storage = AvatarStorage({
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
var fileFilter = function(req, file, cb) {
    
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
}).single("avatarfield");

/**
 * Image storage and retrieval page. Meant to help with image down- & up-loads to the main directory
 * @url /image
 * @view image/test
 */
router.get('/', function(req, res, next) {
    // res.render('index', { title: 'Upload Avatar', avatar_field: process.env.AVATAR_FIELD });
    //This stuff works
    res.render('./image/test',{
        title: "Image Testing Page",
        avatar_field: process.env.AVATAR_FIELD
    });
});

/**
 * POST: Image upload page for pit scouting. 
 * @url /image/upload
 * @param (query) team_key
 * @param (post) avatarfield, used in upload
 * @redirect /scouting/pit?team=team_key
 */
router.post('/upload*', function(req, res, next) {
    
    var team_key = req.query.team_key;
    res.log("going to upload");
    console.log("going to upload");
    var true_key = "init value";
    if (team_key.charAt(team_key.length-1) == 'a' || team_key.charAt(team_key.length-1) == 'b' || team_key.charAt(team_key.length-1) == 'c') {
    true_key = team_key.slice(0, team_key.length-1);
    console.log(true_key);
    }
    else {
        true_key = team_key;
    }
    var year = req.event.year;
    req.baseFilename = year + "_" + team_key;
    upload(req, res, function(e){
        console.log(team_key);
        console.log("_________________________________________________________________");
        console.log("req.file="+JSON.stringify(req.file));
        res.redirect("/scouting/pit?team=" + true_key);
        console.log(true_key);
    });
    
    res.log("called upload");
});

module.exports = router;

// ||\\  ||  //||||\\  ||||\\    ||||||||      ||||||||  /|||||||
// || \\ ||  ||    ||  ||   \\   ||               ||     ||
// ||  \\||  ||    ||  ||    \\  |||||            ||     \||||||\
// ||   \\|  ||    ||  ||    //  ||               ||           ||
// ||    ||  ||    ||  ||   //   ||               ||           ||
// ||    ||  \\||||//  ||||//    ||||||||  ||  ||||/     |||||||/
//
//
//...because why not