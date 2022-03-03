const crypto = require('crypto');
const express = require('express');
const log4js = require('log4js');
const wrap = require('express-async-handler');
const webpush = require('web-push');
const utilities = require('@firstteam102/scoutradioz-utilities');
const matchDataHelper = require('@firstteam102/scoutradioz-helpers').matchData;

//utililties config
utilities.config(require('./databases.json'));

//log4js config
log4js.configure({
	appenders: { out: { type: 'stdout', layout: {
		type: 'pattern',
		//Non-colored pattern layout (default)
		pattern: '[%x{tier}] [%p] %c.%x{funcName} - %m',
		tokens: {
			'tier': logEvent => process.env.ALIAS,
			'funcName': logEvent => {
				if (logEvent.context && logEvent.context.funcName) {
					return logEvent.context.funcName;
				}
				else return '';
			},
		},
	} } },
	categories: { default: { appenders: ['out'], level: 'info' } }
});
const logger = log4js.getLogger('webhook');
logger.level = 'trace';

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
	verify: function(req, res, buf, encoding) {
		
		const secret = req.tba_secret;
		
		//Generate hash to compare with TBA's hmac hash.
		const hash = crypto.createHmac('sha256', secret)
			.update(buf)
			.digest('hex');
		const hmac = req.header('X-TBA-HMAC');
		
		//Log both hashes
		logger.info(`X-TBA-HMAC: ${hmac}`);
		console.log(`Our hash: ${hash}`);
		
		//If comparison failed, then we need to throw an error to stop code
		if (hash != hmac) throw Error('X-TBA-HMAC not verified.');
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
	var tier = process.env.TIER;
	logger.info(`tier=${tier} originalUrl=${req.originalUrl} url=${req.url}`);
	
	var splitUrl = req.url.split('/');
	logger.debug(splitUrl);
	
	if (splitUrl[1] == tier) {
		logger.info('URL includes tier. Cutting it out of url.');
		//Remove tier from url
		splitUrl.splice(1, 1);
		req.url = splitUrl.join('/');
		//if url does not start with a slash, add a slash to avoid breaking something
		if (req.url[0] != '/') req.url = '/' + req.url;
		logger.info(`new req.url=${req.url}`);
		next();
	}
	//If current tier is not in the url, send a 404
	else {
		logger.info('URL does not include tier. Sending 404.');
		res.status(404).send('Not found. Must include process tier in URL.');
	}
});
webhook.use('/', router);
//404 handler
webhook.use((req, res, next) => {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
}); 
//Error handler
webhook.use((err, req, res, next) => {
	logger.addContext('funcName', 'error');
	
	logger.error(err.message || err, JSON.stringify(err.stack));
	
	res.status(err.status || 500).send(err);
});

router.all('/*', wrap(async (req, res, next) => {
	logger.removeContext('funcName');
	next();
}));

//Routing
router.get('/', wrap(async (req, res) => {
	logger.addContext('funcName', 'root[get]');
	
	logger.info(JSON.stringify(req.query));
	
	res.send(req.query);
}));

// Test TBA's REST API
router.get('/test-tba-api', wrap(async (req, res) => {
	var result = await utilities.requestTheBlueAlliance('events/2022/simple');
	res.send(result);
}));

router.get('/flush-cache', wrap(async (req, res) => {
	
	utilities.flushCache();
	res.status(200).send();
}));

router.post('/', wrap(async (req, res) => {
	logger.addContext('funcName', 'root[post]');
	
	var message = req.body;
	logger.info('ENTER message=' + JSON.stringify(message));

	var messageType = message.message_type;
	var messageData = message.message_data;
	
	logger.info('messageType=' + messageType);
	
	//Delegate data handling to separate functions.
	switch(messageType){
		case 'upcoming_match':
			await handleUpcomingMatch( messageData );
			break;
		// 2020-02-20, adding 'match_video' - appears to be the same data as 'match_score'
		case 'match_score':
		case 'match_video':
			await handleMatchScore( messageData );
			break;
		case 'starting_comp_level':
			await handleStartingCompLevel( messageData );
			break;
		case 'alliance_selection':
			await handleAllianceSelection( messageData );
			break;
		case 'schedule_updated':
			await handleScheduleUpdated( messageData );
			break;
		case 'awards_posted':
			await handleAwardsPosted( messageData );
			break;
		default:
			logger.info('unknown messageType-' + messageType + ',messageData=' + JSON.stringify(messageData));
	}
	
	logger.info('DONE');
	res.status(200).send('thanks!');
}));

////////// Type handlers

