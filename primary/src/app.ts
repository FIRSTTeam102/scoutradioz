import favicon from 'serve-favicon';							// Serves favicon
import MongoStore from '@firstteam102/connect-mongo';			// Alternative session storage						
import passport from 'passport';								// User authentication
import express from 'express';									// HTTP framework
import path from 'path';										// For filesystem
import session from 'express-session';							// Session middleware
import cookieParser from 'cookie-parser';						// Cookies
import useragent from 'express-useragent';						// Info on connected users
import log4js from 'log4js';									// Extensive logging functionality
import utilities from '@firstteam102/scoutradioz-utilities'; 	// Database utilities
import { MongoClient } from 'mongodb';							// MongoDB client
import type { LoggingEvent } from 'log4js';

const appStartupTime = Date.now();

//AWS middleware magic
import awsMiddleware from 'aws-serverless-express/middleware';
//load .env variables
import dotenv from 'dotenv';
dotenv.config();

//log4js config
let log4jsConfig = {
	appenders: { out: { type: 'stdout', layout: {
		type: 'pattern',
		//Non-colored pattern layout (default)
		pattern: '[%x{tier}] [%p] %c.%x{funcName} - %m',
		tokens: {
			'tier': () => {
				if (process.env.ALIAS) return process.env.ALIAS;
				else return 'LOCAL|' + process.env.TIER;
			},
			'funcName': (logEvent: LoggingEvent) => {
				if (logEvent.context && logEvent.context.funcName) {
					return logEvent.context.funcName;
				}
				else return '';
			},
		},
	} } },
	categories: {
		default: { appenders: ['out'], level: 'info' },
		off: { appenders: ['out'], level: 'off' },
	}
};
if( process.env.COLORIZE_LOGS == 'true'){
	//Colored pattern layout
	log4jsConfig.appenders.out.layout.pattern = '%[[%d{hh:mm:ss}] [%x{tier}] [%p] %c.%x{funcName} - %]%m';
}
log4js.configure(log4jsConfig);

const logger = log4js.getLogger();
logger.level = process.env.LOG_LEVEL || 'debug';

//load custom middleware
const usefunctions = require('./helpers/usefunctions');
//Configure utilities with the full file path of our databases json file
utilities.config(require('../databases.json'), {
	cache: {
		enable: true,
		maxAge: 30,
	},
	debug: (process.env.UTILITIES_DEBUG === 'true'),
});
//Load helper functions
const helpers = require('@firstteam102/scoutradioz-helpers');
//Configure helper functions by passing our already-configured utilities module
helpers.config(utilities);

//PUG CACHING (if production IS enabled)
if(process.env.NODE_ENV == 'production') logger.info('Pug caching will be enabled.');

//Create app
const app = express();

/*
// Redirect www.scoutradioz.com to scoutradioz.com
//	Credit: https://stackoverflow.com/questions/17898183/
app.get('/*', (req, res, next) => {
	let host = req.headers.host;
	let href;

	// no www. present, nothing to do here
	if (!/^www\./i.test(host)) {
		return next();
	}

	// remove www.
	host = host.replace(/^www\./i, '');
	href = req.protocol + '://' + host + req.url;
	res.statusCode = 301;
	res.setHeader('Location', href);
	res.write('Redirecting to ' + host + req.url + '');
	logger.info('Redirecting user from www.* to ' + host + req.url + '');
	res.end();
});
*/

//Must be the very first app.use
app.use(utilities.refreshTier);

//Boilerplate setup
app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'pug');

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(favicon(path.join(__dirname, '..', 'public', 'icon-32.png')));

app.disable('x-powered-by');

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

//Internationalization
//Must be before any other custom code
import { I18n } from './helpers/i18n';
const i18n = new I18n({
	directory: path.join(__dirname, '../locales')
});
app.use(i18n.middleware());

