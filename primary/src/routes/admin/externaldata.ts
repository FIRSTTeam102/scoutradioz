import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../../helpers/express-async-handler';
import utilities from '@firstteam102/scoutradioz-utilities';
import Permissions from '../../helpers/permissions';
import type { Team, Event, Match } from '@firstteam102/scoutradioz-types';

const router = express.Router();
const logger = getLogger('externaldata');

router.all('/*', wrap(async (req, res, next) => {
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate (Permissions.ACCESS_GLOBAL_ADMIN)) {
		next();
	}
}));

/**
 * Admin page to show a list of events by any given year.
 * @url /admin/externaldata/events
 * @view /events
 */
router.get('/events', wrap(async (req, res) => {
	logger.addContext('funcName', 'events[get]');
	logger.info('ENTER');
		
	// Get our query value(s)
	let year: number;
	if (typeof req.query.year === 'string') {
		year = parseInt(req.query.year);
	}
	else {
		year = new Date().getFullYear();
		logger.debug('No year specified, defaulting to ' + year);
	}
	logger.debug('Year: ' + year);

	let events: Event[] = await utilities.find('events', 
		{year: year},
		{sort: {start_date: 1, end_date: 1, name: 1}}
	);
		
	// Read unique list of years in DB
	let distinctYears: string[] = await utilities.distinct('events', 'year', {});
	let uniqueYears = distinctYears.sort();

	logger.debug('uniqueYears=' + uniqueYears);
	
	res.render('./admin/externaldata/events', {
		title: 'Events',
		'events': events,
		'years': uniqueYears,
		'selectedYear': year
	});
}));

/**
 * POST: Admin page to update all events for a given year.
 * @url POST: /admin/externaldata/events
 * @redirect /admin/externaldata/events
 */
router.post('/events', wrap(async (req, res) => {
	
	//Event data synchronization is now updated automatically
	res.send(410);
	
	/*
	var thisFuncName = "externaldata.events[post]: ";

	
    // Get our form value(s)
    var year = req.body.year;
	
	//Set up TBA url
	var url = `events/${year}/simple`;
	logger.debug("url=" + url);
	
	//Submit request to TBA

	var eventData = await utilities.requestTheBlueAlliance(url);
		
	var events = JSON.parse(eventData);
	//if request was invalid, redirect to admin page with alert message
	if(events.length == undefined || events.length == 0){
		return res.redirect("/manage?alert=Could not get events from TBA for specified year " + year);
	}
	
	//Remove existing events list for year
	await utilities.remove("events", { "year": parseInt(year) });
	//Now insert new events list for year
	await utilities.insert("events", events);
	//redirect back to events page
	res.redirect(`/admin/externaldata/events?year=${year}`);
	*/
}));

/**
 * Admin page to display matches of a specified event id.
 * @url /admin/externaldata/matches
 * @view /matches
 */
router.get('/matches', wrap(async (req, res) => {
	logger.addContext('funcName', 'matches[get]');
	logger.info('ENTER');
	
	// Get our query value(s)
	let eventKey = req.query.eventKey || req.query.event_key;
	if (!eventKey) {
		logger.debug('No event specified');
		res.redirect('/admin/externaldata/events');
	}
	logger.debug('eventKey=' + eventKey);

	// Read matches from DB for specified event
	let matches: Match[] = await utilities.find('matches', {'event_key': eventKey},{sort: {'time': 1}});
	
	res.render('./admin/externaldata/matches', {
		title: 'Matches',
		'matches': matches
	});
}));

