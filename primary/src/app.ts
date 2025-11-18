import favicon from 'serve-favicon';							// Serves favicon
import MongoStore from '@firstteam102/connect-mongo';			// Alternative session storage						
import passport from 'passport';								// User authentication
import express from 'express';									// HTTP framework
import path from 'path';										// For filesystem
import session from 'express-session';							// Session middleware
import cookieParser from 'cookie-parser';						// Cookies
import useragent from 'express-useragent';						// Info on connected users
import log4js from 'log4js';									// Extensive logging functionality
import utilities from 'scoutradioz-utilities'; 	// Database utilities
import { MongoClient } from 'mongodb';							// MongoDB client
import type { LoggingEvent } from 'log4js';
import helpers, { config as configHelpers } from 'scoutradioz-helpers';
import fs from 'fs';
import { auth as openIdAuth } from 'express-openid-connect';

const appStartupTime = Date.now();

//AWS middleware magic
import awsMiddleware from 'aws-serverless-express/middleware';
//load .env variables
import dotenv from 'dotenv';
dotenv.config(); // todo: remove and use sst?

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
	schemasWithNumberIds: ['users'],
});
//Configure helper functions by passing our already-configured utilities module
configHelpers(utilities);

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

// Filter out obvious bot requests
app.use((req, res, next) => {
	if (
		req.path.startsWith('/.well-known') ||
		req.path.endsWith('.php')
	) return res.status(404).send();
	next();
});

//Must be the very first app.use
app.use(utilities.refreshTier);

//Boilerplate setup
app.set('views', path.join(process.cwd(), 'views'));
app.set('view engine', 'pug');

app.use('/public', express.static(path.join(process.cwd(), 'public')));
// @ts-ignore 2025-01-17, M.O'C: TODO Jordan look at this
// app.use(favicon(path.join(__dirname, '..', 'public', 'icon-32.png')));

app.disable('x-powered-by');

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// load platform settings, including maintenance mode and news, after cookie parsing
app.use(usefunctions.loadPlatformSettings);

//User agent for logging
// @ts-ignore 2025-02-10, M.O'C: Causing an error on Mike's desktop PC:
//
// src/app.ts:120:9 - error TS2769: No overload matches this call.
//   The last overload gave the following error.
//     Argument of type '(req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>, next?: NextFunction | undefined) => void' is not assignable to parameter of type 'PathParams'.
//
// 120 app.use(useragent.express());
//             ~~~~~~~~~~~~~~~~~~~
//
//   ../node_modules/@types/express-serve-static-core/index.d.ts:153:5
//     153     <
//             ~
//     154         P = ParamsDictionary,
//         ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//     ... 
//     162         ...handlers: Array<RequestHandlerParams<P, ResBody, ReqBody, ReqQuery, LocalsObj>>
//         ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//     163     ): T;
//         ~~~~~~~~~
//     The last overload is declared here.
//
app.use(useragent.express());

// Block bots (make sure this is below express.static so they can still access robots.txt)
app.use((req, res, next) => {
	if (req.useragent?.isBot && req.originalUrl !== '/') {
		logger.debug(`Blocked ${req.method} request from bot to ${req.originalUrl}`);
		return res.status(403).send();
	}
	next();
});

//Internationalization
//Must be before any other custom code
import { I18n } from './helpers/i18n';
// SST moves locales into a different directory
let localesPath = path.join(__dirname, './locales');
if (!fs.existsSync(localesPath)) localesPath = path.join(__dirname, '../locales');
const i18n = new I18n({ directory: localesPath });
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
// @ts-ignore 2025-01-17, M.O'C: TODO Jordan look at this
app.use(session({
	secret: 'marcus night',
	saveUninitialized: false, // don't create session until something stored
	resave: false, //don't save session if unmodified
	
	store: MongoStore.create({
		//Use same URL that utilities uses for database
		clientPromise: clientPromise,
		//client: sessionDb,
		ttl: 7 * 24 * 60 * 60, // Time-to-live, in seconds. 2022-03-07 JL: Increased from 3 days to 7 days.
		autoRemove: 'native',
		// autoRemoveInterval: 10, // In minutes. Default
		touchAfter: 24 * 3600, // time period in seconds for lazy loading session
		mongoOptions: {
			// useUnifiedTopology: true
		}
	}),
}));

//Passport setup (user authentication)
require('./helpers/passport-config');
// @ts-ignore 2025-01-17, M.O'C: TODO Jordan look at this
app.use(passport.initialize());
app.use(passport.session({pauseStream: true,}));

// Setting up a test of Auth0 per 
const auth_config = {
	authRequired: false,
	auth0Logout: true,
	secret: 'a long, randomly-generated string stored in env',
	baseURL: 'placeholder',
	clientID: 'AOjDEt1p4UCAqBnNCDt4Dkk0zmu9oe3R',
	issuerBaseURL: 'https://scoutradioz.us.auth0.com'
};
app.use((req, res, next) => {
	auth_config.baseURL = `${req.protocol}://${req.get('host')}`;
	return openIdAuth(auth_config)(req, res, next);
});

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
let sync = require('./routes/admin/sync').default;
app.use('/admin/sync', sync);

//USER ROUTES
let index = require('./routes/index').default;
let user = require('./routes/user').default;
let dashboard = require('./routes/dashboard').default;
let scouting = require('./routes/scouting').default;
let reports = require('./routes/reports').default;
let notifications = require('./routes/notifications').default;
let share = require('./routes/share').default;
//ORG MANAGEMENT ROUTES
let manageindex = require('./routes/manage/indexmgmt').default;
let allianceselection = require('./routes/manage/allianceselection').default;
let currentevent = require('./routes/manage/currentevent').default;
let config = require('./routes/manage/orgconfig').default;
let manualdata = require('./routes/manage/manualdata').default;
let orgmembers = require('./routes/manage/members').default;
let scoutingaudit = require('./routes/manage/scoutingaudit').default;
let assignments = require('./routes/manage/assignments').default;
//SCOUTRADIOZ ADMIN ROUTES
let adminindex = require('./routes/admin/indexadmin').default;
let tests = require('./routes/admin/tests').default;
let externaldata = require('./routes/admin/externaldata').default;
let orgs = require('./routes/admin/orgs').default;

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
app.use('/manage/assignments', assignments);
app.use('/manage/members', orgmembers);
app.use('/manage/currentevent', currentevent);
app.use('/manage/scoutingaudit', scoutingaudit);
app.use('/manage/manualdata', manualdata);

app.use('/admin/tests', tests); // temporary: put it before admin so we don't need authentication
app.use('/admin', adminindex);
app.use('/admin/externaldata', externaldata);
app.use('/admin/orgs', orgs);

app.use('/share', share);

// catch 404 and forward to error handler
app.use(usefunctions.notFoundHandler);
// error handler
app.use(usefunctions.errorHandler);

logger.info(`app.js READY: ${Date.now() - appStartupTime} ms`);

// Export your express server so you can import it in the lambda function.
// module.exports = app;
export default app;
