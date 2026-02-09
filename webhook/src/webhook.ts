import type { LoggingEvent } from 'log4js';
import type { RequestHandler, Request, Response } from 'express';
import express from 'express';
import utilities from 'scoutradioz-utilities';
import { config as configHelpers, matchData as matchDataHelper } from 'scoutradioz-helpers';
import type { Match } from 'scoutradioz-types';

type AsyncHandler = (cb: RequestHandler2) => RequestHandler2;

interface RequestHandler2 extends RequestHandler {
	(req: Request, res: Response, next: (err?: any) => any): void;
}

class HttpError extends Error {
	status?: number;
}


require('dotenv').config();
const _crypto = require('crypto');
// const express: Express = require('express');
const log4js = require('log4js');
const wrap: AsyncHandler = require('express-async-handler');
const webpush = require('web-push');

//utililties config
utilities.config(require('../databases.json'), {
	cache: {
		enable: true,
		maxAge: 30,
	},
	debug: (process.env.UTILITIES_DEBUG === 'true'),
	schemasWithNumberIds: ['users'],
});
//helpers.config(utilities); // pass the utilities db object to helpers
configHelpers(utilities);

//log4js config
let log4jsConfig = {
	appenders: { out: { type: 'stdout', layout: {
		type: 'pattern',
		//Non-colored pattern layout (default)
		pattern: '[%x{tier}] [%p] %c.%x{funcName} - %m',
		tokens: {
			'tier': () => (process.env.ALIAS || process.env.TIER || '').toUpperCase(),
			'funcName': (logEvent: LoggingEvent) => {
				if (logEvent.context && logEvent.context.funcName) {
					return logEvent.context.funcName;
				}
				else return '';
			},
		},
	} } },
	categories: { default: { appenders: ['out'], level: 'info' } }
};
if( process.env.COLORIZE_LOGS == 'true'){
	//Colored pattern layout
	log4jsConfig.appenders.out.layout.pattern = '%[[%d{hh:mm:ss}] [%x{tier}] [%p] %c.%x{funcName} - %]%m';
}
log4js.configure(log4jsConfig);
const logger = log4js.getLogger('webhook');
logger.level = process.env.LOG_LEVEL || 'debug';

//EXPRESS APP SETUP
const webhook = express();
module.exports = webhook;

//utilities tier refresh
webhook.use(utilities.refreshTier);

// Grab TBA secret key from db and save it in req
webhook.use(wrap(async (req, res, next) => {
	const secretDoc = await utilities.findOne('passwords', {name: 'tba-webhook-secret'}, {}, {allowCache: true, maxCacheAge: 900});
	if (!secretDoc) throw new Error('Could not find tba-webhook-secret in database!!! tier=' + process.env.TIER);
	req.tba_secret = secretDoc.secret_key;
	next();
}));
//bodyParser config
const options = {
	extended: false,
	verify: function(req: Request, res: Response, buf: Buffer, encoding: string) {
		
		const secret = req.tba_secret;
		
		//Generate hash to compare with TBA's hmac hash.
		const hash = _crypto.createHmac('sha256', secret)
			.update(buf)
			.digest('hex');
		const hmac = req.header('X-TBA-HMAC');
		
		//Log both hashes
		logger.info(`X-TBA-HMAC: ${hmac}`);
		logger.info(`Our hash: ${hash}`);
		
		//If comparison failed, then we need to throw an error to stop code
		if (hash != hmac && process.env.TIER !== 'dev') throw new Error('X-TBA-HMAC not verified.');
	}
};
webhook.use(express.json(options));
webhook.use(express.urlencoded(options));

