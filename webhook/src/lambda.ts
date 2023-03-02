'use strict';
import type { APIGatewayProxyEvent, Context} from 'aws-lambda';
import awsServerlessExpress from 'aws-serverless-express';
import webhook from './webhook';

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
const server = awsServerlessExpress.createServer(webhook, undefined, binaryMimeTypes);

exports.handler = (event: APIGatewayProxyEvent, context: Context) => {
  
	let alias = context.invokedFunctionArn.replace(/.*:/g,'');
	console.log('ALIAS: '+ alias);
  
	process.env.ALIAS = alias;
	process.env.TIER = alias.toLowerCase();

	return awsServerlessExpress.proxy(server, event, context);
}; 