//TBA push handlers
async function handleUpcomingMatch( data ) {
	logger.addContext('funcName', 'handleUpcomingMatch');

	var match_key = data.match_key;
	var event_key = match_key.split('_')[0];
	var event_year = parseInt(event_key.substring(0, 4));
	logger.info('ENTER event_year=' + event_year + ',event_key=' + event_key + ',match_key=' + match_key);

	// Synchronize the rankings (just in case)
	await syncRankings(event_key);

	// push notifications
	if (process.env.disablePushNotifications != 'true') {
	
		logger.debug('Configuring web-push');
		const keys = await utilities.findOne('passwords', {name: 'web_push_keys'});
		webpush.setVapidDetails('mailto:roboticsfundinc@gmail.com', keys.public_key, keys.private_key);
		
		const teamKeys = data.team_keys;
		const matchNumberKey = data.match_key.split('_')[1];
		logger.debug(`matchNumberKey: ${matchNumberKey}, teamKeys: ${JSON.stringify(teamKeys)}`);
		
		for (var teamKey of teamKeys) {
			//find assignee of this team key
			const alliance = 'red';
			const assigneeID = '5d9cd6951c4f783330139549';
			const user = await utilities.findOne('users', {_id: assigneeID});
			
			logger.info(`Asignee: ${JSON.stringify(user)}`);
			
			//if user is found in the db, proceed
			if (user) {
				//if user has a push subscription, then send to that subscription
				if (user.push_subscription) {
					const pushSubscription = user.push_subscription;
					
					var titleIdentifier;
					var matchNumber, compLevel;
					var setNumber = '';
					
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
					
					var imageHref = 'https://upload.scoutradioz.com/app/generate/upcomingmatch?'
						+ `match_number=${matchNumber}&comp_level=${compLevel}&set_number=${setNumber}`
						+ `&blue1=${teamKeys[0].substring(3)}`
						+ `&blue2=${teamKeys[1].substring(3)}`
						+ `&blue3=${teamKeys[2].substring(3)}`
						+ `&red1=${teamKeys[3].substring(3)}`
						+ `&red2=${teamKeys[4].substring(3)}`
						+ `&red3=${teamKeys[5].substring(3)}`
						+ '&assigned=red1';
					
					const notificationContent = JSON.stringify({
						title: `${titleIdentifier} will start soon`,
						options: {
							body: `You're assigned to team ${teamKey.substring(3)} on the ${alliance} alliance.`,
							badge: '/images/brand-logos/monochrome-badge.png',
							icon: '/images/brand-logos/FIRST-logo.png',
							image: imageHref,
							actions: [
								{
									action: 'scout-match',
									title: 'Scout Match',
									//icon: '',
								}
							]
						},
						ifFocused: {
							message: 'Don\'t forget! This is a reminder!'
						},
					});
					// https://web-push-book.gauntface.com/demos/notification-examples/ 
					
					await sendPushMessage(pushSubscription, notificationContent);
				}
				else {
					logger.debug(`Push subscription not available for ${user.name}`);
			
				}
			}
		}
	}

	// If any teams are "at" this event, (re)run the aggrange calculator for each one
	// Why do this for 'upcoming match' notifications?... In case a scout posted their data late, this will catch up with their data
	var orgsAtEvent = await utilities.find('orgs', {event_key: event_key});
	if (orgsAtEvent && orgsAtEvent.length > 0) {
		// For each org, run the agg ranges stuff
		//var aggRangePromises = [];
		for (var i in orgsAtEvent) {
			var thisOrg = orgsAtEvent[i];
			await matchDataHelper.calculateAndStoreAggRanges(thisOrg.org_key, event_year, event_key); 			
			//var thisPromise = matchDataHelper.calculateAndStoreAggRanges(thisOrg.org_key, event_year, event_key);
			//aggRangePromises.push(thisPromise);
		}
		// wait for all the updates to finish
		//Promise.all(aggRangePromises);
	}
}

