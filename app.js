const express = require('express');					//main express shiz
const path = require('path');						//for filesystem
const favicon = require('serve-favicon');			//serves favicon
const bodyParser = require('body-parser');			//parses http request information
const useragent = require('express-useragent');		//for info on connected users
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware');
const usefunctions = require("./scripts/usefunctions");	//extra functions for app.use
const app = express();

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
	/////////////////req.db = db;
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

const index = require('./routes/index');

const router = express.Router();

router.get('/', function(req, res){
	
	res.render('index');
});

app.use('/', router);

// Export your express server so you can import it in the lambda function.
module.exports = app;
