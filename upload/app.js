import express from 'express';						//main express shiz
import path from 'path';							//for filesystem
import useragent from 'express-useragent';			//for info on connected users
import log4js from 'log4js';						//for extensive logging functionality
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

import usefunctions from './helpers/usefunctions.js';
import utilities from '@firstteam102/scoutradioz-utilities';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databasesConfig = JSON.parse(readFileSync(path.join(__dirname, 'databases.json'), 'utf8'));
utilities.config(databasesConfig, {
	cache: {
		enable: true,
		maxAge: 300,
	},
	schemasWithNumberIds: ['users'],
});

//load .env variables
import 'dotenv/config';

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
};
if( process.env.COLORIZE_LOGS == 'true'){
	//Colored pattern layout
	log4jsConfig.appenders.out.layout.pattern = '%[[%d{hh:mm:ss}] [%x{tier}] [%p] %c.%x{funcName} - %]%m';
}
log4js.configure(log4jsConfig);

const logger = log4js.getLogger(); // 2022-03-23 JL: Has to be empty to get the log level to be persistent across other routes
logger.level = process.env.LOG_LEVEL || 'debug';

//Create app
const app = express();

//Must be the very first app.use
app.use(utilities.refreshTier);
//Boilerplate setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

//User agent for logging
app.use(useragent.express());

app.use(async function(req, res, next){
	//For logging
	req.requestTime = Date.now();
	
	//Set headers to allow cross-site requests
	res.set({
		'Access-Control-Allow-Origin' : '*', // Required for CORS support to work
		'Access-Control-Allow-Credentials' : true // Required for cookies, authorization headers with HTTPS 
	});
	
	next();
});

//Logging and timestamping
app.use(usefunctions.logger);

//USER ROUTES
import upload from './routes/upload.js';
import generate from './routes/generate.js';
import manage from './routes/manage.js';

app.use((req, res, next) => {
	logger.removeContext('funcName');
	next();
});

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
app.use('/', upload);
app.use('/manage', manage);
app.use('/generate', generate);

// catch 404 and forward to error handler
app.use(usefunctions.notFoundHandler);
// error handler
app.use(usefunctions.errorHandler);

// Export your express server so you can import it in the lambda function.
export default app;