/* 
// This is for the ML predictor. Don't upload to Lambda with this method un-commented.
router.get('/allmatches', wrap(async (req, res) => {
	const events = await utilities.find('events', {});
	
	for (let event of events) {
		let eventKey = event.key;
		var url = `event/${event.key}/matches`;
		logger.debug('url=' + url);
		
		//Request from TBA
		var eventData = await utilities.requestTheBlueAlliance(url);
		var matches = JSON.parse(eventData);
		logger.debug(`matches= ${JSON.stringify(matches)}`);

		//if request was invalid, redirect to admin page with alert message
		if(matches.length == undefined || matches.length == 0){
			logger.warn('/manage?alert=Could not get matches from TBA for specified event ' + eventKey);
		}
		
		logger.debug('Found ' + matches.length + ' data for event ' + eventKey);
		
		// First delete existing match data for the given event
		await utilities.remove('matches', {'event_key': eventKey});
		// Now, insert the new data
		await utilities.insert('matches', matches);
		
		await timeout(1000);
	}
	res.sendStatus(200);
	
	function timeout(time) {
		return new Promise((resolve, reject) => {
			setTimeout(resolve, time);
		});
	}
}))

router.get('/oprs', wrap(async (req, res) => {
	
	const events = await utilities.find('events', {year: 2019});
	
	for (let event of events) {
		let key = event.key;
		let url = `event/${key}/oprs`
		logger.debug(`url=${url}`)
		
		var data = await utilities.requestTheBlueAlliance(url);
		var oprs = JSON.parse(data);
		if (oprs) {
			oprs.event_key = key;
			
			await utilities.remove('oprs', {event_key: key});
			await utilities.insert('oprs', oprs);
			await timeout(750);
		}
		
	}
	res.sendStatus(200)
	
	function timeout(time) {
		return new Promise((resolve, reject) => {
			setTimeout(resolve, time);
		});
	}
}))
*/
/**
 * POST: Admin page to update match information for a given event.
 * @url POST: /admin/externaldata/matches
 * @redirect /admin (to handle error)
 * @redirect /admin/externaldata/matches
 */
router.post('/matches', wrap(async (req, res) => {
	logger.addContext('funcName', 'matches[post]');
	logger.info('ENTER');

	// Get our form value(s)
	let eventKey = req.body.eventKey;
	logger.debug('eventKey=' + eventKey);
	
	//Set up TBA api request
	let url = `event/${eventKey}/matches`;
	logger.debug('url=' + url);
	
	//Request from TBA
	let matches = await utilities.requestTheBlueAlliance(url);
	logger.trace(`matches= ${JSON.stringify(matches)}`);

	//if request was invalid, redirect to admin page with alert message
	if(matches.length == undefined || matches.length == 0){
		return res.redirect('/manage?alert=Could not get matches from TBA for specified event ' + eventKey);
	}
	
	logger.debug('Found ' + matches.length + ' data for event ' + eventKey);
	
	// First delete existing match data for the given event
	await utilities.remove('matches', {'event_key': eventKey});
	// Now, insert the new data
	await utilities.insert('matches', matches);
		
	//redirect to matches page
	res.redirect(`/admin/externaldata/matches?eventKey=${eventKey}`);
}));


/**
 * Admin page to display all teams in local database.
 * @url /admin/externaldata/teams
 * @view /teams
 */
router.get('/teams', wrap(async (req, res) => {
	logger.addContext('funcName', 'teams[get]');
	logger.info('ENTER');
	
	let teams: Team[];
	
	//if no event is specified send page with all teams
	if(req.query.eventKey == '' || req.query.eventKey == undefined){
		
		// Read all teams from DB
		teams = await utilities.find('teams', {}, {sort: {'team_number': 1}});
		//render page w/ all teams			
		res.render('./admin/externaldata/teams', {
			title: 'All Teams',
			teams: teams,
		});
	}
	//if event is specified, get list of teams from event
	else{
		//get eventKey
		let eventKey = req.query.eventKey;
		
		//prepare api call
		let url = `event/${eventKey}/teams/simple`;
		
		//perform api call
		teams = await utilities.requestTheBlueAlliance(url);
		
		//sort list of teams by number
		teams.sort(function(a, b) {
			let aNum = a.team_number;
			let bNum = b.team_number;
			if( aNum < bNum ){
				return -1;
			}
			if( aNum > bNum ){
				return 1;
			}
			return 0;
		});
		
		//render page with sorted list of teams
		res.render('./admin/externaldata/teams', {
			title: `Teams in ${req.event.name}`,
			teams: teams
		});
	}
}));

module.exports = router;