//ROUTER
const router = express.Router();
//URL splitter
webhook.use((req, res, next) => {
	logger.addContext('funcName', 'urlParser');
	
	//Tier is overridden in lambda.js.
	let tier = process.env.TIER;
	logger.info(`tier=${tier} originalUrl=${req.originalUrl} url=${req.url}`);
	
	let splitUrl = req.url.split('/');
	logger.debug(splitUrl);
	
	if (splitUrl[1] == tier) {
		logger.trace('URL includes tier. Cutting it out of url.');
		//Remove tier from url
		splitUrl.splice(1, 1);
		req.url = splitUrl.join('/');
		//if url does not start with a slash, add a slash to avoid breaking something
		if (req.url[0] != '/') req.url = '/' + req.url;
		logger.trace(`new req.url=${req.url}`);
		next();
	}
	//If current tier is not in the url, send a 404
	else {
		logger.warn('URL does not include tier. Sending 404.');
		res.status(404).send('Not found. Must include process tier in URL.');
	}
});
webhook.use('/', router);
//404 handler
webhook.use((req, res, next) => {
	let err = new HttpError('Not Found');
	err.status = 404;
	next(err);
}); 
//Error handler
webhook.use((err: HttpError, req: Request, res: Response) => {
	logger.addContext('funcName', 'error');
	
	logger.error(err);
	
	res.status(err.status || 500).send(err);
});

router.all('/*', wrap(async (req, res, next) => {
	logger.removeContext('funcName');
	next();
}));

//Routing

// Debugging/testing methods
router.get('/', wrap(async (req, res) => {
	logger.addContext('funcName', 'root[get]');
	
	logger.info(JSON.stringify(req.query));
	
	res.send(req.query);
}));

router.get('/flush-cache', wrap(async (req, res) => {
	utilities.flushCache();
	res.status(200).send();
}));

// Test TBA's REST API
router.get('/test-tba-api', wrap(async (req, res) => {
	let result = await utilities.requestTheBlueAlliance('events/2022/simple');
	res.send(result);
}));

// Main TBA handler
router.post('/', wrap(async (req, res) => {
	logger.addContext('funcName', 'root[post]');
	
	let message = req.body;
	logger.info('ENTER message=' + JSON.stringify(message));

	let messageType = message.message_type;
	let messageData = message.message_data;
	
	logger.info('messageType=' + messageType);
	
	//Delegate data handling to separate functions.
	switch(messageType){
		case 'upcoming_match':
			await handleUpcomingMatch( messageData, req, res );
			break;
		// 2020-02-20, adding 'match_video' - appears to be the same data as 'match_score'
		// 2026-02-09, moved 'match_video' to its own DNGN handler [might *not* be the same (and we don't want to do all the same things)]
		case 'match_score':
			await handleMatchScore( messageData );
			break;
		case 'match_video':
			await handleMatchVideo( messageData );  // DNGN
			break;
		case 'starting_comp_level':
			await handleStartingCompLevel( messageData );
			break;
		case 'alliance_selection':
			await handleAllianceSelection( messageData );  // DNGN
			break;
		case 'awards_posted':
			await handleAwardsPosted( messageData );
			break;
		case 'schedule_updated':
			await handleScheduleUpdated( messageData );
			break;
		default:
			logger.info('unknown messageType-' + messageType + ',messageData=' + JSON.stringify(messageData));
	}
	
	logger.info('DONE');
	res.status(200).send('thanks!');
}));

// Testing functions
router.get('/upcoming', wrap(async (req, res) => {
	let matchKey = req.query.key;
	let match = await utilities.findOne('matches', {key: matchKey});
	if (!match) return res.send('No match found');
	else {
		let data: UpcomingMatch = {
			event_key: match.event_key,
			match_key: match.key,
			event_name: '',
			scheduled_time: -1,
			predicted_time: -1,
			team_keys: [...match.alliances.blue.team_keys, ...match.alliances.red.team_keys]
		};
		try {
			await handleUpcomingMatch(data, req, res);
			res.send(JSON.stringify(data, null, 2));
		}
		catch (err) {
			res.send(JSON.stringify(err, null, 2));
		}
	}
}));

router.get('/matchScore', wrap(async (req, res) => {
	let matchKey = req.query.key;
	let match = await utilities.findOne('matches', {key: matchKey});
	if (!match) return res.send('No match found');
	else {
		let data = {
			match: match,
		};
		try {
			await handleMatchScore(data);
			res.send(JSON.stringify(data, null, 2));
		}
		catch (err) {
			res.send(JSON.stringify(err, null, 2));
		}
	}
}));

////////// Type handlers

const matchGapBreakThreshold = 30 * 60; // 30 minutes, in seconds

