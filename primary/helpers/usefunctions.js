const logger = require('log4js').getLogger('usefunctions');
const utilities = require('@firstteam102/scoutradioz-utilities');
const navHelpers = require('./nav');

require('colors');

var functions = module.exports = {};

//Go-to one-stop-shop for tidbits and bipbops that we wanna add in every method
functions.initialMiddleware = async function(req, res, next){
	//For logging
	req.requestTime = Date.now();
	
	if(req.user){
		var userRole = await utilities.findOne('roles', 
			{role_key: req.user.role_key}, {},
			{allowCache: true, maxCacheAge: 120});
			
		//Add user's role to user obj so we don't have to go searching in db every damn second
		req.user.role = userRole;
	}
	
	//Remove funcName from log4js context so that it does not stay persistent
	// from one method that DOES set it to another method that does NOT set it
	logger.removeContext('funcName');
	
	// Gets the redirectURL, automatically with ? and & encoded
	req.getRedirectURL = function() {
		let str = this.body.redirectURL || this.query.redirectURL;
		return this.fixRedirectURL(str);
	};
	
	// Function to fix redirectURL by urlencoding ? and &, and clearing it if it's "undefined"
	req.fixRedirectURL = function(str) {
		if (typeof str !== 'string') return str;
		else if (str === 'undefined') return undefined;
		else return str.replace(/\?/g, '%3f').replace(/\&/g, '%26');
	};
	
	next();
};

functions.authenticate = function(req, res, next) {
	
	var authenticate = async function (accessLevel) {
		
		var isAuthenticated = false;
		
		//Parse number from accessLevel
		accessLevel = parseInt( accessLevel );
		
		//Throw if access level is not a valid number (Programming error)
		if( isNaN(accessLevel) ) throw new Error('req.authenticate: Access level is not a number (Check naming of process.env.ACCESS_X)');
		
		var user = req.user;
		
		if (user) {
			
			var userRole = user.role;
			logger.info(`User ${user.name} (${userRole.access_level}) has requested access to '${req.originalUrl}' (${accessLevel})`);
			
			//If user has the correct access level, then set isAuthenticated to true
			if( userRole.access_level >= accessLevel ){
				
				isAuthenticated = true;
			}
			// If user does not have the correct access level, then handle redirection and return false
			else{
				
				if (req.method == 'GET' && user.name == 'default_user') {
					res.redirect(`/user/login?redirectURL=${req.originalUrl}`);
				}
				else {
					res.redirect('/?alert=You are not authorized to access this page.&type=error');
				}
			}
		}
		// If user is undefined, then send them to the index page to select an organization
		else {
			
			res.redirect(`/?redirectURL=${req.originalUrl}`);
		}
		
		return isAuthenticated;
	};
	
	//write authenticate function to req
	Object.defineProperty(req, 'authenticate', {
		value: authenticate,
		writable: false
	});
	
	next();
};

// Constant, no need to re-get each time
const navcontents = navHelpers.getNavContents();

