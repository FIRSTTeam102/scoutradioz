import bcrypt from 'bcryptjs';
import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../../helpers/express-async-handler';
import utilities from '@firstteam102/scoutradioz-utilities';
import Permissions from '../../helpers/permissions';
import type { Org, Event } from '@firstteam102/scoutradioz-types';

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
	
	// Read unique list of years in DB
	const distinctYears = await utilities.distinct('events', 'year', {});
	const uniqueYears = distinctYears.sort();
	
	res.render('./manage/index', { 
		title: `Manage ${org.nickname}`,
		org: org,
		current: req.event.key,
		events: events,
		years: uniqueYears,
		eventListYear: eventListYear
	});
	
	//utilities.dumpCache();
}));

router.post('/setdefaultpassword', wrap(async (req, res) => {
	
	let newDefaultPassword = req.body.defaultPassword;
	
	let hash = await bcrypt.hash(newDefaultPassword, 10);
	
	await utilities.update('orgs', {org_key: req._user.org_key}, {$set: {default_password: hash}});
	
	res.redirect(`/manage?alert=Successfully changed password to ${newDefaultPassword}.`);
	
}));

/** POST method to set current event id.
 * @url /manage/setcurrent
 * @redirect /admin
 */
router.post('/setcurrent', wrap(async (req, res) => {
	
	let thisFuncName = 'manage.setcurrent[post]: ';
	let eventKey = req.body.event_key;
	logger.info(thisFuncName + 'ENTER eventKey=' + eventKey);

	//Now, insert the new data
	// 2020-02-08, M.O'C - moving "current event" info into 'orgs'
	if (req && req.user && req.user.org_key) {
		let thisOrgKey = req.user.org_key;
		
		let event: Event = await utilities.findOne('events', 
			{key: eventKey}, {},
			{allowCache: true}
		);
		
		//If eventKey is valid, then update
		if (event) {
			await utilities.update( 'orgs', {'org_key': thisOrgKey}, {$set: {'event_key': eventKey}} );
			logger.debug(thisFuncName + 'Inserted current');
			
			res.redirect(`/manage?alert=Set current event to *${event.name}* successfuly.`);
			
			// 2022-03-26 JL: In the background, update list of teams when setting the current event, so the team admin doesn't have to do it manually
			let eventTeamsUrl = `event/${eventKey}/teams/keys`;
			let thisTeamKeys = await utilities.requestTheBlueAlliance(eventTeamsUrl);
			logger.info(`Updating list of team keys, event=${eventKey} team_keys.length=${thisTeamKeys.length}`);
			await utilities.update( 'events', {'key': eventKey}, {$set: {'team_keys': thisTeamKeys}} );
		}
		//If invalid, send an error
		else {
			res.redirect(`/manage?alert=Invalid event key: '${eventKey}'. Click on an event in the list to set it automatically.&type=error`);
		}
	}

}));

module.exports = router;