//TBA push handlers
async function handleUpcomingMatch( data: UpcomingMatch, req: Request, res: Response ) {
	logger.addContext('funcName', 'handleUpcomingMatch');

	let match_key = data.match_key;
	let event_key = match_key.split('_')[0];
	let event_year = parseInt(event_key.substring(0, 4));
	logger.info('ENTER event_year=' + event_year + ',event_key=' + event_key + ',match_key=' + match_key);
	
	let match = await utilities.findOne('matches', {key: match_key});
	if (!match) {
		logger.warn(`Can't find match ${match_key} attempting to (re)pull schedule`);
		// 2025-03-02, M.O'C: We *really* shouldn't be getting a "upcoming match" notification without one in the system
		// so this likely means we missed a schedule update webhook... if so, re-pull the schedule
	
		// Reload the matches
		let url = 'event/' + event_key + '/matches';
		logger.debug('url=' + url);
		let matchData = await utilities.requestTheBlueAlliance(url);
		if (matchData && matchData.length && matchData.length > 0) {
			logger.debug(`Matches received: ${matchData.length}`);
	
			// First delete existing match data for the given event
			await utilities.remove('matches', {'event_key': event_key});
			// Now, insert the new data
			await utilities.insert('matches', matchData);
			logger.info(`Schedule reload for ${event_key} complete`);

			// try to re-pull the one match
			match = await utilities.findOne('matches', {key: match_key});
			if (!match) return logger.error(`Match not found: ${match_key}`), res.send(`Match not found: ${match_key}`);
		}
		else {
			return logger.error(`No matches found! match: ${match_key}, event: ${event_key}`), res.send(`No matches found! match: ${match_key}, event: ${event_key}`);
		}
	}

	// Synchronize the event data - rankings, OPRs, EPAs, etc. (just in case)
	await matchDataHelper.retrieveAndStoreEventData(event_year, event_key);

	// If any teams are "at" this event, (re)run the aggrange calculator for each one
	// Why do this for 'upcoming match' notifications?... In case a scout posted their data late, this will catch up with their data
	let orgsAtEvent = await utilities.find('orgs', {event_key: event_key});
	if (orgsAtEvent && orgsAtEvent.length > 0) {
		// For each org, run the agg ranges stuff
		let aggRangePromises = [];
		for (let i in orgsAtEvent) {
			let thisOrg = orgsAtEvent[i];
			// 2022-04-06 JL note: No need to await these
			// 2025-02-28 M.O'C: Might need to await these after all, they're not finishing
			//matchDataHelper.calculateAndStoreAggRanges(thisOrg.org_key, event_year, event_key);
			let thisPromise = matchDataHelper.calculateAndStoreAggRanges(thisOrg.org_key, event_year, event_key);
			aggRangePromises.push(thisPromise);
		}
		// wait for all the updates to finish
		await Promise.all(aggRangePromises);
	}

	// push notifications	
	let matchesScheduledBeforeThis = await utilities.find('matches', {event_key: event_key, time: {$lt: match.time}}, {sort: {time: -1}});
	
	let oldMatch = matchesScheduledBeforeThis[1]; // Similar to handleMatchScore, find the match that's 2 before this one
	
	let doSendNotification;
	if (oldMatch) {
		let timeDifference = match.time - oldMatch.time;
		logger.debug(`Time difference between this match and the last match: ${timeDifference / 60} minutes`);
		if (timeDifference > matchGapBreakThreshold) doSendNotification = true;
		else logger.debug('Not sending push notifications (match break NOT detected)');
	}
	else {
		// If oldMatch is not found, then that means we're in match #1 or #2
		doSendNotification = true;
		logger.debug('Did not find a match before this one. Sending notification.');
	}
	
	if (doSendNotification) {
		// Proceed with the push notifications for this upcoming match
		let teamKeys = [...match.alliances.blue.team_keys, ...match.alliances.red.team_keys];
		await sendUpcomingNotifications(match, teamKeys);
	}
}

