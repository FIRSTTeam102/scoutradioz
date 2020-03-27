const express = require('express');						//main express shiz
const path = require('path');							//for filesystem
const bodyParser = require('body-parser');				//parses http request information
const useragent = require('express-useragent');			//for info on connected users
const log4js = require('log4js');						//for extensive logging functionality

const usefunctions = require('./helpers/usefunctions');
const utilities = require('@firstteam102/scoutradioz-utilities');
utilities.config(require('./databases.json'));

//AWS middleware magic
require('aws-serverless-express/middleware');
//load .env variables
require('dotenv').config();

//log4js config
function logTier(logEvent) {
	if (process.env.ALIAS) {
		return process.env.ALIAS;
	}
	else {
		return 'LOCAL|' + process.env.TIER;
	}
}
function funcName(logEvent) {
	if (logEvent.context && logEvent.context.funcName) {
		return logEvent.context.funcName;
	}
	else {
		return '';
	}
}
var log4jsConfig = {
	appenders: { out: { type: 'stdout', layout: {
		type: 'pattern',
		//Non-colored pattern layout (default)
		pattern: '[%x{tier}] [%p] %c.%x{funcName} - %m',
		tokens: {
			'tier': logTier,
			'funcName': funcName,
		},
	} } },
	categories: { default: { appenders: ['out'], level: 'info' } }
}
if( process.env.COLORIZE_LOGS == 'true'){
	//Colored pattern layout
	log4jsConfig.appenders.out.layout.pattern = '%[[%d{hh:mm:ss}] [%x{tier}] [%p] %c.%x{funcName} - %]%m';
}
log4js.configure(log4jsConfig);

const logger = log4js.getLogger('app.js');
logger.level = 'debug';

//Create app
const app = express();

//Boilerplate setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

//User agent for logging
app.use(useragent.express());

app.use(async function(req, res, next){
	//For logging
	req.requestTime = Date.now();
	
	//Set headers to allow cross-site requests
	res.set({
		"Access-Control-Allow-Origin" : "*", // Required for CORS support to work
		"Access-Control-Allow-Credentials" : true // Required for cookies, authorization headers with HTTPS 
	});
	
	next();
});

//Logging and timestamping
app.use(usefunctions.logger);

//USER ROUTES
var upload = require('./routes/upload');
var generate = require('./routes/generate');

app.use((req, res, next) => {
	logger.removeContext('funcName');
	next();
})

app.use((req, res, next) => {
	logger.addContext('funcName', 'urlParser');
	
	//Tier is overridden in lambda.js.
	var tier = process.env.TIER;
	logger.info(`tier=${tier} originalUrl=${req.originalUrl} url=${req.url}`);
	
	var splitUrl = req.url.split('/');
	logger.debug(splitUrl);
	
	if (splitUrl[1] == tier) {
		logger.info('URL includes tier. Cutting it out of url.');
		//Remove tier from url
		splitUrl.splice(1, 1);
		req.url = splitUrl.join('/');
		//if url does not start with a slash, add a slash to avoid breaking something
		if (req.url[0] != '/') req.url = '/' + req.url;
		logger.info(`new req.url=${req.url}`);
		next();
	}
	//If current tier is not in the url, send a 404
	else {
		logger.info('URL does not include tier. Sending 404.');
		res.status(404).send('Not found. Must include process tier in URL.');
	}
});

//CONNECT URLS TO ROUTES
app.use(`/`, upload);
app.use(`/generate`, generate)

// catch 404 and forward to error handler
app.use(usefunctions.notFoundHandler);
// error handler
app.use(usefunctions.errorHandler);

// Export your express server so you can import it in the lambda function.
module.exports = app;
