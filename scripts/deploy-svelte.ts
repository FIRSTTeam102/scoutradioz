import aws from 'aws-sdk';
import archiver from 'archiver';
import { resolve, join, basename, relative, normalize } from 'path';
import concat from 'concat-stream';
import { promises as fs, createReadStream } from 'fs';
import { spawn } from 'child_process';
import retry from 'oh-no-i-insist';
import assert from 'assert';

const region = 'us-east-1';
const lambda = new aws.Lambda({ region });
const s3 = new aws.S3({ region });
const cloudFront = new aws.CloudFront({ region });

cloudFront.updateFunction();

async function main() {
	let projectFolder = '';
	for (let i = 0; i < process.argv.length; i++) {
		let thisArg = process.argv[i];
		let nextArg = process.argv[i + 1];

		switch (thisArg) {
			case '--folder':
				if (nextArg) projectFolder = nextArg;
				break;
		}
	}
	if (!projectFolder) {
		console.log('Provide folder via --folder <project folder name>');
	}

	const projectFolderLocation = join(__dirname, '../', projectFolder);

	// eslint-disable-next-line global-require
	const packageJson = require(join(projectFolderLocation, 'package.json')); // Voyager
	const functionNameSvelte = packageJson.config.functionNameSvelte;
	const functionNameRouter = packageJson.config.functionNameRouter;
	const distributionId = packageJson.config.cloudFrontDistributionId;
	const bucketName = packageJson.config.publicS3BucketName;
	
	await emptyBucket(bucketName);
	
	await uploadDir('./build/assets', bucketName);
	await uploadDir('./build/prerendered', bucketName);

	// Zip the function code
	const svelteBuffer = await makeZip([join(projectFolderLocation, '/build/server')]);
	const routerBuffer = await makeZip([join(projectFolderLocation, '/build/edge')]);

	// Update the code and publish function versions
	const svelteConfig = updateCode(svelteBuffer, functionNameSvelte);
	const routerConfig = await updateCode(routerBuffer, functionNameRouter);

	// Update the cloudfront distribution
	await updateCloudFrontData(distributionId, routerConfig);
	
	console.log('Done!');
}

if (require.main === module) {
	main();
}

async function updateCloudFrontData(
	distributionId: string,
	routerConfig: aws.Lambda.FunctionConfiguration
) {
	const result = await cloudFront
		.getDistributionConfig({
			Id: distributionId,
		})
		.promise();

	const DistributionConfig = result.DistributionConfig;
	assert(DistributionConfig);
	assert(
		DistributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations
			.Quantity === 1,
		'LambdaFunctionAssociations quantity is not 1!' +
			JSON.stringify(
				DistributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations
			)
	);

	// Update to function ARN. It should include the just-published code version!
	console.log(`Updating function ARN to: ${routerConfig.FunctionArn}`);
	DistributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations.Items[0].LambdaFunctionARN =
		routerConfig.FunctionArn;

	const updateResult = await cloudFront
		.updateDistribution({
			Id: distributionId,
			DistributionConfig: DistributionConfig,
			IfMatch: result.ETag,
		})
		.promise();
	
	// Invalidate the Cloudfront cache
	let invalidateResult = await cloudFront.createInvalidation({
		DistributionId: distributionId,
		InvalidationBatch: {
			CallerReference: `Updating to EdgeRouter function code version ${routerConfig.Version} - ${Date.now()}`,
			Paths: {
				Quantity: 1,
				Items: ['/*']
			}
		}
	}).promise();
	
	console.log(invalidateResult);
	
	
	console.log('Waiting for cache invalidation to complete...');
	await cloudFront.waitFor('invalidationCompleted', {
		DistributionId: distributionId,
		Id: invalidateResult.Invalidation.Id
	}).promise();
}

async function updateCode(
	zipBuffer: Buffer,
	functionName: string
): Promise<aws.Lambda.FunctionConfiguration> {
	const updateParams: aws.Lambda.UpdateFunctionCodeRequest = {
		FunctionName: functionName,
		ZipFile: zipBuffer,
	};

	console.log('Uploading function code...');

	const updateResult = await lambda.updateFunctionCode(updateParams).promise();

	await waitUntilNotPending(lambda, functionName, 1000, 5);

	console.log(
		`Uploaded function code:\n\t FunctionName=${updateResult.FunctionName}\n\t Role=${updateResult.Role}\n\t CodeSha256=${updateResult.CodeSha256}`
	);

	const versionParams: aws.Lambda.PublishVersionRequest = {
		CodeSha256: updateResult.CodeSha256,
		Description: new Date().toLocaleString(),
		FunctionName: functionName,
	};

	const versionResult = await lambda.publishVersion(versionParams).promise();

	console.log(`Published new version! Version=${versionResult.Version}`);

	return versionResult;
}

function makeZip(folders: string[]): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const startTime = Date.now();

		const output = concat((data) => {
			console.log(
				`Archive has been completed and stored in memory after ${
					Date.now() - startTime
				} ms`
			);

			let sizeBytes = archive.pointer();

			if (sizeBytes > 1000000) {
				console.log('Size: ' + sizeBytes / 1000000 + ' MB');
			}
			else {
				console.log('Size: ' + sizeBytes / 1000 + ' KB');
			}

			resolve(data);
		});

		const archive = archiver('zip');

		archive.on('error', function (err) {
			reject(err);
		});

		console.log('Zipping directory...');
		archive.pipe(output);

		for (let folder of folders) {
			archive.directory(folder, basename(folder));
		}

		archive.finalize();
	});
}

// Credit: https://github.com/claudiajs/claudia/issues/226#issuecomment-984717841
async function waitUntilNotPending(lambda, functionName, timeout, retries) {
	'use strict';
	await new Promise((resolve) => setTimeout(resolve, timeout));

	return retry(
		() => {
			return lambda
				.getFunctionConfiguration({ FunctionName: functionName })
				.promise()
				.then((result) => {
					if (result.state === 'Failed') {
						throw 'Lambda resource update failed';
					}
					if (result.state === 'Pending') {
						throw 'Pending';
					}
				});
		},
		timeout,
		retries,
		(failure) => failure === 'Pending',
		() => console.log('Lambda function is in Pending state, waiting...')
	);
}

function emptyBucket(bucketName: string) {
	return new Promise((resolve, reject) => {
		
		console.log(`Emptying bucket ${bucketName}`);
		
		let child = spawn('aws', [
			's3',
			'rm',
			`s3://${bucketName}`,
			'--recursive'
		]);
		
		child.stdout.on('data', (data) => {
			process.stdout.write(data);
		});
		
		child.stderr.on('data', (data) => {
			process.stderr.write(data);
		});
		
		child.on('close', (status, signal) => {
			if (status === 0) resolve(undefined);
			else reject(signal);
		});
	});
}

async function uploadDir(s3Path: string, bucketName: string) {
	return new Promise((resolve, reject) => {
		console.log(`Uploading files from directory ${s3Path}`);
		
		let child = spawn('aws', [
			's3',
			'sync',
			normalize(s3Path).replace(/\\/g, '/'),
			`s3://${bucketName}`,
			'--acl',
			'public-read'
		]);
		
		child.stdout.on('data', (data) => {
			process.stdout.write(data);
		});
		
		child.stderr.on('data', (data) => {
			process.stderr.write(data);
		});
		
		child.on('close', (status, signal) => {
			if (status === 0) resolve(undefined);
			else reject(signal);
		});
	});
}
