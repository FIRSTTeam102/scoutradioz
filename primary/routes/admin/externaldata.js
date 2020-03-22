const router = require("express").Router();
const logger = require('log4js').getLogger('externaldata');
const wrap = require('express-async-handler');
const utilities = require('@firstteam102/scoutradioz-utilities');

router.all('/*', wrap(async (req, res, next) => {
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate (process.env.ACCESS_GLOBAL_ADMIN)) {
		next();
	}
}));

/**
 * Admin page to show a list of events by any given year.
 * @url /admin/externaldata/events
 * @view /events
 */
router.get("/events", wrap(async (req, res) => {
	logger.addContext('funcName', 'events[get]');
	logger.info('ENTER')
	
	var events = {};
	
	// Read events from DB for specified year
	// var eventCol = db.get("events");

    // Get our query value(s)
    var year = req.query.year;
	if (!year)
	{
		year = (new Date()).getFullYear();
		logger.debug('No year specified, defaulting to ' + year);
	}
	logger.debug('Year: ' + year);

	var events = await utilities.find("events", {"year": parseInt(year)},{sort: {"start_date": 1, "end_date": 1, "name": 1}});
		
	// Read unique list of years in DB
	var distinctYears = await utilities.distinct("events", "year");
	var uniqueYears = distinctYears.sort();

	logger.debug("uniqueYears=" + uniqueYears);
	
	res.render("./manage/events", {
		title: "Events",
		"events": events,
		"years": uniqueYears,
		"selectedYear": year
	});
}));

/**
 * POST: Admin page to update all events for a given year.
 * @url POST: /admin/externaldata/events
 * @redirect /admin/externaldata/events
 */
router.post("/events", wrap(async (req, res) => {
	
	//Event data synchronization is now updated automatically
	res.send(410);
	
	/*
	var thisFuncName = "externaldata.events[post]: ";
	
	// var eventCol = db.get("events");
	
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
router.get("/matches", wrap(async (req, res) => {
	logger.addContext('funcName', 'matches[get]');
	logger.info('ENTER')
	
	var matches = {};
	
	// var matchCol = db.get("matches");

    // Get our query value(s)
    var eventKey = req.query.eventKey || req.query.event_key;
	if (!eventKey)
	{
		logger.debug('No event specified');
		res.redirect("/admin/externaldata/events");
	}
	logger.debug('eventKey=' + eventKey);

	// Read matches from DB for specified event
	var matches = await utilities.find("matches", {"event_key": eventKey},{sort: {"time": 1}});
	
	res.render("./manage/matches", {
		title: "Matches",
		"matches": matches
	});
}));

/**
 * POST: Admin page to update match information for a given event.
 * @url POST: /admin/externaldata/matches
 * @redirect /admin (to handle error)
 * @redirect /admin/externaldata/matches
 */
router.post("/matches", wrap(async (req, res) => {
	logger.addContext('funcName', 'matches[post]');
	logger.info('ENTER')
	
	// var matchCol = db.get("matches");
	// var eventCol = db.get("events");

    // Get our form value(s)
    var eventKey = req.body.eventKey;
	logger.debug('eventKey=' + eventKey);
	
	//Set up TBA api request
	var url = `event/${eventKey}/matches`;
	logger.debug("url=" + url);
	
	//Request from TBA
	var eventData = await utilities.requestTheBlueAlliance(url);
	var matches = JSON.parse(eventData);
	logger.debug(`matches= ${JSON.stringify(matches)}`);

	//if request was invalid, redirect to admin page with alert message
	if(matches.length == undefined || matches.length == 0){
		return res.redirect("/manage?alert=Could not get matches from TBA for specified event " + eventKey);
	}
	
	logger.debug('Found ' + matches.length + ' data for event ' + eventKey);
	
	// First delete existing match data for the given event
	await utilities.remove("matches", {"event_key": eventKey});
	// Now, insert the new data
	await utilities.insert("matches", matches);
		
	//redirect to matches page
	res.redirect(`/admin/externaldata/matches?eventKey=${eventKey}`);
}));


/**
 * Admin page to display all teams in local database.
 * @url /admin/externaldata/teams
 * @view /teams
 */
router.get("/teams", wrap(async (req, res) => {
	logger.addContext('funcName', 'teams[get]');
	logger.info('ENTER')
	
	// var teamCol = db.get("teams");
	
	//return res.send(req.query.eventKey);
	
	//if no event is specified send page with all teams
	if(req.query.eventKey == "" || req.query.eventKey == undefined){
		
		// Read all teams from DB
		var teams = await utilities.find("teams", {}, {sort: {"team_number": 1}});
		//render page w/ all teams			
		res.render("./manage/teams", {
			title: "All Teams",
			"teams": teams,
			header: "All Teams in Database"
		});
	}
	//if event is specified, get list of teams from event
	else{
		//get eventKey
		var eventKey = req.query.eventKey;
		
		//prepare api call
		var url = `event/${eventKey}/teams/simple`;
		
		//perform api call
		var teamsData = await utilities.requestTheBlueAlliance(url);
		var teams = JSON.parse(teamsData);
		
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
		res.render("./manage/teams", {
			title: `Teams in ${req.event.name}`,
			"teams": teams
		});
	}
}));

module.exports = router;