async function handleMatchScore( data: {match: Match} ) {
	logger.addContext('funcName', 'handleMatchScore');
	
	const match_key = data.match.key;
	const event_key = match_key.split('_')[0];
	const event_year = parseInt(event_key.substring(0, 4));
	logger.info('ENTER event_year=' + event_year + ',event_key=' + event_key + ',match_key=' + match_key);

	// 2020-02-13, M.O'C: Handle possible bugs in webhook push data?
	// Setting winning_alliance
	if (!data.match.hasOwnProperty('winning_alliance')) {
		if (data.match.alliances.blue.score > data.match.alliances.red.score)
			data.match.winning_alliance = 'blue';
		else if (data.match.alliances.blue.score < data.match.alliances.red.score)
			data.match.winning_alliance = 'red';
		else 
			data.match.winning_alliance = '';
	}
	// Renaming the 'teams' attribute
	if (!data.match.alliances.blue.team_keys) {
		// @ts-ignore - this is for legacy webhook stuff
		let blue_team_keys = data.match.alliances.blue.teams;
		data.match.alliances.blue.team_keys = blue_team_keys;
	}
	if (!data.match.alliances.red.team_keys) {
		// @ts-ignore - this is for legacy webhook stuff
		let red_team_keys = data.match.alliances.red.teams;
		data.match.alliances.red.team_keys = red_team_keys;
	}
	// Setting actual_time
	if (!data.match.actual_time) {
		let actual_time = data.match.time;
		data.match.actual_time = actual_time;
	}

	// Delete the matching match record
	await utilities.remove('matches', {'key': match_key});
	// Insert the match data
	await utilities.insert('matches', data.match);
	

	// If any teams are "at" this event, (re)run the aggrange calculator for each one
	// Why do this for 'upcoming match' notifications?... In case a scout posted their data late, this will catch up with their data
	let orgsAtEvent = await utilities.find('orgs', {event_key: event_key});
	if (orgsAtEvent && orgsAtEvent.length > 0) {
		// For each org, run the agg ranges stuff
		let aggRangePromises = [];
		for (let i in orgsAtEvent) {
			let thisOrg = orgsAtEvent[i];
			// 2022-04-06 JL note: No need to await these
			// 2025-02-28 M.O'C: Might need to await these after all, they're not finishing
			//matchDataHelper.calculateAndStoreAggRanges(thisOrg.org_key, event_year, event_key); 			
			let thisPromise = matchDataHelper.calculateAndStoreAggRanges(thisOrg.org_key, event_year, event_key);
			aggRangePromises.push(thisPromise);
		}
		// wait for all the updates to finish
		await Promise.all(aggRangePromises);
	}
	console.log(data.match.time, event_key);
	// Find the match-after-next-match, for push notifications.
	let matchesScheduledAfterThis = await utilities.find('matches', {event_key: event_key, time: {$gt: data.match.time}}, {sort: {time: 1}});
	
	logger.debug(`Matches after this one: ${matchesScheduledAfterThis.length}`);
	console.log({event: event_key, time: {$gt: data.match.time}}, {sort: {time: 1}});
	let newMatch = matchesScheduledAfterThis[1];
	if (newMatch) {
		let timeDifference = newMatch.time - data.match.time; // use scheduled time
		logger.debug(`Time difference between this match and the next-next match: ${timeDifference / 60} minutes [this=${data.match.key}, next-next=${newMatch.key}]`);
		if (timeDifference < matchGapBreakThreshold) {
			// Proceed with the push notifications for this upcoming match
			let teamKeys = [...newMatch.alliances.blue.team_keys, ...newMatch.alliances.red.team_keys];
			await sendUpcomingNotifications(newMatch, teamKeys);
		}
		else {
			logger.debug('Not sending push notifications (match break detected)');
		}
	}
	
	// Synchronize the rankings
	// 2026-01-16, M.O'C: Re-enabling syncing rankings (now "event data") after match score
	await matchDataHelper.retrieveAndStoreEventData(event_year, event_key);
}

async function handleStartingCompLevel( data: StartingCompLevel ) {
	logger.addContext('funcName', 'handleStartingCompLevel');
	logger.info('ENTER (sync rankings only) data=' + JSON.stringify(data));
	let event_key = data.event_key; // <-- Comment this out & send 'starting_comp_level' webhooks from TBA to cause errors
	let event_year = parseInt(event_key.substring(0, 4));
	
	// Synchronize the rankings
	await matchDataHelper.retrieveAndStoreEventData(event_year, event_key);
}

async function handleAllianceSelection( data: any /*TODO*/ ) {
	logger.addContext('funcName', 'handleAllianceSelection');
	logger.info('ENTER DNGN data=' + JSON.stringify(data));
}

async function handleMatchVideo( data: any /*TODO*/ ) {
	logger.addContext('funcName', 'handleMatchVideo');
	logger.info('ENTER DNGN data=' + JSON.stringify(data));
}

