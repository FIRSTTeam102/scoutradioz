//Load dependencies
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const crypto = require('crypto');
const mkdirp = require('mkdirp');
const concat = require('concat-stream');
const streamifier = require('streamifier');
const pify = require('pify');

const AWS = require('aws-sdk');
const s3 = new AWS.S3({
	//accessKeyId: process.env.AWS_ACCESS_KEY_,
	//secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_
});

const isDebug = true;

//Configure UPLOAD_PATH
//process.env.AVATAR_STORAGE contains uploads/avatars
const UPLOAD_PATH = path.resolve(__dirname, '..', process.env.AVATAR_STORAGE) + "\\";
console.log("AvatarStorage: UPLOAD_PATH = ".cyan + UPLOAD_PATH.cyan);

const S3_URL = process.env.AVATAR_S3_URL;

//create a multer storage engine
var AvatarStorage = function(options) {
	
	//this serves as a constructor
	function AvatarStorage(opts) {
		var thisFuncName = "AvatarStorage|constructor: ";
		if (isDebug) console.log(thisFuncName + "ENTER opts=" + opts);

		var baseUrl = process.env.AVATAR_BASE_URL;
		
		var allowedStorageSystems = ['local', 'remote'];
		var allowedOutputFormats = ['jpg', 'png'];
		
		//fallback for the options
		var defaultOptions = {
			storage: 'local',
			output: 'png',
			greyscale: false,
			quality: 70,
			square: true,
			threshold: 500,
			responsive: false,
		};
		
		//extend default options with passed options
		var options = (opts && _.isObject(opts)) ? _.pick(opts, _.keys(defaultOptions)) : {};
		options = _.extend(defaultOptions, options);
		
		//check the options for correct values and use fallback value where necessary
		this.options = _.forIn(options, function(value, key, object) {
		
			switch (key) {
				case 'square':
				case 'greyscale':
				case 'responsive':
					object[key] = _.isBoolean(value) ? value : defaultOptions[key];
					break;
				case 'storage':
					value = String(value).toLowerCase();
					object[key] = _.includes(allowedStorageSystems, value) ? value : defaultOptions[key];
					break;
				case 'output':
					value = String(value).toLowerCase();
					object[key] = _.includes(allowedOutputFormats, value) ? value : defaultOptions[key];
					break;
				case 'quality':
					value = _.isFinite(value) ? value : Number(value);
					object[key] = (value && value >= 0 && value <= 100) ? value : defaultOptions[key];
					break;
				case 'threshold':
					value = _.isFinite(value) ? value : Number(value);
					object[key] = (value && value >= 0) ? value : defaultOptions[key];
					break;
			}
		});
		
		//set the upload path
		this.uploadPath = this.options.responsive ? path.join(UPLOAD_PATH, 'responsive') : UPLOAD_PATH;
		
		//set the upload base url
		this.uploadBaseUrl = this.options.responsive ? path.join(baseUrl, 'responsive') : baseUrl;
		
		//set the S3 upload path
		this.s3UploadPath = this.options.responsive ? S3_URL + "/responsive" : S3_URL;
		
		console.log(`${thisFuncName}Storage option: ${this.options.storage}`);
		
		if (this.options.storage == 'local') {
			//if upload path does not exist, create the upload path structure
			!fs.existsSync(this.uploadPath) && mkdirp.sync(this.uploadPath);
		}
		else{
			console.log(thisFuncName + "Not local!");
		}
		if (isDebug) console.log(thisFuncName + "DONE");
	}
	
	//this generates a random cryptographic filename
	AvatarStorage.prototype._generateRandomFilename = function() {
		var thisFuncName = "AvatarStorage._generateRandomFilename: ";
		if (isDebug) console.log(thisFuncName + "ENTER");
		
		//create pseudo random bytes
		var bytes = crypto.pseudoRandomBytes(32);//error here
		
		//create the md5 hash of the random bytes
		var checksum = crypto.createHash('MD5').update(bytes).digest('hex');
		
		//return as filename the hash with the output extension
		if (isDebug) console.log(thisFuncName + "DONE - checksum=" + checksum);
		return checksum + '.' + this.options.output;
	}
	

	AvatarStorage.prototype._generateFilename = function(baseFilename) {
		var thisFuncName = "AvatarStorage._generateFilename: ";
		if (isDebug) console.log(thisFuncName + "ENTER baseFilename=" + baseFilename);

		var imgFilename = baseFilename + '.' + this.options.output;

		if (isDebug) console.log(thisFuncName + "DONE - imgFilename=" + imgFilename);
		return imgFilename;
	}


	//this creates a Writable stream for a filepath
	AvatarStorage.prototype._createOutputStream = function(filepath, cb) {
		var thisFuncName = "AvatarStorage._createOutputStream: ";
		if (isDebug) console.log(thisFuncName + "ENTER filepath=" + filepath + ",cb=" + (typeof cb));
		
		//create a reference for this to use in local functions
		var that = this;
		
		//create a writable stream from the filepath
		var output = fs.createWriteStream(filepath);
		
		//set callback fn as handler for the error event
		output.on('error', cb);
		
		//set handler for the finish event
		output.on('finish', function() {
			cb(null, {
				destination: that.uploadPath,
				baseUrl: that.uploadBaseUrl,
				filename: path.basename(filepath),
				storage: that.options.storage
			});
		});
		
		//return the output stream
		if (isDebug) console.log(thisFuncName + "DONE - output=" + output);
		return output;
	}

	//this processes the Jimp image buffer
	AvatarStorage.prototype._processImage = async function(image, baseFilename, cb) {
		var thisFuncName = "AvatarStorage._processImage: ";
		if (isDebug) console.log(thisFuncName + "ENTER image=" + image + ",baseFilename=" + baseFilename + ",cb=" + (typeof cb));
		
		//STEP 02
		
		console.log(thisFuncName + "Processing image");
		
		//create a reference for this to use in local functions
		var that = this;
		
		var batch = [];
		
		//the responsive sizes
		var sizes = ['lg', 'md', 'sm'];
		var filename = this._generateRandomFilename();
		if (baseFilename) {
			filename = this._generateFilename(baseFilename);
		}
		if (isDebug) console.log(thisFuncName + "filename=" + filename);

		var mime = Jimp.MIME_PNG;
		
		//create a clone of the Jimp image
		var clone = image.clone();
		
		//fetch the Jimp image dimensions
		var width = clone.bitmap.width;
		var height = clone.bitmap.height;
		var square = Math.min(width, height);
		var rectangle = Math.max(width, height);
		var threshold = this.options.threshold;
		
		//resolve the Jimp output mime type
		switch (this.options.output) {
			case 'jpg':
				mime = Jimp.MIME_JPEG;
				break;
			case 'png':
				default:
				mime = Jimp.MIME_PNG;
			break;
		}
		
		//auto scale the image dimensions to fit the threshold requirement
		if (threshold && square > threshold) {
			clone = (square == width) ? clone.resize(threshold, Jimp.AUTO) : clone.resize(Jimp.AUTO, threshold);
		} else {
			clone = (square == width) ? clone.resize(threshold, Jimp.AUTO) : clone.resize(Jimp.AUTO, threshold);
		}
		
		console.log(thisFuncName + "threshold="+threshold+", square="+square+", rectangle="+rectangle);

		//crop the image to a square if enabled
		if (this.options.square) {
			
			if (threshold) {
				square = Math.min(square, threshold);
			}
			
			//fetch the new image dimensions and crop
			clone = clone.crop((clone.bitmap.width - square) / 2, (clone.bitmap.height - square) / 2, square, square);
		}
		
		//convert the image to greyscale if enabled
		if (this.options.greyscale) {
			clone = clone.greyscale();
		}
		
		//set the image output quality
		clone = clone.quality(this.options.quality);
		
		if (this.options.responsive) {
			
			//map through the responsive sizes and push them to the batch
			batch = _.map(sizes, function(size) {
			
				var outputStream;
				
				var image = null;
				var filepath = filename.split('.');
				
				//create the complete filepath and create a writable stream for it
				filepath = filepath[0] + "_" + size + '.' + filepath[1];
				console.log(thisFuncName + "filepath=" + filepath)
				filepath = path.join(that.uploadPath, filepath);
				outputStream = that._createOutputStream(filepath, cb);
				
				//scale the image based on the size
				switch (size) {
					case 'sm':
						image = clone.clone().scale(0.3);
						break;
					case 'md':
						image = clone.clone().scale(0.7);
						break;
					case 'lg':
						image = clone.clone();
						break;
				}
				
				//return an object of the stream and the Jimp image
				return {
					stream: outputStream,
					image: image
				};
			});
		}
		else{
			//push an object of the writable stream and Jimp image to the batch
			batch.push({
				stream: that._createOutputStream(path.join(that.uploadPath, filename), cb),
				image: clone
			});
		}

		var batchPromises = [];

		//process the batch sequence
		for (var i = 0; i < batch.length; i++)
		{
			var current = batch[i];
		// _.each(batch, function(current) {
			//get the buffer of the Jimp image using the output mime type
			if (isDebug) console.log(thisFuncName + "current.image=" + current.image);

			var buffer = await current.image.getBufferAsync(mime);
			
			//current.image.getBuffer(mime, async function(err, buffer) {
				
				if( that.options.storage == 'local' ){
					//create a read stream from the buffer and pipe it to the output stream
					streamifier.createReadStream(buffer).pipe(current.stream);
				}
				else if( that.options.storage == 's3' ){
					
					//S3 BATCH SEQUENCE PROCESS
					//if (isDebug) console.log(thisFuncName + "Attempting to upload buffer to S3");
					
					let file_name = path.basename(current.stream.path);
					
					//Create S3 key (path after bucket)
					const key = `${process.env.TIER}/${that.s3UploadPath}/${file_name}`;
					
					const contentType = that.options.output;
					
					const params = {
						Bucket: process.env.S3_BUCKET,
						Key: key,
						Body: buffer,
						ContentType: contentType,
						ACL: "public-read"
					}
					
					var url = s3.getSignedUrl('putObject', params);
					//if (isDebug) console.log(thisFuncName + 'The URL is ' + url);
					
					let startTime = Date.now();
					
					//upload to S3
					console.log(thisFuncName + "before data{upload}");

					// s3.upload(params, function(s3err, data){
					// 	if(s3err){ console.log(s3err); }
					// 	console.log(thisFuncName + "data{upload}=" + JSON.stringify(data) + `; Object has been put after ${Date.now() - startTime} ms`);
					// });

					// var data = await s3.upload(params).promise();
					// console.log(thisFuncName + "data{upload}=" + JSON.stringify(data) + `; Object has been put after ${Date.now() - startTime} ms`);

					//console.log(thisFuncName + "data{upload}=" + (typeof data) + `; Object has been put after ${Date.now() - startTime} ms`);

					await doUpload(key, buffer, contentType);
					console.log(thisFuncName + "after data{upload}");
					
					// s3.waitFor('objectExists', {Bucket: params.Bucket, Key: params.Key}, function(err, data) {
					// 	if (err) console.log(err, err.stack); // an error occurred
					// 	else     console.log(thisFuncName + "data{waitFor}=" + JSON.stringify(data));           // successful response
					// });
					
					/*
					
					console.log(key);
					
					const params = {
						Bucket: process.env.S3_BUCKET,
						Key: key,
						Body: buffer,
						ACL: "public-read"
					}
					
					console.log(params);
					
					s3.upload(params, function(s3err, data){
						
						if(s3err){ console.log(s3err); }
						
						console.log(data);
					});
					
					//Now that we've done the hacky S3 upload, run callback function
					*/
					cb(null);
				}
			//});
		//});
		}
		
		// const key = "hackyhack.txt";
		
		// const params = {
		// 	Bucket: process.env.S3_BUCKET,
		// 	Key: key,
		// 	Body: "hello",
		// 	ContentType: "text",
		// 	ACL: "public-read"
		// }
		
		// //upload hacky-ass extra thing to S3 to trigger the other uploads
		// s3.upload(params, function(s3err, data){
			
		// 	if(s3err){ console.log(s3err); }
			
		// 	console.log(thisFuncName + "data{upload2}=" + data);
		// });
		
		cb(null);

		if (isDebug) console.log(thisFuncName + "DONE");
	}

	//multer requires this for handling the uploaded file
	AvatarStorage.prototype._handleFile = async function(req, file, cb) {
		var thisFuncName = "AvatarStorage._handleFile: ";
		if (isDebug) console.log(thisFuncName + "ENTER req=" + req + ",file=" + file + ",cb=" + (typeof cb));
		
		//STEP 01
		
		//create a reference for this to use in local functions
		var that = this;
		
		//create a writable stream using concat-stream that will
		//concatenate all the buffers written to it and pass the
		//complete buffer to a callback fn
		var fileManipulate = concat(function(imageData) {
		
		//read the image buffer with Jimp
		//it returns a promise
		Jimp.read(imageData)
			.then(function(image) {
				//process the Jimp image buffer
				that._processImage(image, req.baseFilename, cb);
			})
			.catch(cb);
		});
		
		//write the uploaded file buffer to the fileManipulate stream
		file.stream.pipe(fileManipulate);

		if (isDebug) console.log(thisFuncName + "DONE");
	}

	//multer requires this for destroying file
	AvatarStorage.prototype._removeFile = function(req, file, cb) {
		var thisFuncName = "AvatarStorage._removeFile: ";
		if (isDebug) console.log(thisFuncName + "ENTER req=" + req + ",file=" + file + ",cb=" + (typeof cb));
		
		console.log(thisFuncName + "Removing file");
		
		var matches, pathsplit;
		var filename = file.filename;
		var _path = path.join(this.uploadPath, filename);
		var paths = [];
		
		//delete the file properties
		delete file.filename;
		delete file.destination;
		delete file.baseUrl;
		delete file.storage;
		
		//create paths for responsive images
		if (this.options.responsive) {
			pathsplit = _path.split('/');
			matches = pathsplit.pop().match(/^(.+?)_.+?\.(.+)$/i);
			
			if (matches) {
				paths = _.map(['lg', 'md', 'sm'], function(size) {
					return pathsplit.join('/') + '/' +
						(matches[1] + '_' + size + '.' + matches[2]);
				});
			}
		} else {
			paths = [_path];
		}
		
		//delete the files from the filesystem
		_.each(paths, function(_path) {
			fs.unlink(_path, cb);
		});

		if (isDebug) console.log(thisFuncName + "DONE");
	}
	
	//create a new instance with the passed options and return it
	return new AvatarStorage(options);
};

async function doUpload(key, buffer, contentType) {
	var thisFuncName = "AvatarStorage.doUpload: ";
	if (isDebug) console.log(thisFuncName + "ENTER key=" + key + ",buffer=" + (typeof buffer) + ",contentType=" + contentType);

	try {
		const params = {
			Bucket: process.env.S3_BUCKET,
			Key: key,
			Body: buffer,
			ContentType: contentType,
			ACL: "public-read"
		}
		var data = await s3.upload(params).promise();
		console.log(thisFuncName + "data{uploadX}=" + JSON.stringify(data));
		// var data = await s3.upload(params);
		// console.log(thisFuncName + "data{uploadX}=" + (typeof data));
	} catch (err) {
		console.log('err: ', err);
	}

	if (isDebug) console.log(thisFuncName + "DONE");
}

//export the storage engine
module.exports = AvatarStorage;