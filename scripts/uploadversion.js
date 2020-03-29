'use strict';
//const file_system = require('fs');
const path = require('path');
const archiver = require('archiver');
const aws = require('aws-sdk');
const concat = require('concat-stream');
const lambda = new aws.Lambda({
	region: 'us-east-1'
});
const s3 = new aws.S3({
	region: 'us-east-1'
});

const packageJson = require('../package.json');
const backupsS3BucketName = packageJson.config.backupsS3BucketName;

console.log(`Backups S3 Bucket: ${backupsS3BucketName}`);

if (!backupsS3BucketName) {
	throw Error('No backups S3 bucket provided in the root package.json.');
}

var alias = 'test';
var functionName;
var folder;

//eslint-disable-next-line
for (var i in process.argv) {
	let thisArg = process.argv[i];
	let nextArg = process.argv[i - -1];
	
	switch (thisArg) {
		case '--alias':
			if (nextArg) alias = nextArg;
			break;
		case '--function-name':
			if (nextArg) functionName = nextArg;
			break;
		case '--folder':
			if (nextArg) folder = nextArg;
			break;
	}
}

if (alias.toUpperCase() == 'PROD' || alias.toUpperCase() == 'PREVIOUS') {
	throw 'Do not upload code directly to PROD or to PREVIOUS.';
}
else {
	alias = alias.toUpperCase();
}

if (!folder) {
	throw 'Folder is not defined.';
}

console.log(`alias=${alias} functionName=${functionName} folder=${folder}`);

//const folderPath = path.resolve(__filename, '../../zips');
//const zipPath = path.join('zips', `${folder}.zip`);
//console.log(folderPath);
//if (!file_system.existsSync(folderPath)) {
//	console.log('Making folderPath ' + folderPath);
//	file_system.mkdirSync(folderPath);
//}

makeZip(folder, (err, zipBuffer) => {
	if (err) {
		throw err;
	}
	else {
		updateCode(zipBuffer, (err, data) => {
			if (err) {
				throw err;
			}
			else {
				console.log(data);
				var functionVersion = data.FunctionVersion;
				uploadToS3(zipBuffer, functionVersion, (err, data) => {
					if (err) {
						throw err;
					}
					else {
						console.log(data);
					}
				});
			}
		});
	}
});

function uploadToS3(zipBuffer, functionVersion, cb) {
	
	var key = `lambda/${functionName}/${functionName}_${functionVersion}.zip`;
	
	console.log(`Uploading code backup, key=${key}`);
	
	var params = {
		Bucket: backupsS3BucketName,
		Key: key,
		ContentType: 'application/zip',
		Body: zipBuffer,
	};
	
	let upload = s3.upload(params);
				
	upload.on('httpUploadProgress', function (ev) {
		if (ev.total) var currentSize = ev.total;
		console.log(JSON.stringify(ev));
	});
	
	upload.send((err, data) => {
		if (err) cb(err);
		else {
			console.log('Successfully uploaded backup zip of code.');
			cb(null, data);
		}
	});
}

function updateCode(zipBuffer, cb) {
	
	const time = new Date().toISOString().replace('T','_').replace(/\:|\-/g,'').split('.')[0];
	
	var params = {
		FunctionName: functionName,
		ZipFile: zipBuffer
	};
	
	console.log('Uploading function code...');
	
	lambda.updateFunctionCode(params, (err, data) => {
		if (err) cb(err);
		else {
			console.log(`Uploaded function code:\n\t FunctionName=${data.FunctionName}\n\t Role=${data.Role}\n\t CodeSha256=${data.CodeSha256}`);
			
			console.log('Publishing new version...');
			var params = {
				CodeSha256: data.CodeSha256,
				Description: `${time}`,
				FunctionName: functionName,
			};
			lambda.publishVersion(params, (err, data) => {
				if (err) cb(err);
				else {
					//Keep this to update alias later
					var newVersion = data.Version;
					console.log(`Published new version! Version=${newVersion}`);
					
					if (alias) {
						var params = {
							FunctionName: functionName, 
							Name: alias,
						};
						console.log(`Getting data for alias=${alias}`);
						
						lambda.getAlias(params, (err, data) => {
							if (err) cb('Could not find alias: ' + alias, err);
							else {
								//For safekeeping or something
								var oldVersion = data.FunctionVersion;
								console.log(`Alias ${alias}: Old version: ${oldVersion}; Updating to ${newVersion}`);
								
								var params = {
									FunctionName: functionName, 
									FunctionVersion: newVersion, 
									Name: alias
								};
								lambda.updateAlias(params, (err, data) => {
									if (err) cb(err);
									else {
										cb(null, data);
									}
								});
							}
						});
					}
					else {
						cb('No alias specified.');
					}
				}
			});
		}
	});
}

function makeZip(folder, cb) {
	//if (file_system.existsSync(zipPath)) {
	//	console.log('Zip file already exists. Deleting existing zip...');
	//	file_system.unlinkSync(zipPath);
	//}
	//var output = file_system.createWriteStream(zipPath);
	
	var folderPath = path.resolve(__filename, '../../', folder);
	
	var output = concat(data => {
		
		console.log(`Archive has been completed and stored in memory after ${Date.now()-startTime} ms`);
		
		var sizeBytes = parseInt(archive.pointer());
		
		if (sizeBytes > 1000000) {
			console.log('Size: ' + sizeBytes / 1000000 + ' MB');
		}
		else {
			console.log('Size: ' + sizeBytes / 1000 + ' KB');
		}
		
		cb(null, data);
	});
	
	var archive = archiver('zip');//, {zlib: {level: 0}});
	
	//output.on('close', function () {
	//	console.log(done);
	//});
	
	archive.on('error', function(err){
		cb(err);
	});
	
	var startTime = Date.now();
	console.log(`Directory: "${folderPath}"`);
	console.log('Zipping directory...');
	archive.pipe(output);
	archive.directory(folderPath + '/', false);
	archive.finalize();
}