async function handleMatchScore( data ) {
	logger.addContext('funcName', 'handleMatchScore');
	
	var match_key = data.match.key;
	var event_key = match_key.split('_')[0];
	var event_year = parseInt(event_key.substring(0, 4));
	logger.info('ENTER event_year=' + event_year + ',event_key=' + event_key + ',match_key=' + match_key);

	// 2020-02-13, M.O'C: Handle possible bugs in webhook push data?
	// Setting winning_alliance
	if (!data.match.winning_alliance) {
		var winning_alliance = '';
		if (data.match.alliances.blue.score > data.match.alliances.red.score)
			winning_alliance = 'blue';
		if (data.match.alliances.blue.score < data.match.alliances.red.score)
			winning_alliance = 'red';
		data.match.winning_alliance = winning_alliance;
	}
	// Renaming the 'teams' attribute
	if (!data.match.alliances.blue.team_keys) {
		var blue_team_keys = data.match.alliances.blue.teams;
		data.match.alliances.blue.team_keys = blue_team_keys;
	}
	if (!data.match.alliances.red.team_keys) {
		var red_team_keys = data.match.alliances.red.teams;
		data.match.alliances.red.team_keys = red_team_keys;
	}
	// Setting actual_time
	if (!data.match.actual_time) {
		var actual_time = data.match.time;
		data.match.actual_time = actual_time;
	}

	// Delete the matching match record
	await utilities.remove('matches', {'key': match_key});
	// Insert the match data
	await utilities.insert('matches', data.match);
	
	// Synchronize the rankings
	await syncRankings(event_key);

	// If any teams are "at" this event, (re)run the aggrange calculator for each one
	// Why do this for 'upcoming match' notifications?... In case a scout posted their data late, this will catch up with their data
	var orgsAtEvent = await utilities.find('orgs', {event_key: event_key});
	if (orgsAtEvent && orgsAtEvent.length > 0) {
		// For each org, run the agg ranges stuff
		//var aggRangePromises = [];
		for (var i in orgsAtEvent) {
			var thisOrg = orgsAtEvent[i];
			await matchDataHelper.calculateAndStoreAggRanges(thisOrg.org_key, event_year, event_key); 			
			//var thisPromise = matchDataHelper.calculateAndStoreAggRanges(thisOrg.org_key, event_year, event_key);
			//aggRangePromises.push(thisPromise);
		}
		// wait for all the updates to finish
		//Promise.all(aggRangePromises);
	}
}

async function handleStartingCompLevel( data ) {
	logger.addContext('funcName', 'handleStartingCompLevel');
	logger.info('ENTER (sync rankings only) data=' + JSON.stringify(data));
	var event_key = data.event_key; // <-- Comment this out & send 'starting_comp_level' webhooks from TBA to cause errors
	
	// Synchronize the rankings
	await syncRankings(event_key);
}

async function handleAllianceSelection( data ) {
	logger.addContext('funcName', 'handleAllianceSelection');
	logger.info('ENTER DNGN data=' + JSON.stringify(data));
}

async function handleScheduleUpdated( data ) {
	logger.addContext('funcName', 'handleScheduleUpdated');
	/*
	{
		"event_name": "FIM District East Kentwood Event",
		"first_match_time": 1553871600,
		"event_key": "2019miken"
	}	
	*/

	var event_key = data.event_key;
	var event_year = parseInt(event_key.substring(0, 4));
	logger.info('ENTER event_year=' + event_year + ',event_key=' + event_key);

	// Reload the matches
	var url = 'event/' + event_key + '/matches';
	logger.debug('url=' + url);
	var matchData = await utilities.requestTheBlueAlliance(url);
	if (matchData && matchData.length && matchData.length > 0) {
		//var arrayLength = array.length;

		// First delete existing match data for the given event
		await utilities.remove('matches', {'event_key': event_key});
		// Now, insert the new data
		await utilities.insert('matches', matchData);
	}

	// Synchronize the rankings (just in case)
	await syncRankings(event_key);
}

async function handleAwardsPosted( data ) {
	logger.addContext('funcName', 'handleAwardsPosted');
	logger.info('ENTER DNGN data=' + JSON.stringify(data));
}

////////// Helper functions

// Pull down rankings for event event_key
async function syncRankings(event_key) {
	logger.addContext('funcName', 'syncRankings');
	logger.info('ENTER');

	// Reload the rankings from TBA
	var rankingUrl = 'event/' + event_key + '/rankings';
	logger.info('rankingUrl=' + rankingUrl);

	var rankData = await utilities.requestTheBlueAlliance(rankingUrl);
	var rankArr = [];
	if (rankData && rankData.rankings && rankData.rankings.length > 0) {
		// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings'; enrich with event_key 
		var thisRankings = rankData.rankings;
		for (var i in thisRankings) {
			var thisRank = thisRankings[i];
			thisRank['event_key'] = event_key;
			rankArr.push(thisRank);
		}
	}
	logger.trace('rankArr=' + JSON.stringify(rankArr));

	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
	// Delete the current rankings
	//await utilities.remove("currentrankings", {});
	await utilities.remove('rankings', {'event_key': event_key});
	// Insert into DB
	//await utilities.insert("currentrankings", rankArr);
	await utilities.insert('rankings', rankArr);
}

// Push notification function
async function sendPushMessage(subscription, dataToSend) {
	logger.addContext('funcName', 'sendPushMessage');
	logger.info('ENTER');
	
	logger.debug(`Attempting to send push message: ${dataToSend}`);
	
	try {
		var result = await webpush.sendNotification(subscription, dataToSend);
		
		logger.debug(`Result: ${JSON.stringify(result)}`);
	}
	catch (err) {
		
		if (err.statusCode == 404 || err.statusCode == 410) {
			logger.warn('Subscription has expired or is no longer valid: ', err);
		}
		
		logger.error(err);
	}
}