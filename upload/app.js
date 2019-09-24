const express = require('express');						//main express shiz
const path = require('path');							//for filesystem
const bodyParser = require('body-parser');				//parses http request information
const useragent = require('express-useragent');			//for info on connected users

const usefunctions = require('./helpers/usefunctions');

//AWS middleware magic
require('aws-serverless-express/middleware');
//load .env variables
require('dotenv').config();

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
	//For database
	//req.db = db;
	//req.db = await getDB();
	//For user login
	//req.passport = passport;
	
	//res.locals.s3url = "https://s3.amazonaws.com/scoringapp-bkt/public/";
	
	next();
});

//Logging and timestamping
app.use(usefunctions.logger);

//USER ROUTES
var index = require("./routes/index");
var upload = require("./routes/upload");

//CONNECT URLS TO ROUTES
app.use('/', index);
app.use('/upload', upload);

// catch 404 and forward to error handler
app.use(usefunctions.notFoundHandler);
// error handler
app.use(usefunctions.errorHandler);

// Export your express server so you can import it in the lambda function.
module.exports = app;
