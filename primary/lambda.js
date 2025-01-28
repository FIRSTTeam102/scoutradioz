'use strict';
const awsServerlessExpress = require(process.env.NODE_ENV === 'test' ? '../../index' : 'aws-serverless-express');
const app = require('./build/app').default;

// NOTE: If you get ERR_CONTENT_DECODING_FAILED in your browser, this is likely
// due to a compressed response (e.g. gzip) which has not been handled correctly
// by aws-serverless-express and/or API Gateway. Add the necessary MIME types to
// binaryMimeTypes below, then redeploy (`npm run package-deploy`)
const binaryMimeTypes = [
	'application/javascript',
	'application/json',
	'application/octet-stream',
	'application/xml',
	'font/eot',
	'font/opentype',
	'font/otf',
	'image/jpeg',
	'image/png',
	'image/svg+xml',
	'text/comma-separated-values',
	'text/css',
	'text/html',
	'text/javascript',
	'text/plain',
	'text/text',
	'text/xml'
];
const server = awsServerlessExpress.createServer(app, null, binaryMimeTypes);

exports.handler = (event, context) => {

	var alias = context.invokedFunctionArn.replace(/.*:/g,'');
	//console.log('ALIAS: '+ alias);
	
	process.env.ALIAS = alias;
	//process.env.TIER is overridden here during every request.
	process.env.TIER = alias.toLowerCase();
	
	// The version number that has been invoked, allowing us to append it to our static scripts so that browsers automatically pull their latest version
	process.env.LAMBDA_FUNCTION_VERSION = context.functionVersion;

	return awsServerlessExpress.proxy(server, event, context);
}; 