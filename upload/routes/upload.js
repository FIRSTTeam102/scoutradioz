const router = require('express').Router();
const multer = require('multer');
const logger = require('log4js').getLogger('upload');
const S3Storage = require('../helpers/S3Storage');
//const path = require('path');
const crypto = require('crypto');
const wrap = require('express-async-handler');

const AWS = require('aws-sdk');
const s3 = new AWS.S3();

const utilities = require('@firstteam102/scoutradioz-utilities');

logger.warn('Images will be uploaded to S3.');

var storage = S3Storage({
	s3: s3,
	bucket: process.env.S3_BUCKET,
	contentType: S3Storage.AUTO_CONTENT_TYPE,
	
	key: function (req, file, cb) {
		//const thisFuncName = 'S3Storage.opts.getKey: ';
		
		const bytes = crypto.pseudoRandomBytes(32);
		const checksum = crypto.createHash('MD5').update(bytes).digest('hex');
					
		const tier = process.env.TIER;
		const baseKey = process.env.S3_BASE_KEY;
		const year = new Date().getFullYear();
		let month = new Date().getMonth()+1;
		if (month < 10) month = '0'+month;
		
		const key = `${tier}/${baseKey}/${year}_${month}/${checksum}`;
		
		cb(null, key);
		
		/*
		console.log(req.query)
		
		if( fileKey && year && orgKey ){
			
			const filename = `${year}_${fileKey}`;
			
			const tier = process.env.TIER;
			const baseKey = process.env.S3_BASE_KEY;
			
			const key = `${tier}/${baseKey}/${orgKey}/${filename}`;
			
			logger.info(`s3 key=${key}`);
			
			cb(null, key);
			
		}
		//throw if key information is not specified in request
		else{
			
			logger.error(`File key and year are not specified.`)
			
			cb(new Error("File key, year, and org key need to be specified."));
		}*/
	},	
	acl: 'public-read',
	
	square: false,
	responsive: true,
	output: 'jpg',
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
	var thisFuncName = 'upload/image: ';
	//logger.debug(thisFuncName + "ENTER");
	logger.info(thisFuncName + 'Entering file filter');
	
	//supported image file mimetypes
	var allowedMimes = ['image/jpeg', 'image/pjpeg', 'image/png', 'image/gif'];
	
	if (allowedMimes.includes(file.mimetype)) {
		// allow supported image files
		cb(null, true);
	}
	else {
		// throw error for invalid files
		cb(new TypeError('Invalid file type. Only jpg, png and gif image files are allowed.'));
	}
	logger.debug(thisFuncName + 'DONE');
};

//create basic multer function upload
var upload = multer({
	storage: storage,
	limits: limits,
	fileFilter: fileFilter,
});

router.all('/*', wrap(async (req, res, next) => {
	
	logger.removeContext('funcName');
	next();
}));

router.get('/test', wrap(async (req, res) => {
	logger.addContext('funcName', 'testping[get]');
	logger.info('ENTER');
	
	res.status(200).send('Pong!');
}));

router.get('/ping', wrap(async (req, res) => {
	logger.addContext('funcName', 'ping[get]');
	logger.info('ENTER');
	
	res.status(200).send('Pong!');
}));

router.post('/ping', wrap(async (req, res) => {
	logger.addContext('funcName', 'ping[post]');
	logger.info('ENTER');
	
	res.status(200).send('Pong!');
}));

router.post('/image', wrap(async (req, res, next) => {
	logger.addContext('funcName', 'middleware[post]');
	logger.info('ENTER');
	
	logger.info('Hi, I\'m a middleware function!');
	
	next();
}));

router.post('/image', upload.single('image'), wrap(async (req, res, next) => {
	logger.addContext('funcName', 'image-after-upload[post]');
	logger.info('ENTER');
	
	logger.debug(`req.file=${JSON.stringify(req.file)}`);
	
	var locations = [];
	
	for(var i in req.file){
		if(req.file.hasOwnProperty(i)){
			var file = req.file[i];
			
			if(file && file.hasOwnProperty('location')) {
				locations.push(file.location);
			}
		}
	}
	
	if (req.file[0]) {
		var mainFile = req.file[0];
		
		const orgKey = req.query.org_key;
		const index = req.query.index;
		const year = req.query.year;
		const teamKey = req.query.team_key;
		const userId = req.query.user;
		const useragent = req.shortagent;
		const uploadTime = Date.now();
		const s3Key = mainFile.key;
		
		const user = await utilities.findOne('users', {_id: userId});
		var userName;
		
		if (user) {
			userName = user.name;
		}
		else {
			logger.error('Could not find user in db; setting to undefined');
			userName = 'Undefined';
		}
		
		const data = {
			org_key: orgKey,
			year: parseInt(year),
			team_key: teamKey,
			uploader: {
				name: userName,
				id: userId,
				useragent: useragent,
				upload_time: uploadTime
			},
			s3_key: s3Key,
			index: parseInt(index),
			removed: false,
		};
		
		logger.info(`Upload complete; data=${JSON.stringify(data)}`);
		
		await utilities.insert('uploads', data);
		
	}
	
	res.status(200).send(locations);
	
}));

module.exports = router;