async function handleScheduleUpdated( data: ScheduleUpdated /*TODO*/ ) {
	logger.addContext('funcName', 'handleScheduleUpdated');
	/*
	{
		"event_name": "FIM District East Kentwood Event",
		"first_match_time": 1553871600,
		"event_key": "2019miken"
	}	
	*/

	let event_key = data.event_key;
	let event_year = parseInt(event_key.substring(0, 4));
	logger.info('ENTER event_year=' + event_year + ',event_key=' + event_key);

	// Reload the matches
	let url = 'event/' + event_key + '/matches';
	logger.debug('url=' + url);
	let matchData = await utilities.requestTheBlueAlliance(url);
	if (matchData && matchData.length && matchData.length > 0) {
		logger.debug(`Matches received: ${matchData.length}`);

		// First delete existing match data for the given event
		await utilities.remove('matches', {'event_key': event_key});
		// Now, insert the new data
		await utilities.insert('matches', matchData);
	}
	else {
		logger.warn('No matches found!');
	}

	// Synchronize the rankings (just in case)
	await matchDataHelper.retrieveAndStoreEventData(event_year, event_key);
}

async function handleAwardsPosted( data: any /*TODO*/ ) {
	logger.addContext('funcName', 'handleAwardsPosted');
	logger.info('ENTER DNGN data=' + JSON.stringify(data));
}

////////// Helper functions

