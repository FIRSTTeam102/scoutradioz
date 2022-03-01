/**
 * This Multer storage engine is a modified version of badunk's "multer-s3" package.
 * Its license is provided at the bottom of this file.
 */

var crypto = require('crypto');
var stream = require('stream');
var fileType = require('file-type');
var parallel = require('run-parallel');

const Jimp = require('jimp');
const concat = require('concat-stream');
const logger = require('log4js').getLogger('S3Storage');
const { Upload } = require('@aws-sdk/lib-storage');
const { S3Client } = require('@aws-sdk/client-s3');

logger.level = process.env.LOG_LEVEL || 'debug';

function staticValue (value) {
	return function (req, file, cb) {
		cb(null, value);
	};
}
	
const sizes = ['lg', 'md', 'sm'];

var defaultAcl = staticValue('private');
var defaultContentType = staticValue('application/octet-stream');

//from multer-s3
var defaultMetadata = staticValue(undefined);
var defaultCacheControl = staticValue(undefined);
var defaultContentDisposition = staticValue(undefined);
var defaultStorageClass = staticValue('STANDARD');
var defaultSSE = staticValue(undefined);
var defaultSSEKMS = staticValue(undefined);
//from AvatarStorage
var defaultOutput = staticValue('png');
var defaultGreyscale = staticValue(false);
var defaultQuality = staticValue(70);
var defaultSquare = staticValue(true);
var defaultThreshold = staticValue(500);
var defaultResponsive = staticValue(false);

function defaultKey (req, file, cb) {
	crypto.randomBytes(16, function (err, raw) {
		cb(err, err ? undefined : raw.toString('hex'));
	});
}

function autoContentType (req, file, cb) {
	file.stream.once('data', async function (firstChunk) {
		// var type = fileType(firstChunk);
		// var type = fileType.fromStream(file.stream);
		var type = await fileType.fromBuffer(firstChunk);
		console.log(type);
		var mime;

		if (type && type.mime) {
			mime = type.mime;
		}
		else {
			mime = 'application/octet-stream';
		}
		
		var outStream = new stream.PassThrough();

		outStream.write(firstChunk);
		file.stream.pipe(outStream);

		cb(null, mime, outStream);
	});
}

function collect (storage, req, file, cb) {
	parallel([
		storage.getBucket.bind(storage, req, file),
		storage.getKey.bind(storage, req, file),
		storage.getAcl.bind(storage, req, file),
		storage.getMetadata.bind(storage, req, file),
		storage.getCacheControl.bind(storage, req, file),
		storage.getContentDisposition.bind(storage, req, file),
		storage.getStorageClass.bind(storage, req, file),
		storage.getSSE.bind(storage, req, file),
		storage.getSSEKMS.bind(storage, req, file),
		
		storage.getOutput.bind(storage, req, file),
		storage.getGreyscale.bind(storage, req, file),
		storage.getQuality.bind(storage, req, file),
		storage.getSquare.bind(storage, req, file),
		storage.getThreshold.bind(storage, req, file),
		storage.getResponsive.bind(storage, req, file),
	], function (err, values) {
		if (err) return cb(err);

		storage.getContentType(req, file, function (err, contentType, replacementStream) {
			if (err) return cb(err);

			cb.call(storage, null, {
				bucket: values[0],
				key: values[1],
				acl: values[2],
				metadata: values[3],
				cacheControl: values[4],
				contentDisposition: values[5],
				storageClass: values[6],
				contentType: contentType,
				replacementStream: replacementStream,
				serverSideEncryption: values[7],
				sseKmsKeyId: values[8],
				
				output: values[9],
				greyscale: values[10],
				quality: values[11],
				square: values[12],
				threshold: values[13],
				responsive: values[14],
			});
		});
	});
}

