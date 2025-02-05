import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../../helpers/express-async-handler';
import utilities from 'scoutradioz-utilities';
import Permissions from '../../helpers/permissions';
import type { Org, Event } from 'scoutradioz-types';

const router = express.Router();
const logger = getLogger('manage');

router.all('/*', wrap(async (req, res, next) => {
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate (Permissions.ACCESS_TEAM_ADMIN)) {
		next();
	}
}));

/**
 * Admin index page. Provides links to all admin functionality.
 * @url /manage/
 * @views /manage/adminindex
 */
router.get('/', wrap(async (req, res) => {
	const thisFuncName = 'manage.index[get]: ';
	
	// for events search
	const eventListYear =
		(typeof req.query.eventListYear === 'string') ? parseInt(req.query.eventListYear) : new Date().getFullYear();
		
	logger.debug(`${thisFuncName} eventListYear=${eventListYear}`);
	
	const org: Org = await utilities.findOne('orgs', 
		{org_key: req._user.org_key}, {},
		{allowCache: true}
	);
	const events: Event[] = await utilities.find('events', 
		{year: eventListYear}, 
		{sort: {start_date: 1}},
		{allowCache: true}
	);
	
	// 2023-02-20 JL: Forced to org current event instead of req.event because of the new WIP cookie thingy
	let currentEvent: Event|undefined = undefined;
	if (org.event_key)
		currentEvent = await utilities.findOne('events', {key: org.event_key});
	
	// Read unique list of years in DB
	const distinctYears = await utilities.distinct('events', 'year', {});
	const uniqueYears = distinctYears.sort();
	
	res.render('./manage/index', { 
		title: `Manage ${org.nickname}`,
		org: org,
		currentEvent,
		events: events,
		years: uniqueYears,
		eventListYear: eventListYear
	});
	
	//utilities.dumpCache();
}));

/** POST method to set current event id.
 * @url /manage/setcurrent
 * @redirect /admin
 */
router.post('/setcurrent', wrap(async (req, res) => {
	logger.addContext('funcName', 'setcurrent[post]');
	
	let eventKey = req.body.event_key;
	logger.info('ENTER eventKey=' + eventKey);
	
	//Now, insert the new data
	// 2020-02-08, M.O'C - moving "current event" info into 'orgs'
	let thisOrgKey = req._user.org_key;
	
	// 2023-02-25 JL: Added the ability to clear the event key from the org
	if (typeof eventKey === 'string' && eventKey.trim() === '') {
		logger.info(`Clearing event_key from org ${thisOrgKey}, setting null`);
		
		let writeResult = await utilities.update('orgs', {org_key: thisOrgKey}, {$set: {event_key: null}});
		logger.debug('writeResult=', writeResult);
		return res.redirect(`/manage?alert=${res.msgUrl('manage.event.successClear')}&type=good`);
	}
	
	let event: Event = await utilities.findOne('events', 
		{key: eventKey}, {},
		{allowCache: true}
	);
		
	//If eventKey is valid, then update
	if (event) {
		await utilities.update( 'orgs', {'org_key': thisOrgKey}, {$set: {'event_key': eventKey}} );
		logger.debug('Inserted current');
			
		res.redirect(`/manage?alert=${res.msgUrl('manage.event.successSetEvent', {eventName: event.name})}`);
			
		// 2022-03-26 JL: In the background, update list of teams when setting the current event, so the team admin doesn't have to do it manually
		let eventTeamsUrl = `event/${eventKey}/teams/keys`;
		let thisTeamKeys = await utilities.requestTheBlueAlliance(eventTeamsUrl);
			
			
		// 2023-02-20 JL: Added check to make sure TBA sends back an array
		if (!Array.isArray(thisTeamKeys)) {
			logger.error('TBA didn\'t send back an array!! They sent: ', thisTeamKeys);
		}
		// 2023-02-20 JL: Added check to not override team keys if TBA sends back none
		else if (req.teams && req.teams.length > 0 && thisTeamKeys.length === 0) {
			logger.info('TBA sent back a list of 0 teams and a nonzero amount of teams were detected in the database. Not updating.');
		}
		else {
			logger.info(`Updating list of team keys, event=${eventKey} team_keys.length=${thisTeamKeys.length}`);
			await utilities.update( 'events', {'key': eventKey}, {$set: {'team_keys': thisTeamKeys}} );
		}
	}
	//If invalid, send an error
	else {
		res.redirect(`/manage?alert=${res.msgUrl('manage.event.invalidEventKey', {eventKey})}&type=error`);
	}

}));

export default router;
