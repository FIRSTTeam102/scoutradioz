const express = require('express');						//main express shiz
const path = require('path');							//for filesystem
const favicon = require('serve-favicon');				//serves favicon
const bodyParser = require('body-parser');				//parses http request information
const session = require('express-session');				//session middleware
const cookieParser = require('cookie-parser');			//cookies
const MongoStore = require('connect-mongo')(session);	//Alternative session storage
const passport = require('passport');					//for user authentication
const useragent = require('express-useragent');			//for info on connected users
const log4js = require('log4js');						//for extensive logging functionality

//AWS middleware magic
require('aws-serverless-express/middleware');
//load .env variables
require('dotenv').config();

//log4js config
var log4jsConfig = {
	appenders: { out: { type: 'stdout', layout: {
		type: 'pattern',
		//Non-colored pattern layout (default)
		pattern: '[%x{tier}] [%p] %c.%x{funcName} - %m',
		tokens: {
			'tier': logEvent => {
				if (process.env.ALIAS) return process.env.ALIAS;
				else return 'LOCAL|' + process.env.TIER;
			},
			'funcName': logEvent => {
				if (logEvent.context && logEvent.context.funcName) {
					return logEvent.context.funcName;
				}
				else return '';
			},
		},
	} } },
	categories: { default: { appenders: ['out'], level: 'info' } }
};
if( process.env.COLORIZE_LOGS == 'true'){
	//Colored pattern layout
	log4jsConfig.appenders.out.layout.pattern = '%[[%d{hh:mm:ss}] [%x{tier}] [%p] %c.%x{funcName} - %]%m';
}
log4js.configure(log4jsConfig);

const logger = log4js.getLogger();
logger.level = 'debug';

//load custom middleware
const usefunctions = require('./helpers/usefunctions');
//load database utilities
const utilities = require('@firstteam102/scoutradioz-utilities');
//Configure utilities with the full file path of our databases json file
utilities.config(require('./databases.json'), {
	cache: {
		enable: true,
		maxAge: 30,
	},
	debug: false,
});
//Load helper functions
const helpers = require('@firstteam102/scoutradioz-helpers');
//Configure helper functions by passing our already-configured utilities module
helpers.config(utilities);

//PUG CACHING (if production IS enabled)
if(process.env.NODE_ENV == 'production') logger.info('Pug caching will be enabled.');

//Create app
const app = express();

//Must be the very first app.use
app.use(utilities.refreshTier);

//Boilerplate setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public', 'icon-32.png')));

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

//Session
console.log('app.js: app.use(session({... - START');
const MongoClient = require('mongodb').MongoClient;
//Get promise for MongoClient
const clientPromise = new Promise((resolve, reject) => {
	logger.debug('Waiting for utilities.getDBurl');
	//2020-03-23 JL: Made getDBurl() async to wait for TIER to be given
	utilities.getDBurl()
		.then(url => {
			logger.info('Got url');
			//Connect mongoClient to dbUrl specified in utilities
			MongoClient.connect(url, {useUnifiedTopology: true}, function(err, client){
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
	
	store: new MongoStore({
		//Use same URL that utilities uses for database
		clientPromise: clientPromise,
		//client: sessionDb,
		ttl: 3 * 24 * 60 * 60, // Time-to-live, in seconds.
		autoRemove: 'interval',
		autoRemoveInterval: 10, // In minutes. Default
		touchAfter: 24 * 3600, // time period in seconds for lazy loading session
		mongoOptions: {
			useUnifiedTopology: true
		}
	})
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

//USER ROUTES
var index = require('./routes/index');
var user = require('./routes/user');
var dashboard = require('./routes/dashboard');
var scouting = require('./routes/scouting');
var reports = require('./routes/reports');
var notifications = require('./routes/notifications');
var share = require('./routes/share.js');
//ORG MANAGEMENT ROUTES
var manageindex = require('./routes/manage/indexmgmt');
var allianceselection = require('./routes/manage/allianceselection');
var currentevent = require('./routes/manage/currentevent');
var config = require('./routes/manage/orgconfig');
var manualdata = require('./routes/manage/manualdata');
var orgmembers = require('./routes/manage/members');
var scoutingaudit = require('./routes/manage/scoutingaudit');
var scoutingpairs = require('./routes/manage/scoutingpairs');
//SCOUTRADIOZ ADMIN ROUTES
var adminindex = require('./routes/admin/indexadmin');
var externaldata = require('./routes/admin/externaldata');
var sync = require('./routes/admin/sync');

//CONNECT URLS TO ROUTES
app.use('/', index);
app.use('/user', user);
app.use('/scouting', scouting);
app.use('/dashboard', dashboard);
app.use('/reports', reports);
app.use('/allianceselection', allianceselection);
app.use('/notifications', notifications);

app.use('/manage', manageindex);
app.use('/manage/config', config);
app.use('/manage/scoutingpairs', scoutingpairs);
app.use('/manage/members', orgmembers);
app.use('/manage/currentevent', currentevent);
app.use('/manage/scoutingaudit', scoutingaudit);
app.use('/manage/manualdata', manualdata);

app.use('/admin', adminindex);
app.use('/admin/sync', sync);
app.use('/admin/externaldata', externaldata);

app.use('/', share);

// catch 404 and forward to error handler
app.use(usefunctions.notFoundHandler);
// error handler
app.use(usefunctions.errorHandler);

// Export your express server so you can import it in the lambda function.
module.exports = app;
