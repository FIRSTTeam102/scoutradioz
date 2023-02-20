import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../helpers/express-async-handler';
import Permissions from '../helpers/permissions';
import utilities from 'scoutradioz-utilities';
import webpush, { WebPushError } from 'web-push';
import type { PushSubscription } from 'web-push';

const router = express.Router();
const logger = getLogger('notifications');

router.all('/*', wrap(async (req, res, next) => {
	//check if user is logged in as a scouter
	if (!await req.authenticate(Permissions.ACCESS_SCOUTER)) return;
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	next();
}));

router.post('/save-subscription', wrap(async (req, res) => {
	logger.addContext('funcName', 'save-subscription[post]');
	logger.info('ENTER');
	
	//check if it's a valid save request
	if (!await isValidSaveRequest(req, res)) return;
	
	logger.info(`Request to save push notification subscription for ${req._user.name}`);
	logger.debug(`body: ${JSON.stringify(req.body)}`);
	
	let pushSubscription = req.body;
	
	try {
	
		let writeResult = await utilities.update('users', {_id: req._user._id}, {$set: {push_subscription: pushSubscription}});
	
		logger.debug(`writeResult: ${JSON.stringify(writeResult)}`);
		
		res.cookie('enable_notifications', 1);
		
		res.setHeader('Content-Type', 'application/json');
		res.send({success: true});
	}
	catch (err) {
		
		logger.error('The subscription was received but we were unable to save it to our database.');
		
		res.status(500);
		res.setHeader('Content-Type', 'application/json');
		res.send({
			error: {
				id: 'unable-to-save-subscription',
				message: res.msg('notifications.dbSaveFailed')
			}
		});
	}
}));

router.post('/disable-subscription', wrap(async (req, res) => {
	logger.addContext('funcName', 'disable-subscription[post]');
	logger.info('ENTER');
	
	let writeResult = await utilities.update('users', {_id: req._user._id}, {$unset: {push_subscription: ''}});
	
	logger.debug(JSON.stringify(writeResult));
	logger.info('Success');
		
	res.clearCookie('enable_notifications');
	
	res.setHeader('Content-Type', 'application/json');
	res.send({success: true});
}));

/* 
	BELOW: ADMIN TESTING FUNCTIONS
*/

router.all('/*', wrap(async (req, res, next) => {
	//check if user is logged in as a scouter
	if (!await req.authenticate(Permissions.ACCESS_GLOBAL_ADMIN)) return;
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	next();
}));

router.get('/', wrap(async (req, res) => {
	let usersWithPushNotifs = await utilities.find('users', 
		{push_subscription: {$ne: undefined}},
		{sort: {org_key: 1, role_key: 1, name: 1}}
	);
	
	let matches = await utilities.find('matches', {event_key: req.event.key}, {sort: {predicted_time: 1}});
	
	res.render('./admin/notifications', {
		title: res.msg('notifications.testPageTitle'),
		users: usersWithPushNotifs,
		matches: matches,
	});
}));

