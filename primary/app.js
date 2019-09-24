const express = require('express');						//main express shiz
const path = require('path');							//for filesystem
const favicon = require('serve-favicon');				//serves favicon
const bodyParser = require('body-parser');				//parses http request information
const session = require('express-session');				//session middleware (uses cookies)
const MongoStore = require('connect-mongo')(session);	//Alternative session storage
const passport = require('passport');					//for user authentication
const useragent = require('express-useragent');			//for info on connected users

//AWS middleware magic
require('aws-serverless-express/middleware');
//load .env variables
require('dotenv').config();

const usefunctions = require("./helpers/usefunctions");	//extra functions for app.use
const utilities = require('./utilities');				//database utilities

//          This is set temporarily
var isDev = false, debug = false, production = false;

/* Check process arguments.
	If -dev or --dev, isDev = true.
	If -debug or --debug, debug = true.
	If -d or --d, both = true.
*/
for(var i in process.argv){
	switch(process.argv[i]){
		case "-dev":
		case "--dev":
			console.log("Dev");
			isDev = true;
			break;
		case "-d":
		case "--d":
			console.log("Dev");
			isDev = true;
		case "-debug":
		case "--debug":
			console.log("Debug");
			debug = true;
			break;
		case "-production":
		case "--production":
			production = true;
	}
}

//PUG CACHING (if production IS enabled)
if(production){
	console.log("Production");
	process.env.NODE_ENV = "production";
}

//Create app
const app = express();

//set app's bools to these arguments
app.isDev = isDev; 
app.debug = debug; 

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
	//For database
	//rq.db = db;  (was 'req')
	//rq.db = await getDB(); (was 'req')
	//For user login
	//req.passport = passport;
	
	//res.locals.s3url = "https://s3.amazonaws.com/scoringapp-bkt/public/";
	
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
		var userRole = await utilities.findOne("roles", {role_key: user.role_key});
			
		//If userRole is undefined, create object to avoid errors
		if(!userRole) userRole = {};
		
		//Log authentication request
		res.log(`User ${user.name} (${userRole.access_level}) has requested access to '${req.url}' (${accessLevel})`);
		
		//If user has the correct access level, then set isAuthenticated to true
		if( userRole.access_level >= accessLevel ){
			
			isAuthenticated = true;
		}
		
		//Finally, check if isAuthenticated is true, and return a value corresponding to it
		if( isAuthenticated || app.isDev ){
			
			return true;
		}
		//If user does not have the correct access level, then redirect and return false
		else{
			
			res.redirect('/?alert=Sorry, you do not have access to this page.');
			
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
var allianceselection = require('./routes/allianceselection');
var notifications = require('./routes/notifications');
var webhook = require('./routes/webhook');
//var image = require("./routes/image");
//ADMIN ROUTES
var adminindex = require('./routes/admin/adminindex');
var scoutingaudit = require("./routes/admin/audit");
var current = require("./routes/admin/current");
var externaldata = require("./routes/admin/externaldata");
var scoutingpairs = require('./routes/admin/scoutingpairs');
var teammembers = require("./routes/admin/teammembers");
var manualinput = require("./routes/admin/manualinput");

//CONNECT URLS TO ROUTES
app.use('/', index);
app.use('/user', user);
app.use('/scouting', scouting);
app.use("/dashboard", dashboard);
app.use('/reports', reports);
app.use('/allianceselection', allianceselection);
app.use('/notifications', notifications);
app.use('/webhook', webhook);

app.use('/admin', adminindex);
app.use('/admin/scoutingpairs', scoutingpairs);
app.use("/admin/teammembers", teammembers);
app.use('/admin/data', externaldata);
app.use('/admin/current', current);
app.use('/admin/audit', scoutingaudit);
app.use('/admin/manualinput', manualinput);
//app.use('/image', image);

// catch 404 and forward to error handler
app.use(usefunctions.notFoundHandler);
// error handler
app.use(usefunctions.errorHandler);

// Export your express server so you can import it in the lambda function.
module.exports = app;
