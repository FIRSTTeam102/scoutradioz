const router = require('express').Router();
const _ = require('lodash');
const multer = require('multer');
const logger = require('log4js').getLogger();
const S3Storage = require('../helpers/S3Storage');
const crypto = require('crypto');

const AWS = require('aws-sdk');
const s3 = new AWS.S3();

logger.warn("Images will be uploaded to S3.");

var storage = S3Storage({
    s3: s3,
    bucket: process.env.S3_BUCKET,
    contentType: S3Storage.AUTO_CONTENT_TYPE,
	
	key: function (req, file, cb) {
		const thisFuncName = 'S3Storage.opts.getKey: ';
		
		//const bytes = crypto.pseudoRandomBytes(32);
		//const checksum = crypto.createHash('MD5').update(bytes).digest('hex');
		
		const fileKey = req.query.key;
		const year = req.query.year;
		const orgKey = req.query.org_key;
		
		console.log(req.query)
		
		if( fileKey && year && orgKey ){
			
			const filename = `${year}_${fileKey}`;
			
			const tier = process.env.TIER;
			const baseKey = process.env.S3_BASE_KEY;
			
			const key = `${tier}/${baseKey}/${orgKey}/${filename}`;
			
			logger.info(`${thisFuncName} s3 key=${key}`);
			
			cb(null, key);
			
		}
		//throw if key information is not specified in request
		else{
			
			logger.error(`${thisFuncName} File key and year are not specified.`)
			
			cb(new Error("File key, year, and org key need to be specified."));
		}
		/*				
		const fileKey = req.query.key;
		const year = req.query.year;
		
		if( fileKey && year ){
			
			const filename = `${year}_${fileKey}`;
			
			const tier = process.env.TIER;
			const baseKey = process.env.S3_BASE_KEY;
			
			const key = `${tier}/${baseKey}/${filename}`;
			
			logger.info(`${thisFuncName} s3 key=${key}`);
			
			cb(null, key);
			
		}
		//throw if key information is not specified in request
		else{
			
			logger.error(`${thisFuncName} File key and year are not specified.`)
			
			cb(new Error("File key and year need to be specified."));
		}*/	
	},	
	acl: "public-read",
	
	square: false,
	responsive: true,
	output: "jpg",
	greyscale: false,
	quality: 60,
	threshold: 500,
});

//create image limits (10MB max)
var limits = {
	files: 1, // allow only 1 file per request
	fileSize: 10 * 1024 * 1024, // 10 MB (max file size)
};

//file filter to guarantee filetype is image
var fileFilter = function (req, file, cb) {
	var thisFuncName = "upload/image: ";
	//logger.debug(thisFuncName + "ENTER");
	logger.info(thisFuncName + "Entering file filter");
	
	//supported image file mimetypes
	var allowedMimes = ['image/jpeg', 'image/pjpeg', 'image/png', 'image/gif'];

	if (_.includes(allowedMimes, file.mimetype)) {
		// allow supported image files
		cb(null, true);
	} else {
		// throw error for invalid files
		cb(new TypeError('Invalid file type. Only jpg, png and gif image files are allowed.'));
	}
	logger.debug(thisFuncName + "DONE");
};

//create basic multer function upload
var upload = multer({
	storage: storage,
	limits: limits,
	fileFilter: fileFilter,
});

router.get('/ping', async function(req, res) {
	
	res.status(200).send("Pong!");
});

router.post('/ping', async function(req, res) {
	
	res.status(200).send("Pong!");
});

router.post('/image', async (req, res, next) => {
	
	logger.info('Hi, I\'m a middleware function!');
	
	next();
});

router.post('/image', upload.single("image"), async (req, res, next) => {
	
	logger.info(`upload/image post-upload: req.file=${JSON.stringify(req.file)}`);
	
	var locations = [];
	
	for(var i in req.file){
		if(req.file.hasOwnProperty(i)){
			var file = req.file[i];
			
			if(file && file.hasOwnProperty("location")) {
				locations.push(file.location);
			}
		}
	}
	
	if (req.file[0]) {
		var mainFile = req.file[0];
		
	}
	
	res.status(200).send(locations);
	
});

module.exports = router;