router.post('/sendtest', wrap(async (req, res) => {
	logger.addContext('funcName', 'sendtest[post]');
	logger.info('ENTER');
	
	//check if user is logged in as a scouter
	if (!await req.authenticate(Permissions.ACCESS_SCOUTER)) return;
	
	const keys = await utilities.findOne('passwords', {name: 'web_push_keys'});	
	webpush.setVapidDetails('mailto:roboticsfundinc@gmail.com', keys.public_key, keys.private_key);
	
	const matchKey = req.body.matchKey;
	const matchTeamKey = req.body.assignedMatchTeam;
	if (!matchKey || !matchTeamKey) return res.redirect('/notifications?alert=' + res.msgUrl('notifications.invalidKey'));
	const teamKey = matchTeamKey.split('_')[2];
	
	// Get the match from db & prepare the variables for the url
	const match = await utilities.findOne('matches', {key: matchKey});
	if (!match) return res.redirect('/notifications?alert=' + res.msgUrl('notifications.invalidMatch'));
	
	let blue = match.alliances.blue.team_keys;
	let red = match.alliances.red.team_keys;
	let assignedTeam, alliance, blue1, blue2, blue3, red1, red2, red3;
	
	blue1 = blue[0].substring(3);
	blue2 = blue[1].substring(3);
	blue3 = blue[2].substring(3);
	red1 = red[0].substring(3);
	red2 = red[1].substring(3);
	red3 = red[2].substring(3);
	
	for (let i = 0; i < 3; i++) {
		if (blue[i] === teamKey) {
			assignedTeam = 'blue' + (i + 1);
			alliance = 'blue';
		}
	}
	for (let i = 0; i < 3; i++) {
		if (red[i] === teamKey) {
			assignedTeam = 'red' + (i + 1);
			alliance = 'red';
		}
	}
	
	let imageURL = process.env.UPLOAD_URL + '/' + process.env.TIER + '/generate/upcomingmatch?' +
		`match_number=${match.match_number}&comp_level=${match.comp_level}&set_number=${match.set_number}&blue1=${blue1}&blue2=${blue2}&blue3=${blue3}&red1=${red1}&red2=${red2}&red3=${red3}&assigned=${assignedTeam}&uselang=${req.locale}`;
		
	logger.debug(`assignedTeam=${assignedTeam}, matchteam=${matchTeamKey}, imageURL=${imageURL}`);
	
	let scoutMatchURL = `${req.protocol}://${req.get('host')}/scouting/match?key=${matchTeamKey}&alliance=${alliance}`;
	
	const users = await utilities.find('users', {push_subscription: {$ne: undefined}});
	
	const pushSubscription = req._user.push_subscription;
	
	if (pushSubscription){
		
		// @todo: the i18n from here needs to be able to be used in the webhook lambda
		const notificationContent = JSON.stringify({
			title: res.msg('notifications.content.title', {match: match.match_number}),
			options: {
				body: res.msg('notifications.content.body', {team: teamKey.substring(3), alliance: res.msg(`alliance.${alliance}Short`)}),
				badge: res.locals.fileRoot + '/images/brand-logos/monochrome-badge.png',
				icon: res.locals.fileRoot + '/images/brand-logos/FIRST-logo.png',
				// image: 'https://upload.scoutradioz.com/prod/generate/upcomingmatch?match_number=24&comp_level=qm&set_number=2&blue1=225&blue2=102&blue3=1676&red1=11&red2=2590&red3=4261&assigned=red3',
				image: imageURL,
				actions: [
					{
						action: scoutMatchURL,
						title: res.msg('notifications.actions.scout'),
						//icon: '',
					}
				],
				timestamp: Date.now(),
			},
			ifFocused: {
				message: res.msg('notifications.content.ifFocused', {match: match.match_number}),
			},
		});
		// https://web-push-book.gauntface.com/demos/notification-examples/ 
		
		await sendPushMessage(pushSubscription, notificationContent);
		
	}
	else {
		logger.debug(`Push subscription not available for ${req._user.name}`);
	}
	
	res.redirect('/notifications');
}));

async function sendPushMessage (subscription: PushSubscription, dataToSend: string) {
	
	logger.debug(`Attempting to send push message: ${dataToSend}`);
	
	try {
		let result = await webpush.sendNotification(subscription, dataToSend);
		
		logger.debug(`Result: ${JSON.stringify(result)}`);
	}
	catch (err) {
		
		if (err instanceof WebPushError && (err.statusCode == 404 || err.statusCode == 410)) {
			logger.warn('Subscription has expired or is no longer valid: ', err);
		}
		
		logger.error(err);
	}
}

async function isValidSaveRequest (req: express.Request, res: express.Response) {
	// Check the request body has at least an endpoint
	if (!req.body || !req.body.endpoint) {
		// Not a valid subscription.
		res.status(400);
		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify({
			error: {
				id: 'no-endpoint',
				message: 'Subscription must have an endpoint.'
			},
			success: false
		}));
		return false;
	}
	return true;
}

module.exports = router;