//Session
console.log('app.js: app.use(session({... - START');
// const MongoClient = require('mongodb').MongoClient;
//Get promise for MongoClient
const clientPromise: Promise<MongoClient> = new Promise((resolve, reject) => {
	logger.debug('Waiting for utilities.getDBurl');
	//2020-03-23 JL: Made getDBurl() async to wait for TIER to be given
	utilities.getDBurl()
		.then((url: string) => {
			logger.info('Got url');
			//Connect mongoClient to dbUrl specified in utilities
			MongoClient.connect(url, {}, function(err?: Error, client?: MongoClient){
			//Resolve/reject with client
				if (err) reject(err);
				else if (client) resolve(client);
			});
		});
});
app.use(session({
	secret: 'marcus night',
	saveUninitialized: false, // don't create session until something stored
	resave: false, //don't save session if unmodified
	
	store: MongoStore.create({
		//Use same URL that utilities uses for database
		clientPromise: clientPromise,
		//client: sessionDb,
		ttl: 7 * 24 * 60 * 60, // Time-to-live, in seconds. 2022-03-07 JL: Increased from 3 days to 7 days.
		autoRemove: 'interval',
		autoRemoveInterval: 10, // In minutes. Default
		touchAfter: 24 * 3600, // time period in seconds for lazy loading session
		mongoOptions: {
			// useUnifiedTopology: true
		}
	}),
}));

//User agent for logging
app.use(useragent.express());

//Passport setup (user authentication)
require('./helpers/passport-config');
app.use(passport.initialize());
app.use(passport.session());

//Various other middleware stuff
app.use(usefunctions.initialMiddleware);
//Logging and timestamping
app.use(usefunctions.requestLogger);
//Event stuff
app.use(usefunctions.getEventInfo);
//adds logging to res.render function
app.use(usefunctions.renderLogger);
//Authentication middleware (req.authenticate)
app.use(usefunctions.authenticate);
//sets view engine vars for user
//IMPORTANT: Must be called last, because it may rely on other useFunctions data
app.use(usefunctions.setViewVariables);

//SCOUTRADIOZ ADMIN ROUTE FOR SYNCING - PLACED FIRST TO ENABLE UNAUTHENTICATED AUTOMATED CALLS
let sync = require('./routes/admin/sync');
app.use('/admin/sync', sync);

//USER ROUTES
let index = require('./routes/index');
let user = require('./routes/user');
let dashboard = require('./routes/dashboard');
let scouting = require('./routes/scouting');
let reports = require('./routes/reports');
let notifications = require('./routes/notifications');
let share = require('./routes/share');
//ORG MANAGEMENT ROUTES
let manageindex = require('./routes/manage/indexmgmt');
let allianceselection = require('./routes/manage/allianceselection');
let currentevent = require('./routes/manage/currentevent');
let config = require('./routes/manage/orgconfig');
let manualdata = require('./routes/manage/manualdata');
let orgmembers = require('./routes/manage/members');
let scoutingaudit = require('./routes/manage/scoutingaudit');
let scoutingpairs = require('./routes/manage/scoutingpairs');
//SCOUTRADIOZ ADMIN ROUTES
let adminindex = require('./routes/admin/indexadmin');
let externaldata = require('./routes/admin/externaldata');

//CONNECT URLS TO ROUTES
app.use('/', index);
app.use('/user', user);
app.use('/scouting', scouting);
app.use('/dashboard', dashboard);
app.use('/reports', reports);
app.use('/notifications', notifications);

app.use('/manage', manageindex);
app.use('/manage/allianceselection', allianceselection);
app.use('/manage/config', config);
app.use('/manage/scoutingpairs', scoutingpairs);
app.use('/manage/members', orgmembers);
app.use('/manage/currentevent', currentevent);
app.use('/manage/scoutingaudit', scoutingaudit);
app.use('/manage/manualdata', manualdata);

app.use('/admin', adminindex);
app.use('/admin/externaldata', externaldata);

app.use('/', share);

// catch 404 and forward to error handler
app.use(usefunctions.notFoundHandler);
// error handler
app.use(usefunctions.errorHandler);

logger.info(`app.js READY: ${Date.now() - appStartupTime} ms`);

// Export your express server so you can import it in the lambda function.
module.exports = app;
