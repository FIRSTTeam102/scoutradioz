const express = require('express');						//main express shiz
const path = require('path');							//for filesystem
const favicon = require('serve-favicon');				//serves favicon
const bodyParser = require('body-parser');				//parses http request information
const session = require('express-session');				//session middleware (uses cookies)
const MongoStore = require('connect-mongo')(session);	//Alternative session storage
const passport = require('passport');					//for user authentication
const useragent = require('express-useragent');			//for info on connected users
const log4js = require('log4js');						//for extensive logging functionality

//AWS middleware magic
require('aws-serverless-express/middleware');
//load .env variables
require('dotenv').config();

//logger config
const logger = log4js.getLogger();
logger.level = 'debug';
/*log4js.configure({
	appenders: { cheese: { type: 'file', filename: 'cheese.log' } },
	categories: { default: { appenders: ['cheese'], level: 'error' } }
});*/
//logger levels: trace, debug, info, warn, error, fatal

const usefunctions = require("./helpers/usefunctions");	//extra functions for app.use
const utilities = require('./utilities');				//database utilities

//PUG CACHING (if production IS enabled)
if(process.env.NODE_ENV == "production"){
	logger.info("Pug caching will be enabled.");
}

//Create app
const app = express();

//Boilerplate setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public', 'favicon.png')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

//Session
app.use(session({
    secret: 'marcus night',
    saveUninitialized: false, // don't create session until something stored
	resave: false, //don't save session if unmodified
	
	store: new MongoStore({
		//Use same URL that utilities uses for database
        url: utilities.getDBurl(),
        ttl: 3 * 24 * 60 * 60, // = 14 days. Default
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

app.use(async function(req, res, next){
	//For logging
	req.requestTime = Date.now();
	
	if(req.user){
		var userRole = await utilities.findOne("roles", {role_key: req.user.role_key});
			
		//Add user's role to user obj so we don't have to go searching in db every damn second
		req.user.role = userRole;	
	}
	
	next();
});

//sets view engine vars for user
app.use(usefunctions.userViewVars);
//Event stuff
app.use(usefunctions.getEventInfo);
//Logging and timestamping
app.use(usefunctions.logger);
//adds logging to res.render function
app.use(usefunctions.renderLogger);

//Authentication function (req.authenticate)
app.use(function(req, res, next){
	
	req.authenticate = async function(accessLevel){
		
		var req = this, res = this.res;
		
		var isAuthenticated = false;
		
		//Parse number from accessLevel
		accessLevel = parseInt( accessLevel );
		
		//Throw if access level is not a valid number (Programming error)
		if( isNaN(accessLevel) ) throw new Error("req.authenticate: Access level is not a number (Check naming of process.env.ACCESS_X)");
		
		var user = req.user;
		
		//If user is undefined, create object to avoid errors
		if(!user) user = {};
		
		//Get information about user's role
		var userRole = user.role;
			
		//If userRole is undefined, create object to avoid errors
		if(!userRole) userRole = {};
		
		//Log authentication request
		res.log(`User ${user.name} (${userRole.access_level}) has requested access to '${req.path}' (${accessLevel})`);
		
		//If user has the correct access level, then set isAuthenticated to true
		if( userRole.access_level >= accessLevel ){
			
			isAuthenticated = true;
		}
		
		//Finally, check if isAuthenticated is true, and return a value corresponding to it
		if( isAuthenticated ){
			
			return true;
		}
		//If user does not have the correct access level, then handle redirection and return false
		else{
			
			var redirectMessage, redirectURL;
			
			switch( accessLevel ){
				case parseInt(process.env.ACCESS_VIEWER):
					redirectURL = req.originalUrl;
					break;
				case parseInt(process.env.ACCESS_SCOUTER):
					redirectMessage = "Sorry, you must log in as a scouter to access this page."
					break;
				case parseInt(process.env.ACCESS_TEAM_ADMIN):
				case parseInt(process.env.ACCESS_GLOBAL_ADMIN):
					redirectMessage = "Sorry, you do not have access to this page."
					break;
			}
			
			var url = `/?alert=${redirectMessage}&redirectURL=${redirectURL}`;
			
			res.redirect(url);
			
			return false;
		}
	}
	
	next();
})

//USER ROUTES
var index = require('./routes/index');
var user = require('./routes/user');
var dashboard = require("./routes/dashboard");
var scouting = require("./routes/scouting");
var reports = require('./routes/reports');
var notifications = require('./routes/notifications');
var webhook = require('./routes/webhook');
//ORG MANAGEMENT ROUTES
var manageindex = require('./routes/manage/indexmgmt');
var allianceselection = require('./routes/manage/allianceselection');
var currentevent = require("./routes/manage/currentevent");
var config = require("./routes/manage/orgconfig");
var externaldata = require("./routes/manage/externaldata");
var manualdata = require("./routes/manage/manualdata");
var orgmembers = require("./routes/manage/members");
var scoutingaudit = require("./routes/manage/scoutingaudit");
var scoutingpairs = require('./routes/manage/scoutingpairs');
//SCOUTRADIOZ ADMIN ROUTES
var adminindex = require('./routes/admin/indexadmin');

//CONNECT URLS TO ROUTES
app.use('/', index);
app.use('/user', user);
app.use('/scouting', scouting);
app.use("/dashboard", dashboard);
app.use('/reports', reports);
app.use('/allianceselection', allianceselection);
app.use('/notifications', notifications);
app.use('/webhook', webhook);

app.use('/manage', manageindex);
app.use('/manage/config', config);
app.use('/manage/scoutingpairs', scoutingpairs);
app.use("/manage/members", orgmembers);
app.use('/manage/data', externaldata);
app.use('/manage/currentevent', currentevent);
app.use('/manage/scoutingaudit', scoutingaudit);
app.use('/manage/manualdata', manualdata);

app.use('/admin', adminindex);

// catch 404 and forward to error handler
app.use(usefunctions.notFoundHandler);
// error handler
app.use(usefunctions.errorHandler);

// Export your express server so you can import it in the lambda function.
module.exports = app;
