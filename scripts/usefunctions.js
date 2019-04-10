const colors = require("colors");
const monk = require("monk");						//Monk for connecting to db
const fs = require("fs");

var functions = module.exports = {};

/**
 * One-time (non-Express) function that returns Monk DB, with specified DB string name.
 * @param {string} dbName name of DB
 * @return {*} Monk db
 */
functions.getDB = function(dbName){
	
	//check if we have a db user file
	var hasDBUserFile = fs.existsSync(".dbuser");
	var db;
	
	if(hasDBUserFile){
		var dbUser = JSON.parse(fs.readFileSync(".dbuser", {"encoding": "utf8"}));
		console.log(dbUser);
		console.log(`${dbUser.username}:${dbUser.password}@localhost:27017/${dbName}`);	
		db = monk(`${dbUser.username}:${dbUser.password}@localhost:27017/${dbName}`);	
	}
	else{
		db = monk(`localhost:27017/${dbName}`);			//Local db on localhost without authentication
	}
	
	return db;
}

//View engine locals variables
functions.userViewVars = function(req, res, next){
	
	if(req.user)
		res.locals.user = req.user;
		
	else if(req.app.isDev == true){
		
		req.user = {name: '[Dev]', subteam: 'support'};
		res.locals.user = req.user;
	}
	next();
}

/**
 * Gets event info from local db
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
functions.getEventInfo = function(req, res, next) {
	
	//req.passport = passport;
	req.event = {
		key: "undefined",
		name: "undefined"
	};
	
	//Get s collections for finding current event
	var db = req.db;
	var current = db.get('current');
	var events = db.get('events');
	
	//finds current event
	current.find({}, {}, function(e, current) {
		
		//sets locals to no event defined just in case we don't find thing and we can just do next();
		var eventId = 'No event defined';
		var eventYear = 'No year defined';
		res.locals.eventName = eventId;
		
		//if exist
		if (current && current[0]){
			
			eventId = current[0].event;
			eventYear = parseInt(eventId)
			//set event key
			req.event.key = eventId;
			req.event.year = eventYear;
			res.locals.event_key = req.event.key;
			res.locals.event_year = req.event.year;
			
			//find data for current event
			events.find({ key: eventId }, {}, function(e, event){
				
				if(e){
					console.error(e);
					return next();
				}
				//set tournament thing to event name
				if(event && event[0]){
					res.locals.eventName = event[0].name;
					req.event.name = event[0].name;
					next();
				}else{
					next();
				}
			});
		}else{
			next();
		}
	});
}

/**
 * logger for res.log
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
functions.logger = function(req, res, next){
	
	res.log = function(message, param2, param3){
		var color, override = false;
		if(typeof(param2) == "boolean")
			override = param2;
		if(typeof(param2) == "string")
			color = param2;
		if(typeof(param3) == "boolean")
			override = param3;
		if(typeof(param3) == "string")
			color = param3;
		
		//res.debug is set to app.debug inside app.js
		if(req.app.debug || override){
			if(typeof(message) == "string" && color != undefined)
				console.log(message[color]);
			else
				console.log(message);
		}
	}
		
	//Sets variables accessible to any page from req (request) object
	//req.requestTime = Date.now(); req.requestTime IS NOW SET INSIDE APP.JS
	
	//formatted request time for logging
	let d = new Date(req.requestTime),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear(),
		hours = d.getHours(),
		minutes = d.getMinutes(),
		seconds = d.getSeconds();
	month = month.length<2? '0'+month : month;
	day = day.length<2? '0'+day : day;
	let formattedReqTime = (
		[year, month, day, [hours, minutes, seconds].join(':')].join('-')
	)
	
	//user agent
	req.shortagent = {
		ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
		device: req.useragent.isMobile ? "mobile" : req.useragent.isDesktop ? "desktop" : (req.useragent.isiPad || req.useragent.isAndroidTablet) ? "tablet" : req.useragent.isBot ? "bot" : "other",
		os: req.useragent.os,
		browser: req.useragent.browser
	}
	//logs request
	console.log( (req.method).red 
		+ " Request from " 
		+ req.shortagent.ip
		+ " on " 
		+ req.shortagent.device 
		+ "|"
		+ req.shortagent.os
		+ "|"
		+ req.shortagent.browser
		+ " to "
		+ (req.url).cyan
		+ " at "
		+ formattedReqTime);
	
	next();
}

/**
 * Logs when res.render is called
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
functions.renderLogger = function(req, res, next){
	
	//Changes res.render
	res.render = (function(link, param){
		var cached_function = res.render;
		
		return function(link, param){
			
			//stores pre-render post-request time
			let beforeRenderTime = Date.now() - req.requestTime;
			
			//applies render function
			let result = cached_function.apply(this, arguments);
			
			//stores post-render time
			let renderTime = Date.now() - req.requestTime - beforeRenderTime;
			
			//logs if debug
			this.log("Completed route in "
				+ (beforeRenderTime).toString().yellow
				+ " ms; Rendered page in " 
				+ (renderTime).toString().yellow
				+ " ms");
			
			return result;
		}
	}());
	next();
}

/**
 * Sets up node rest client
 * @param {*} req
 * @param {*} res 
 * @param {*} next 
 */
functions.setupNodeRestClient = function(req, res, next){
	
	var passwordsCol = req.db.get("passwords");
	
	//Get thebluealliance API key from db
	passwordsCol.find({ name:"thebluealliance-args" }, function(e, args){
		if(e || !args[0]){
			res.log(e, true);
			return res.status(500).send("couldn't find TBA args in db");
		}
		args = args[0];
		
		//set up node rest client
		var Client = require('node-rest-client').Client;
		var client = new Client();
		
		//adds client func and args to req
		req.client = client;
		req.tbaRequestArgs = args;
		
		next();
	});
};
 
/**
 * Handles 404 errors
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
functions.notFoundHandler = function(req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
};

/**
 * Handles other errors
 * @param {} err 
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
functions.errorHandler = function(err, req, res, next) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};
  
	// render the error page
	res.status(err.status || 500);
	res.render('error');
}