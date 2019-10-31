const express = require('express');						//main express shiz
const path = require('path');							//for filesystem
const bodyParser = require('body-parser');				//parses http request information
const useragent = require('express-useragent');			//for info on connected users
const log4js = require('log4js');						//for extensive logging functionality

const usefunctions = require('./helpers/usefunctions');

//AWS middleware magic
require('aws-serverless-express/middleware');
//load .env variables
require('dotenv').config();

//logger config
if( process.env.COLORIZE_LOGS != 'true'){
	
	log4js.configure({
		appenders: { out: { type: 'stdout', layout: { type: 'basic' } } },
		categories: { default: { appenders: ['out'], level: 'info' } }
	});
}

const logger = log4js.getLogger();
logger.level = 'debug';


const tier = process.env.TIER || ""

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

//CONNECT URLS TO ROUTES
app.use(`/${tier}`, upload);
app.use(`/${tier}/generate`, generate)

// catch 404 and forward to error handler
app.use(usefunctions.notFoundHandler);
// error handler
app.use(usefunctions.errorHandler);

// Export your express server so you can import it in the lambda function.
module.exports = app;