function processImage (opts, cb) {
	logger.addContext('funcName', 'processImage');
	var thisFuncName = 'S3Storage/processImage: ';
	
	logger.debug(`ENTER key=${opts.key}`);
	
	logger.trace(opts);
	
	let batch = [];
	const key = opts.key;
		
	const concatFile = concat(imageData => {
		
		logger.trace(`imageData=${imageData}`);
	
		Jimp.read(imageData)
			.then(async image => {
				
				var mime;
				
				if (opts.output == 'jpg') {
					mime = Jimp.MIME_JPEG;
				}
				else if (opts.output == 'png'){
					mime = Jimp.MIME_PNG;
				}
				else{
					throw new TypeError('S3Storage output should be either jpg or png.');
				}
	
				//create a clone of the Jimp image
				var clone = image.clone();
				
				//fetch the Jimp image dimensions
				var width = clone.bitmap.width;
				var height = clone.bitmap.height;
				logger.debug(thisFuncName + 'width=' + width + ', height=' + height);
				
				var square = Math.min(width, height);
				var rectangle = Math.max(width, height);
				var threshold = opts.threshold;
				logger.trace(thisFuncName + 'threshold='+threshold+', square='+square+', rectangle='+rectangle+', width='+width+', height='+height);						
				
				// Auto scale the image dimensions to fit the threshold requirement
				if (threshold && square > threshold) {
					clone = (square == width) ? clone.resize(threshold, Jimp.AUTO) : clone.resize(Jimp.AUTO, threshold);
				}
				else {
					clone = (square == width) ? clone.resize(threshold, Jimp.AUTO) : clone.resize(Jimp.AUTO, threshold);
				}
				
				// For square image
				if (opts.square) {
					logger.debug('Cropping image to square');
					if (threshold) square = Math.min(square, threshold);
					clone = clone.crop((clone.bitmap.width - square) / 2, (clone.bitmap.height - square) / 2, square, square);
				}
				
				// For greyscale image
				if (opts.greyscale) {
					logger.debug('Converting image to greyscale');
					clone = clone.greyscale();
				}
				
				// For output quality
				logger.debug(`Setting quality to ${opts.quality}`);
				clone = clone.quality(opts.quality);
				
				// For responsive images
				if (opts.responsive) {	 
					logger.debug('Mapping RESPONSIVE image batch');
					
					for (var size of sizes){
						
						let image;
						
						// example: (key)_sm.jpg
						let newKey = `${key}_${size}.${opts.output}`;
						
						logger.debug(`size=${size} newKey=${newKey}`);
						
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
						
						logger.trace('getting buffer');
						
						//get buffer then push to batch
						const buffer = await image.getBufferAsync(mime);
						
						batch.push({
							buffer: buffer,
							key: newKey
						});
					}
				}
				// For non responsive image
				else {
					logger.debug('Adding single image to batch');
					
					let newKey = `${key}.${mime}`;
					
					logger.debug(`newKey=${newKey}`);
					
					//get buffer then push single image to batch
					const buffer = await clone.getBufferAsync(mime);
					
					batch.push({
						buffer: buffer,
						key: newKey
					});
				}
				
				//finally, cb the batch of buffers
				cb(null, batch);
			})
			.catch(cb);
	});
	
	opts.replacementStream.pipe(concatFile);
	logger.removeContext('funcName');
}

