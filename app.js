'use strict'
//process.env.NODE_ENV = "production";

var times = [];

times.push({time: Date.now()});

const express = require('express');					//main express shiz
const path = require('path');						//for filesystem
const favicon = require('serve-favicon');			//serves favicon
const bodyParser = require('body-parser');			//parses http request information
const useragent = require('express-useragent');		//for info on connected users
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware');
const usefunctions = require("./scripts/usefunctions");	//extra functions for app.use
const app = express();

times.push({time: Date.now(), event: "Got modules"});

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

times.push({time: Date.now(), event: "app.use boilerplate"});

// NOTE: tests can't find the views directory without this

times.push({time: Date.now(), event: "app.set views"});


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

times.push({time: Date.now(), event: "require index"});

const router = express.Router();

times.push({time: Date.now(), event: "create Router"});

router.get('/', function(req, res){
	
	times.push({time: Date.now(), event: "in index route"});
	
	res.render('index');
	
	times.push({time: Date.now(), event: "Done rendering"});
	
	var message = "";
	
	for(var i = 1; i < times.length; i++){
		message += (times[i].time - times[i-1].time) + " " + times[i].event + "\n";
	}
	
	console.log(message);
});

times.push({time: Date.now(), event: "declare router index func"});

app.use('/', router);

times.push({time: Date.now(), event: "app.use declaration"});


var message = "";
	
for(var i = 1; i < times.length; i++){
	message += (times[i].time - times[i-1].time) + " " + times[i].event + "\n";
}

console.log(message);

// Export your express server so you can import it in the lambda function.
module.exports = app;
