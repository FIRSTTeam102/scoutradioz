import express from 'express';
import { getLogger } from 'log4js';
import utilities from '@firstteam102/scoutradioz-utilities';
import { DateTime, IANAZone, FixedOffsetZone } from 'luxon';	// Luxon lets us handle timezones and localization
import e from '@firstteam102/http-errors';
import Permissions from './permissions';
import 'colors';


const logger = getLogger('usefunctions');
const navHelpers = require('../helpers/nav');

// There are some pages where we don't want the year, but the rest of the string is good
class DateTimeExtras {
	static DATETIME_SHORTER: Intl.DateTimeFormatOptions;
}
DateTimeExtras.DATETIME_SHORTER = { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' };

class UseFunctions {
	
	//Go-to one-stop-shop for tidbits and bipbops that we wanna add in every method
	static async initialMiddleware(req: express.Request, res: express.Response, next: express.NextFunction){
		//For logging
		req.requestTime = Date.now();
		
		if(req.user){
			let userRole = await utilities.findOne('roles', 
				{role_key: req.user.role_key}, {},
				{allowCache: true, maxCacheAge: 120});
				
			//Add user's role to user obj so we don't have to go searching in db every damn second
			req.user.role = userRole;
		}
		
		//Remove funcName from log4js context so that it does not stay persistent
		// from one method that DOES set it to another method that does NOT set it
		logger.removeContext('funcName');
		
		// See express-extensions.d.ts for descriptions of the methods below
		
		req.getRedirectURL = function () {
			let str = this.body.rdr || this.query.rdr || this.body.redirectURL || this.query.redirectURL; // 2022-03-09 JL: Adding support for "rdr" field, which is more concise than redirectURL
			if (str instanceof Array) str = str[str.length-1]; // this can happen if some weird edgecase leads to redirectURL=a&redirectURL=b
			return str;
		};
		
		req.getFixedRedirectURL = function() {
			let str = this.getRedirectURL();
			return this.fixRedirectURL(str);
		};
		
		req.fixRedirectURL = function(str) {
			if (typeof str !== 'string') return str;
			else if (str === 'undefined' || str === 'null') return undefined;
			else {
				if (!str.startsWith('/')) str = '/' + str; // We always want a redirect to start with a slash (unless in the future we want to redirect to external sites)
				return str.replace(/\?/g, '%3f').replace(/\&/g, '%26');
			}
		};
		
		req.getURLWithQueryParameters = function(url, parameters) {
			let hasQuestionMark = url.includes('?');
			for (let key in parameters) {
				let arg = parameters[key];
				if (typeof arg !== 'undefined' && arg !== null && arg !== 'undefined' && arg !== '') {
					if (hasQuestionMark) {
						url += '&';
					}
					else {
						url += '?';
						hasQuestionMark = true;
					}
					url += key + '=' + String(arg);
				}
			}
			return url;
		};
	
		// 2022-04-04 JL: Moving timezoneString calculations into initialMiddleware
		if (req.cookies['timezone']) {
			logger.trace(`Setting user timezone ${req.cookies['timezone']}`);
			req.timezoneString = req.cookies['timezone'];
		}
		// 2022-05-13 JL: Can no longer use req.event.timezone because getEventInfo is called after initialMiddleware and renderLogger
		//	we can rejigger this around later if we get complaints from people who insist on blocking cookies
		// else if (req.event.timezone) { 
		// 	logger.trace(`Setting event timezone ${req.event.timezone}`);
		// 	req.timezoneString = req.event.timezone;
		// }
		else {
			logger.trace('Setting default timezone');
			req.timezoneString = 'America/New_York'; // Default to EST/EDT because we're MAR-centered
		}
		
		// Attempt to get the user's locale
		let localeString = 'en-US';
		let acceptLang = req.get('accept-language');
		if (acceptLang) {
			try {
				let firstLang = acceptLang.split(',')[0];
				let locale = new Intl.Locale(firstLang);
				if (locale.baseName) localeString = locale.baseName;
			}
			catch (err) {
				logger.debug(`Couldn't parse locale: ${err}`);
			}
		}
		req.localeString = localeString;
		
		// JL: See the JSDoc note in namespace-extensions.d.ts
		if (req.user) req._user = req.user;
	
		next();
	}
	
	static authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
	
		req.authenticate = async function (accessLevel: string|number|undefined) {
			
			//Parse number from accessLevel
			let accessLevelNum;
			if (typeof accessLevel === 'string') accessLevelNum = parseInt( accessLevel );
			else if (typeof accessLevel === 'number') accessLevelNum = accessLevel;
			else throw new e.InternalServerError('req.authenticate: accessLevel is not defined');
			
			let isAuthenticated = false;
			
			//Throw if access level is not a valid number (Programming error)
			if( isNaN(accessLevelNum) ) throw new Error('req.authenticate: Access level is not a number (Check naming of Permissions.ACCESS_X)');
			
			let user = req.user;
			
			let redirect = req.fixRedirectURL(req.originalUrl); // 2022-04-07 JL: Fixed redirects from share.js getting their URL query params borked
			
			if (user) {
				
				let userRole = user.role;
				logger.info(`User ${user.name} (${userRole.access_level}) has requested access to '${req.originalUrl}' (${accessLevelNum})`);
				
				//If user has the correct access level, then set isAuthenticated to true
				if( userRole.access_level >= accessLevelNum ){
					
					isAuthenticated = true;
				}
				// If user does not have the correct access level, then handle redirection and return false
				else{
					
					if (req.method == 'GET' && user.name == 'default_user') {
						res.redirect(`/user/login?rdr=${redirect}`);
					}
					else {
						res.redirect('/?alert=You are not authorized to access this page.&type=error');
					}
				}
			}
			// If user is undefined, then send them to the index page to select an organization
			else {
				res.redirect(`/?rdr=${redirect}`);
			}
			
			return isAuthenticated;
		};
		
		next();
	}
	
	/**
	 * View engine locals variables - IMPORTANT: Must be called LAST, because it may rely on other usefunctions data
	 * @param {Express.Request} req 
	 * @param {Express.Response} res 
	 * @param {function} next 
	 */
	static async setViewVariables(req: express.Request, res: express.Response, next: express.NextFunction){
		logger.addContext('funcName', 'setViewVariables');
		logger.trace('ENTER');
		
		if(req.user) {
			const org = await utilities.findOne('orgs', 
				{org_key: req.user.org_key},
				{},
				{allowCache: true}
			);
			req.user.org = org;
			res.locals.user = req.user;
		} 
		
		let fileRoot;
		
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
		res.locals.Permissions = Permissions;
		
		// Compile the navcontents according to the current user's state
		res.locals.navcontents = navHelpers.compileNavcontents(navcontents, req, res);
		
		// BELOW: LOCALIZATION
		
		// expose Luxon DateTime to views
		res.locals.DateTime = DateTime;
		
		// 2022-04-04 JL: Moving timezoneString calculations into initialMiddleware
		let timezoneString = req.timezoneString;
		let fixedZone = getFixedZone(timezoneString);
		let localeString = req.localeString;
		
		logger.trace(`Timezone fixed offset: ${fixedZone.offset(0)}`);
		
		// Method for views to get the offset time w/o having to do DateTime.whatever
		res.locals.zoneTime = function (millis: number) {
			return DateTime.fromMillis(millis, {zone: fixedZone, locale: localeString});
		};
		
		logger.trace('EXIT');
		logger.removeContext('funcName');
		next();
	}
	
	/**
	 * Gets event info from local db
	 */
	static async getEventInfo(req: express.Request, res: express.Response, next: express.NextFunction) {
		logger.addContext('funcName', 'getEventInfo');
		
		//Define req.event
		req.event = {
			key: 'undefined',
			name: 'undefined',
			year: -1,
			timezone: 'UTC',
		};
		
		// replacing 'current' collection with "currentEvent" attribute in a specific org [tied to the user after choosing an org]
		let thisOrg;
		if (req && req.user && req.user.org_key) {
			let thisOrgKey = req.user.org_key;
			thisOrg = await utilities.findOne('orgs', 
				{'org_key': thisOrgKey}, 
				{},
				{allowCache: true}
			);
		}
	
		//sets locals to no event defined just in case we don't find thing and we can just do next();
		let eventKey = 'No event defined';
		let eventYear = -1;
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
			
			let currentEvent = await utilities.findOne('events', 
				{key: eventKey}, 
				{},
				{allowCache: true, maxCacheAge: 60},
			);
			
			if (currentEvent) {
				//Set current event info to req.event and res.locals
				res.locals.eventName = currentEvent.year + ' ' + currentEvent.name;
				req.event.name = currentEvent.name;
				if (currentEvent.timezone) req.event.timezone = currentEvent.timezone;
				
				//If a list of teams exists, find team info in teams db.
				if (currentEvent.team_keys && currentEvent.team_keys.length > 0) {
					
					let teams = await utilities.find('teams', 
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
	}
	
	/**
	 * Logs requests and user agent
	 */
	static requestLogger (req: express.Request, res: express.Response, next: express.NextFunction){
		
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
		
		if (!req.useragent) throw new e.InternalServerError('req.useragent not defined');
		
		//user agent
		req.shortagent = {
			ip: String(req.headers['x-forwarded-for']) || req.connection.remoteAddress,
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
			+ ' ('
			+ (req.timezoneString + ', ' + req.localeString).yellow
			+ ') to '
			+ (req.url).cyan
			+ ' at '
			+ formattedReqTime);
		//fds
		
		res.locals.shortagent = req.shortagent;
		
		next();
	}
	
	/**
	 * Extra logging for res.render and res.redirect
	 */
	static renderLogger (req: express.Request, res: express.Response, next: express.NextFunction){
		
		res.render = (function(link, param){
			let cached_function = res.render;
			
			return function(this: express.Response, view: string, callback?: ((err: Error, html: string) => void) | undefined){
				
				//stores pre-render post-request time
				let beforeRenderTime = Date.now() - req.requestTime;
				
				//applies render function
				// eslint-disable-next-line prefer-rest-params
				let result = cached_function.apply(this, [view, callback]);
				
				//stores post-render time
				let renderTime = Date.now() - req.requestTime - beforeRenderTime;
				
				let appender = '[cache=0]';
				if (utilities.options && utilities.options.cache.enable == true) {
					appender = '[cache=1]';
				}
				
				logger.info(`Completed route in ${(beforeRenderTime).toString().yellow} ms; Rendered in ${(renderTime).toString().yellow} ms ${appender} \t[Route: ${res.req.originalUrl.brightGreen} View: ${view.brightGreen}]`);
				
				return result;
			};
		}());
		
		res.redirect = (function(){
			let cached_function = res.redirect;
			
			return function(this: express.Response, arg1: string|number, arg2?: string|number){
				
				//stores pre-render post-request time
				let completedRouteTime = Date.now() - req.requestTime;
				
				// res.redirect supports either (string) or (code, string)
				let url, status;
				if (typeof arg1 === 'number' && typeof arg2 === 'string') {
					url = arg2;
					status = arg1;
				}
				else {
					url = String(arg1);
				}
				// Replace any instances of ? with & *after* the first
				// 	To avoid issues like /dashboard/driveteam?team_key=frc102?alert=Saved%20column%20preferences%20successfully.&type=success&autofade=true
				let idx = 0;
				url = url.replace(/\?/g, (match) => ++idx >= 2 ? '&' : match);
				
				
				// Apply the render function with modified URL
				let result;
				if (typeof status === 'number') result = cached_function.bind(this)(status, url);
				else result = cached_function.bind(this)(url);
				
				//logger.info(`Completed ${res.req.url} in ${(completedRouteTime).toString().yellow} ms; Redirecting to ${(typeof url == 'string' ? url : ' ').yellow + (typeof status == 'string' ? status : ' ').yellow}`);
				logger.info(`Completed route in ${(completedRouteTime).toString().yellow} ms \t[Route: ${res.req.originalUrl} Redirecting to: ${(typeof url == 'string' ? url : ' ').yellow + (typeof status == 'string' ? status : ' ').yellow}]`);
				
				return result;
			};
		}());
		
		next();
	}

	/**
	 * Handles 404 errors
	 */
	static notFoundHandler (req: express.Request, res: express.Response, next: express.NextFunction) {
		let err = new e.NotFoundError();
		err.status = 404;
		next(err);
	}
	
	/**
	 * Handles all errors
	 */
	static errorHandler (err: e.HttpError, req: express.Request, res: express.Response, next: express.NextFunction) {
		logger.addContext('funcName', 'errorHandler');
		
		let title;
		
		let statusMessage, stack;
		
		switch (err.status) {
			case 400:
				title = 'Error';
				statusMessage = 'Bad Request';
				break;
			case 401:
				title = 'Unauthorized';
				statusMessage = 'Unauthorized';
				break;
			case 403:
				title = 'Forbidden';
				statusMessage = 'Forbidden';
				break;
			case 404:
				title = 'Not Found';
				statusMessage = 'Not Found';
				break;
			case 500:
				title = 'Error';
				statusMessage = 'Internal Server Error';
				// if (err instanceof e.InternalDatabaseError) statusMessage += ' (Database)'; // Custom error name
				break;
			default:
				title = 'Error';
				break;
		}
		
		//Only provide error stack in development
		if (req.app.get('env') == 'development') {
			stack = err.stack;
		}
		
		logger.error(err.message + '\n' + err.stack);
		
		let viewError = {
			message: err.message,
			status: err.status,
			statusMessage: statusMessage,
			stack: stack
		};
		
		// render the error page
		res.status(err.status || 500);
		res.render('error', {
			title: title,
			error: viewError
		});
		
		logger.removeContext('funcName');
	}
}

module.exports = UseFunctions;


// Constant, no need to re-get each time
const navcontents = navHelpers.getNavContents();

/**
 * Get the CURRENT timezone offset for the timezone string, then save it as a static-offset zone.
 * This runs way faster than calculating the offset for 200 timezones, at the cost of accuracy in the off-season.
 * Creating Luxon IANAZones is very time consuming, so we can cache their offset time to save even more processing time.
 */
const cachedFixedZones: {[key: string]: FixedOffsetZone} = {};
function getFixedZone(timezone: string) {
	if (cachedFixedZones[timezone]) {
		return cachedFixedZones[timezone];
	}
	else {
		let ianaZone = new IANAZone(timezone);
		let fixedZone = FixedOffsetZone.instance(ianaZone.offset(Date.now()));
		cachedFixedZones[timezone] = fixedZone;
		return fixedZone;
	}
}


// declare namespace Express {
// 	export interface Request {
// 		requestTime?: number;
// 		user?: User;
// 		// Gets the redirectURL WITHOUT encoding ? and & (for performing the actual redirection)
// 		getRedirectURL: () => string;
// 		getFixedRedirectURL: () => string;
// 		fixRedirectURL: (str: string) => string;
// 	}
// }