function S3Storage (opts) {
	
	// 2022-02-28 JL: Updating to aws-sdk v3, it needs to be constructed differently
	// 	https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/index.html
	// 	https://github.com/aws/aws-sdk-js-v3/blob/main/lib/lib-storage/README.md
	// switch (typeof opts.s3) {
	// 	case 'object': this.s3 = opts.s3; break;
	// 	default: throw new TypeError('Expected opts.s3 to be object');
	// }
	this.s3 = new S3Client({
		region: process.env.S3_REGION
	});

	switch (typeof opts.bucket) {
		case 'function': this.getBucket = opts.bucket; break;
		case 'string': this.getBucket = staticValue(opts.bucket); break;
		case 'undefined': throw new Error('bucket is required');
		default: throw new TypeError('Expected opts.bucket to be undefined, string or function');
	}

	switch (typeof opts.key) {
		case 'function': this.getKey = opts.key; break;
		case 'undefined': this.getKey = defaultKey; break;
		default: throw new TypeError('Expected opts.key to be undefined or function');
	}

	switch (typeof opts.acl) {
		case 'function': this.getAcl = opts.acl; break;
		case 'string': this.getAcl = staticValue(opts.acl); break;
		case 'undefined': this.getAcl = defaultAcl; break;
		default: throw new TypeError('Expected opts.acl to be undefined, string or function');
	}

	switch (typeof opts.contentType) {
		case 'function': this.getContentType = opts.contentType; break;
		case 'undefined': this.getContentType = defaultContentType; break;
		default: throw new TypeError('Expected opts.contentType to be undefined or function');
	}

	switch (typeof opts.metadata) {
		case 'function': this.getMetadata = opts.metadata; break;
		case 'undefined': this.getMetadata = defaultMetadata; break;
		default: throw new TypeError('Expected opts.metadata to be undefined or function');
	}

	switch (typeof opts.cacheControl) {
		case 'function': this.getCacheControl = opts.cacheControl; break;
		case 'string': this.getCacheControl = staticValue(opts.cacheControl); break;
		case 'undefined': this.getCacheControl = defaultCacheControl; break;
		default: throw new TypeError('Expected opts.cacheControl to be undefined, string or function');
	}

	switch (typeof opts.contentDisposition) {
		case 'function': this.getContentDisposition = opts.contentDisposition; break;
		case 'string': this.getContentDisposition = staticValue(opts.contentDisposition); break;
		case 'undefined': this.getContentDisposition = defaultContentDisposition; break;
		default: throw new TypeError('Expected opts.contentDisposition to be undefined, string or function');
	}

	switch (typeof opts.storageClass) {
		case 'function': this.getStorageClass = opts.storageClass; break;
		case 'string': this.getStorageClass = staticValue(opts.storageClass); break;
		case 'undefined': this.getStorageClass = defaultStorageClass; break;
		default: throw new TypeError('Expected opts.storageClass to be undefined, string or function');
	}

	switch (typeof opts.serverSideEncryption) {
		case 'function': this.getSSE = opts.serverSideEncryption; break;
		case 'string': this.getSSE = staticValue(opts.serverSideEncryption); break;
		case 'undefined': this.getSSE = defaultSSE; break;
		default: throw new TypeError('Expected opts.serverSideEncryption to be undefined, string or function');
	}

	switch (typeof opts.sseKmsKeyId) {
		case 'function': this.getSSEKMS = opts.sseKmsKeyId; break;
		case 'string': this.getSSEKMS = staticValue(opts.sseKmsKeyId); break;
		case 'undefined': this.getSSEKMS = defaultSSEKMS; break;
		default: throw new TypeError('Expected opts.sseKmsKeyId to be undefined, string, or function');
	}
	
	//from AvatarStorage
	switch(typeof opts.output) {
		case 'function': this.getOutput = opts.output; break;
		case 'string': this.getOutput = staticValue(opts.output); break;
		case 'undefined': this.getOutput = defaultOutput; break;
		default: throw new TypeError('Expected opts.output to be undefined, string, or function');
	}
	
	switch(typeof opts.greyscale) {
		case 'function': this.getGreyscale = opts.greyscale; break;
		case 'boolean': this.getGreyscale = staticValue(opts.greyscale); break;
		case 'undefined': this.getGreyscale = defaultGreyscale; break;
		default: throw new TypeError('Expected opts.greyscale to be undefined, boolean, or function');
	}
	
	switch(typeof opts.quality) {
		case 'function': this.getQuality = opts.quality; break;
		case 'number': this.getQuality = staticValue(opts.quality); break;
		case 'undefined': this.getQuality = defaultQuality; break;
		default: throw new TypeError('Expected opts.quality to be undefined, number, or function');
	}
	
	switch(typeof opts.square) {
		case 'function': this.getSquare = opts.square; break;
		case 'boolean': this.getSquare = staticValue(opts.square); break;
		case 'undefined': this.getSquare = defaultSquare; break;
		default: throw new TypeError('Expected opts.square to be undefined, boolean, or function');
	}
	
	switch(typeof opts.threshold) {
		case 'function': this.getThreshold = opts.threshold; break;
		case 'number': this.getThreshold = staticValue(opts.threshold); break;
		case 'undefined': this.getThreshold = defaultThreshold; break;
		default: throw new TypeError('Expected opts.threshold to be undefined, number, or function');
	}
	
	switch(typeof opts.responsive) {
		case 'function': this.getResponsive = opts.responsive; break;
		case 'boolean': this.getResponsive = staticValue(opts.responsive); break;
		case 'undefined': this.getResponsive = defaultResponsive; break;
		default: throw new TypeError('Expected opts.responsive to be undefined, boolean, or function');
	}
}

