const express = require('express');					//main express shiz
const path = require('path');						//for filesystem
const favicon = require('serve-favicon');			//serves favicon
const bodyParser = require('body-parser');			//parses http request information
const useragent = require('express-useragent');		//for info on connected users
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware');
const monk = require("monk");						//Monk for connecting to db
const usefunctions = require("./scripts/usefunctions");	//extra functions for app.use
const app = express();

var db;
//db = monk("localhost:27017/app");			//Local db on localhost without authentication
db = monk("mongodb+srv://USER:PASSWORD@scoutradioz-test-01-obbqu.mongodb.net/test?retryWrites=true&w=majority");

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

//PUG CACHING (if dev is NOT enabled or production IS enabled)
if(!isDev || production){
	console.log("Production");
	process.env.NODE_ENV = "production";
}

//set app's bools to these arguments
app.isDev = isDev; 
app.debug = debug; 

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

//Boilerplate setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

//User agent for logging
app.use(useragent.express());

app.use(function(req, res, next){
	//For logging
	req.requestTime = Date.now();
	//For database
	req.db = db;
	//For user login
	////////////////req.passport = passport;
	
	res.locals.s3url = "https://s3.amazonaws.com/scoringapp-bkt/public/";
	
	next();
});
//sets view engine vars for user
//app.use(useFunctions.userViewVars);
//Event stuff
//app.use(useFunctions.getEventInfo);
//Logging and timestamping
app.use(usefunctions.logger);
//adds logging to res.render function
app.use(usefunctions.renderLogger);
//adds TBA API key to req
//app.use(useFunctions.setupNodeRestClient);

//const index = require('./routes/index');

//app.use('/', index);

//USER ROUTES
var index = require('./routes/index');
var login = require('./routes/login');
var dashboard = require("./routes/dashboard");
var scouting = require("./routes/scouting");
var reports = require('./routes/reports');
var allianceselection = require('./routes/allianceselection');
var image = require("./routes/image");
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
app.use('/login', login);
app.use('/scouting', scouting);
app.use("/dashboard", dashboard);
app.use('/reports', reports);
app.use('/allianceselection', allianceselection);
app.use('/admin', adminindex);
app.use('/admin/scoutingpairs', scoutingpairs);
app.use("/admin/teammembers", teammembers);
app.use('/admin/data', externaldata);
app.use('/admin/current', current);
app.use('/admin/audit', scoutingaudit);
app.use('/admin/manualinput', manualinput);
app.use('/image', image);

// catch 404 and forward to error handler
app.use(usefunctions.notFoundHandler);
// error handler
app.use(usefunctions.errorHandler);


// Export your express server so you can import it in the lambda function.
module.exports = app;