//View engine locals variables
//IMPORTANT: Must be called LAST, because it may rely on other usefunctions data
functions.setViewVariables = async function(req, res, next){
	logger.addContext('funcName', 'setViewVariables');
	logger.debug('ENTER');
	
	if(req.user) {
		const org = await utilities.findOne('orgs', 
			{org_key: req.user.org_key},
			{},
			{allowCache: true}
		);
		req.user.org = org;
		res.locals.user = req.user;
	} 
	
	var fileRoot;
	
	//If we have set a process tier and S3 bucket name, then set fileRoot to an S3 url
	if( process.env.TIER && process.env.S3_BUCKET && process.env.STATICFILES_USE_S3 == 'true' ){
		
		fileRoot = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${process.env.TIER}`;
	}
	//Otherwise set fileRoot as / for local filesystem
	else{
		
		fileRoot = '';
	}
	
	res.locals.fileRoot = fileRoot;
	
	//Set alert local in here so that we don't have to throw this into Every Single Route
	res.locals.alert = req.query.alert;
	res.locals.alertType = req.query.type;
	res.locals.alertAutoFade = req.query.autofade;
	res.locals.isIOS = (
		req.shortagent.browser == 'Safari'
		|| req.shortagent.os == 'OS X'
	) ? true : false;
	
	// Compile the navcontents according to the current user's state
	res.locals.navcontents = navHelpers.compileNavcontents(navcontents, req, res);
	
	logger.debug('EXIT');
	logger.removeContext('funcName');
	next();
};

/**
 * Gets event info from local db
 */
functions.getEventInfo = async function(req, res, next) {
	logger.addContext('funcName', 'getEventInfo');
	
	//Define req.event
	req.event = {
		key: 'undefined',
		name: 'undefined',
		year: 'undefined',
	};
	
	// replacing 'current' collection with "currentEvent" attribute in a specific org [tied to the user after choosing an org]
	var thisOrg;
	if (req && req.user && req.user.org_key) {
		var thisOrgKey = req.user.org_key;
		thisOrg = await utilities.findOne('orgs', 
			{'org_key': thisOrgKey}, 
			{},
			{allowCache: true}
		);
	}

	//sets locals to no event defined just in case we don't find thing and we can just do next();
	var eventKey = 'No event defined';
	var eventYear = 'No year defined';
	res.locals.eventName = eventKey;
	res.locals.url = req.url;
	
	//if exist
	if (thisOrg) {
		
		eventKey = thisOrg.event_key;
		eventYear = parseInt(eventKey);
		//set event key
		req.event.key = eventKey;
		req.event.year = eventYear;
		res.locals.event_key = req.event.key;
		res.locals.event_year = req.event.year;
		
		var currentEvent = await utilities.findOne('events', 
			{key: eventKey}, 
			{},
			{allowCache: true, maxCacheAge: 60},
		);
		
		//logger.debug(`currentEvent: ${JSON.stringify(currentEvent)}`)
		
		if (currentEvent) {
			//Set current event info to req.event and res.locals
			res.locals.eventName = currentEvent.year + ' ' + currentEvent.name;
			req.event.name = currentEvent.name;
			
			//If a list of teams exists, find team info in teams db.
			if (currentEvent.team_keys && currentEvent.team_keys.length > 0) {
				
				var teams = await utilities.find('teams', 
					{'key': {$in: currentEvent.team_keys}}, 
					{sort: {team_number: 1}}, 
					{allowCache: true, maxCacheAge: 60}
				);
				
				logger.debug(`teams: length(${teams.length})`);
				//Set teams list to its own variable
				req.teams = teams;
				res.locals.teams = teams;
			}
		}
	}
	
	logger.removeContext('funcName');
	next();
};

/**
 * Logs requests and user agent
 */
functions.requestLogger = function(req, res, next){
	
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
	);
	
	//user agent
	req.shortagent = {
		ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
		device: req.useragent.isMobile ? 'mobile' : req.useragent.isDesktop ? 'desktop' : (req.useragent.isiPad || req.useragent.isAndroidTablet) ? 'tablet' : req.useragent.isBot ? 'bot' : 'other',
		os: req.useragent.os,
		browser: req.useragent.browser
	};
	//logs request
	logger.info( (req.method).red 
		+ ' Request from ' 
		+ req.shortagent.ip
		+ ' on ' 
		+ req.shortagent.device 
		+ '|'
		+ req.shortagent.os
		+ '|'
		+ req.shortagent.browser
		+ ' to '
		+ (req.url).cyan
		+ ' at '
		+ formattedReqTime);
	//fds
	
	res.locals.shortagent = req.shortagent;
	
	next();
};


/**
 * Extra logging for res.render and res.redirect
 */
functions.renderLogger = function(req, res, next){
	
	res.render = (function(link, param){
		var cached_function = res.render;
		
		return function(link, param){
			
			//stores pre-render post-request time
			let beforeRenderTime = Date.now() - req.requestTime;
			
			//applies render function
			let result = cached_function.apply(this, arguments);
			
			//stores post-render time
			let renderTime = Date.now() - req.requestTime - beforeRenderTime;
			
			let appender = '[cache=0]';
			if (utilities.options && utilities.options.cache.enable == true) {
				appender = '[cache=1]';
			}
			
			logger.info(`Completed route in ${(beforeRenderTime).toString().yellow} ms; Rendered in ${(renderTime).toString().yellow} ms ${appender} \t[Route: ${res.req.originalUrl.brightGreen} View: ${link.brightGreen}]`);
			
			return result;
		};
	}());
	
	res.redirect = (function(){
		var cached_function = res.redirect;
		
		return function(arg1, arg2){
			
			//stores pre-render post-request time
			let completedRouteTime = Date.now() - req.requestTime;
			
			// res.redirect supports either (string) or (code, string)
			let url, status;
			if (arg1 && arg2) {
				url = arg2;
				status = arg1;
			}
			else {
				url = arg1;
			}
			// Replace any instances of ? with & *after* the first
			// 	To avoid issues like /dashboard/driveteam?team_key=frc102?alert=Saved%20column%20preferences%20successfully.&type=success&autofade=true
			let idx = 0;
			url = url.replace(/\?/g, (match) => ++idx >= 2 ? '&' : match);
			
			
			// Apply the render function with modified URL
			let result;
			if (status) result = cached_function.apply(this, [status, url]);
			else result = cached_function.apply(this, [url]);
			
			//logger.info(`Completed ${res.req.url} in ${(completedRouteTime).toString().yellow} ms; Redirecting to ${(typeof url == 'string' ? url : ' ').yellow + (typeof status == 'string' ? status : ' ').yellow}`);
			logger.info(`Completed route in ${(completedRouteTime).toString().yellow} ms \t[Route: ${res.req.originalUrl.brightGreen} Redirecting to: ${(typeof url == 'string' ? url : ' ').yellow + (typeof status == 'string' ? status : ' ').yellow}]`);
			
			return result;
		};
	}());
	
	next();
};
 
/**
 * Handles 404 errors
 */
functions.notFoundHandler = function(req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
};

/**
 * Handles all errors
 */
functions.errorHandler = function(err, req, res, next) {
	logger.addContext('funcName', 'errorHandler');
	
	var title;
	var viewError = {};
	
	viewError.message = err.message;
	viewError.status = err.status;
	switch (err.status) {
		case 400:
			title = 'Error';
			viewError.statusMessage = 'Bad Request';
			break;
		case 401:
			title = 'Unauthorized';
			viewError.statusMessage = 'Unauthorized';
			break;
		case 403:
			title = 'Forbidden';
			viewError.statusMessage = 'Forbidden';
			break;
		case 404:
			title = 'Not Found';
			viewError.statusMessage = 'Not Found';
			break;
		case 500:
			title = 'Error';
			viewError.statusMessage = 'Internal Server Error';
			break;
		default:
			title = 'Error';
			break;
	}
	
	//Only provide error stack in development
	if (req.app.get('env') == 'development') {
		viewError.stack = err.stack;
	}
	
	logger.warn(typeof err.stack);
	logger.error(err.message + '\n' + err.stack);
	
	// render the error page
	res.status(err.status || 500);
	res.render('error', {
		title: title,
		error: viewError
	});
	
	logger.removeContext('funcName');
};