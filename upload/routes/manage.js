import { Router } from 'express';
import wrap from 'express-async-handler';
import utilities from '@firstteam102/scoutradioz-utilities';
import log4js from 'log4js';
import { S3Client, CopyObjectCommand, GetObjectAttributesCommand, ObjectAttributes, DeleteObjectCommand } from '@aws-sdk/client-s3';

const router = Router();
const logger = log4js.getLogger('manage');
const client = new S3Client({
	region: process.env.S3_REGION
});

logger.debug(`Primary bucket: ${process.env.S3_BUCKET}, backups bucket: ${process.env.S3_BACKUPS_BUCKET}`);

// When a team manager deletes an upload, they send a request to upload.scoutradioz.com/manage/update-recycle-bin to:
//	1. search database for removed uploads which haven't been "sent to the recycle bin"
//	2. take them out of the public bucket and move them into scoutradioz-backups/recycle-bin
//	3. mark them in the DB as removed from AWS
router.all('/update-recycle-bin', wrap(async (req, res) => {
	logger.addContext('funcName', 'update-recycle-bin');
	
	logger.debug('ENTER');
	
	// await utilities.update('uploads', {removed_from_aws: true}, {$set: {removed_from_aws: false}}); // FOR DEBUGGING AND TESTING ONLY
	const uploadsNotMoved = await utilities.find('uploads', {removed: true, removed_from_aws: {$ne: true}});
	logger.info(`Found uploads that aren't moved from AWS, length=${uploadsNotMoved.length}`);
	
	const dbPromises = [];
	const extensions = ['_sm.jpg', '_md.jpg', '_lg.jpg'];
	let deletedCount = 0;
	
	for (let i in uploadsNotMoved) {
		let upload = uploadsNotMoved[i];
		logger.debug(`Upload: ${upload.s3_key}, org: ${upload.org_key}, uploaded by ${upload.uploader.name}`);
		
		let commands = [];
		// One aws key per file extension
		for (let ext of extensions) {
			commands.push(
				new GetObjectAttributesCommand({
					Bucket: process.env.S3_BUCKET,
					Key: upload.s3_key + ext,
					ObjectAttributes: [ObjectAttributes.OBJECT_SIZE, ObjectAttributes.STORAGE_CLASS],
				})
			);
		}
		
		let doSetRemoved = false;
		
		for (let command of commands) {
			try {
				let response = await client.send(command);
				let key = command.input.Key;
				let lastModified = response.LastModified instanceof Date ? response.LastModified.toISOString() : ''; // just for logging purposes
				logger.debug(`Found object; size=${response.ObjectSize}, lastModified=${lastModified}, key=${key}`);
				
				// First copy the object, then delete the original (no need to keep public-read ACL)
				let copyCommand = new CopyObjectCommand({
					CopySource: process.env.S3_BUCKET + '/' + key,
					Bucket: process.env.S3_BACKUPS_BUCKET,
					Key: 'recycle-bin/' + key,
				});
				
				let deleteCommand = new DeleteObjectCommand({
					Bucket: process.env.S3_BUCKET,
					Key: key,
				});
				
				try {
					let response = await client.send(copyCommand);
					if (response.CopyObjectResult) {
						let lastModified = response.LastModified instanceof Date ? response.LastModified.toISOString() : ''; // just for logging purposes
						logger.info(`Successfully copied object, ETag=${response.CopyObjectResult.ETag}, lastModified=${lastModified}`);
						
						// Finally, do the object delete
						try {
							let response = await client.send(deleteCommand);
							logger.info('Successfully deleted object.');
							logger.debug(response);
							// And lastly, set doSetRemoved to true so we mark it in the db
							doSetRemoved = true;
						}
						catch (err) {
							logger.error('Error deleting... code=' + err.Code);
							logger.debug(JSON.stringify(err));
						}
					}
					else {
						throw {Code: 'Did not receive a copy object result!'}; // fall down to the catch below
					}
				}
				catch (err) {
					logger.error('Error copying... code=' + err.Code);
					logger.debug(JSON.stringify(err));
				}
			}
			catch (err) {
				logger.debug('Catching error from AWS... code=' + err.Code);
				
				// JL: I have no way of knowing if Amazon will be consistent with the way they return errors, so here are 3 ""failsafe"" ways to check if the file does not exist
				let wasNotFound = false;
				if (err.Code === 'NoSuchKey') wasNotFound = true;
				else if (typeof err.$metadata === 'object' && err.$metadata.httpStatusCode == 404) wasNotFound = true;
				else if (typeof err.$response === 'object' && err.$response.statusCode == 404) wasNotFound = true;
				
				if (wasNotFound) {
					logger.debug('Upload was not found on S3! key=' + command.input.Key);
					doSetRemoved = true;
				}
				else {
					logger.error('Unknown error code returned from AWS!!');
					logger.error(err);
				}
			}
		}
		
		// If the object was deleted from AWS, mark it as removed_from_aws in the database.
		if (doSetRemoved) {
			logger.info('Upload was not found on S3! Marking it as already removed in the DB.');
			dbPromises.push(utilities.update('uploads', {_id: upload._id}, {$set: {removed_from_aws: true}}));
			deletedCount++;
		}
	}
	
	let writeResults = await Promise.all(dbPromises);
	logger.trace('writeResults=' + JSON.stringify(writeResults));
	
	res.send({deletedCount: deletedCount});
}));

export default router;