S3Storage.prototype._handleFile = function (req, file, cb) {
	logger.addContext('funcName', '_handleFile');
	
	// collect all parameters into 'opts' object
	collect(this, req, file, (err, opts) => {
		if (err) return cb(err);
		
		//array of functions to execute via run-parallel
		var uploadBatch = [];
		
		//process image with Jimp
		processImage(opts, async (err, files) => {		
			logger.addContext('funcName', '_handleFile[post-process]');
			
			if(err) return cb(err);
			
			logger.debug(`files=${JSON.stringify(files).substring(0,200)}`);
			
			// 2022-03-01 JL: Upload no longer returns the object location... so we have to piece it together ourselves
			var returnResult = [];
			
			for(var file of files){
				
				logger.info(`uploading image, key=${file.key}`);
				
				var currentSize = 0;
				
				// https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/modules/putobjectrequest.html
				var params = {
					Bucket: opts.bucket,
					Key: file.key,
					ACL: opts.acl,
					CacheControl: opts.cacheControl,
					ContentType: opts.contentType,
					Metadata: opts.metadata,
					StorageClass: opts.storageClass,
					ServerSideEncryption: opts.serverSideEncryption,
					SSEKMSKeyId: opts.sseKmsKeyId,
					Body: file.buffer,
				};
				
				if (opts.contentDisposition) {
					params.ContentDisposition = opts.contentDisposition;
				}
				
				// let upload = this.s3.upload(params);
				let upload = new Upload({
					client: this.s3,
					params: params
				});
				
				upload.on('httpUploadProgress', function (ev) {
					if (ev.total) currentSize = ev.total;
					logger.trace(JSON.stringify(ev));
				});
				
				//Async function that returns S3 upload promise when run
				uploadBatch.push(upload);
				
				returnResult.push({
					size: currentSize,
					bucket: opts.bucket,
					key: opts.key,
					acl: opts.acl,
					contentType: opts.contentType,
					contentDisposition: opts.contentDisposition,
					storageClass: opts.storageClass,
					serverSideEncryption: opts.serverSideEncryption,
					metadata: opts.metadata,
					location: `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${file.key}`
				});
			}
			
			logger.debug('Got batch of upload functions, going to run them in parallel now');
			
			var uploadPromises = [];
			
			//Run every upload function and create array of promises
			for(let upload of uploadBatch){
				uploadPromises.push( upload.done() );
			}
			
			logger.debug(`uploadPromises=${JSON.stringify(uploadPromises)}`);
			
			//Resolve all promises
			Promise.all(uploadPromises)
				.then(results => {
								
					logger.debug(`Upload done! ${JSON.stringify(returnResult)}`);
					cb(null, returnResult);
				})
				.catch(cb);
		});
	});
};

S3Storage.prototype._removeFile = function (req, file, cb) {
	this.s3.deleteObject({ Bucket: file.bucket, Key: file.key }, cb);
};

module.exports = function (opts) {
	return new S3Storage(opts);
};

module.exports.AUTO_CONTENT_TYPE = autoContentType;
module.exports.DEFAULT_CONTENT_TYPE = defaultContentType;

/*
Below is the license of badunk's "multer-s3" package.

The MIT License (MIT)

Copyright (c) 2015 Duncan Wong

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/