// Send push notifications for a particular match.
async function sendUpcomingNotifications(match: Match, teamKeys: Array<TeamKey>) {
	
	if (process.env.DISABLE_PUSH_NOTIFICATIONS !== 'true') {
	
		logger.debug('Configuring web-push');
		const keys = await utilities.findOne('passwords', {name: 'web_push_keys'});
		webpush.setVapidDetails('mailto:roboticsfundinc@gmail.com', keys.public_key, keys.private_key);
		
		const matchKey = match.key;
		const matchNumberKey = matchKey.split('_')[1];
		logger.debug(`matchNumberKey: ${matchNumberKey}, matchKey: ${matchKey} teamKeys: ${JSON.stringify(teamKeys)}`);
		
		let scoutPromises = [];
		for (let teamKey of teamKeys) {
			scoutPromises.push(utilities.find('matchscouting', {match_team_key: matchKey + '_' + teamKey}));
		}
		
		let scoutAssignments = await Promise.all(scoutPromises);
		logger.debug(`scoutAssignments = ${JSON.stringify(scoutAssignments)}`);
		
		let userPromises = [];
		for (let scoutAssignmentList of scoutAssignments) {
			for (let assignment of scoutAssignmentList) {
				// note: There can be assignments from multiple orgs, so I can't assume there are a max of 6 assignments. Have to tie the teamKey to the user object.
				if (assignment) {
					userPromises.push(utilities.aggregate('users', [
						{$match: {org_key: assignment.org_key, name: assignment.assigned_scorer}},
						{$lookup: {from: 'orgs', localField: 'org_key', foreignField: 'org_key', as: 'org'}}, // 2022-04-08 JL: Retrieve org info so we can check if the user's org is actually at the event
						{$set: {assigned_team: assignment.team_key}}
					]));
				}
			}
		}
		
		let users = await Promise.all(userPromises);
		
		for (let userArr of users) {			
			if (userArr && userArr[0]) {
				const user = userArr[0]; // Aggregate returns an array, get first element instead
				const teamKey = user.assigned_team; // from the aggregate statement above
				
				// All the code below was written based on a for-i-in-teamKeys loop, so here we can recreate i
				let i = -1;
				for (let j = 0; j < teamKeys.length; j++) if (teamKeys[j] === teamKey) i = j;
				
				logger.info(`Asignee: ${user.name} from ${user.org_key}`);
				
				if (!user.push_subscription) {
					logger.debug(`Push subscription not available for ${user.name}`);
					continue;
				}
				if (user.org[0].event_key !== match.event_key) {
					logger.debug(`Org ${user.org_key} is at ${user.org[0].event_key}, not ${match.event_key}; not sending ${user.name} a push notification`);
					continue;
				}
				
				let alliance = (i <= 2) ? 'blue' : 'red'; // first three keys are blue, last three are red
				let assignedTeam = alliance + (i<=2 ? i+1 : i-2); // 0-2 -> blue1-3, 3-5: red1-3
				let titleIdentifier;
				let matchNumber, compLevel;
				let setNumber = '';
				
				//comp_level isn't available in upcoming_match notification, so we have to find it ourselves
				if (matchNumberKey.substring(0, 2) == 'qm') {
					compLevel = 'qm';
					matchNumber = matchNumberKey.substring(2);
					titleIdentifier = `Match ${matchNumber}`;
				}
				else if (matchNumberKey.substring(0, 2) == 'qf') {
					compLevel = 'qf';
					setNumber = matchNumberKey.substring(2, 3);
					matchNumber = matchNumberKey.substring(4);
					titleIdentifier = `Quarterfinal ${setNumber} Match ${matchNumber}`;
				}
				else if (matchNumberKey.substring(0, 2) == 'sf') {
					compLevel = 'sf';
					setNumber = matchNumberKey.substring(2, 3);
					matchNumber = matchNumberKey.substring(4);
					titleIdentifier = `Semifinal ${setNumber} Match ${matchNumber}`;
				}
				else if (matchNumberKey.substring(0, 1) == 'f') {
					compLevel = 'f';
					matchNumber = matchNumberKey.substring(3);
					titleIdentifier = `Final Match ${matchNumber}`;
				} 
				else {
					throw new Error('Unexpected matchKey comp_level identifier');
				}
				
				let matchTeamKey = matchKey + '_' + teamKey;
				let body = `You're assigned to team ${teamKey.substring(3)} on the ${alliance} alliance.`;
				let ifFocusedMessage = `Don't forget, *${titleIdentifier}* is about to start!\n${body}`;
				let scoutMatchURL = `https://scoutradioz.com/${user.org_key}/scouting/match?key=${matchTeamKey}&alliance=${alliance}`;
				
				let imageHref = process.env.UPLOAD_URL + '/' + process.env.TIER + '/generate/upcomingmatch?'
					+ `match_number=${matchNumber}&comp_level=${compLevel}&set_number=${setNumber}`
					+ '&blue1=' + teamKeys[0].substring(3)
					+ '&blue2=' + teamKeys[1].substring(3)
					+ '&blue3=' + teamKeys[2].substring(3)
					+ '&red1=' + teamKeys[3].substring(3)
					+ '&red2=' + teamKeys[4].substring(3)
					+ '&red3=' + teamKeys[5].substring(3)
					+ '&assigned=' + assignedTeam;
				
				let baseUrl; // Serve static files from primary func ONLY IF LOCAL
				if (process.env.local) baseUrl = '';
				else baseUrl = process.env.S3_BASE_URL + '/' + process.env.TIER;
				
				logger.debug(`assignedTeam=${assignedTeam}, matchteam=${matchTeamKey}, imageURL=${imageHref}`);
				
				const notificationContent = JSON.stringify({
					title: `${titleIdentifier} will start soon`,
					options: {
						body: body,
						badge: baseUrl + '/images/brand-logos/monochrome-badge.png',
						icon: baseUrl + '/images/brand-logos/FIRST-logo.png',
						image: imageHref,
						actions: [
							{
								action: scoutMatchURL,
								title: 'Scout Match',
								//icon: '',
							}
						],
						ttl: 300, // 5 minutes, in seconds
					},
					ifFocused: {
						message: ifFocusedMessage
					},
				});
				// https://web-push-book.gauntface.com/demos/notification-examples/ 
				
				await sendPushMessage(user.push_subscription, notificationContent);
			}
		}
	}
	else {
		logger.debug('Push notifications disabled!');
	}
}

// Push notification function
async function sendPushMessage(subscription: PushSubscription, dataToSend: string) {
	logger.addContext('funcName', 'sendPushMessage');
	logger.info('ENTER');
	
	logger.debug(`Attempting to send push message: ${dataToSend}`);
	
	try {
		let result = await webpush.sendNotification(subscription, dataToSend);
		
		logger.debug(`Result: ${JSON.stringify(result)}`);
	}
	catch (err: any) {
		
		if (err.statusCode == 404 || err.statusCode == 410) {
			logger.warn('Subscription has expired or is no longer valid: ', err);
		}
		
		logger.error(err);
	}
}