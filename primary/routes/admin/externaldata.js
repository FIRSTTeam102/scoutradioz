const router = require("express").Router();
const logger = require('log4js').getLogger();
const wrap = require('express-async-handler');
const utilities = require('@firstteam102/scoutradioz-utilities');
const tba_utils = require('../../tba_utils');

router.all('/*', wrap(async (req, res, next) => {
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
	
	var thisFuncName = "externaldata.events[get]: ";
	logger.info(thisFuncName + 'ENTER')
	
	var events = {};
	
	// Read events from DB for specified year
	// var eventCol = db.get("events");

    // Get our query value(s)
    var year = req.query.year;
	if (!year)
	{
		year = (new Date()).getFullYear();
		logger.debug(thisFuncName + 'No year specified, defaulting to ' + year);
	}
	logger.debug(thisFuncName + 'Year: ' + year);

	var events = await utilities.find("events", {"year": parseInt(year)},{sort: {"start_date": 1, "end_date": 1, "name": 1}});
		
	// Read unique list of years in DB
	var distinctYears = await utilities.distinct("events", "year");
	var uniqueYears = distinctYears.sort();

	logger.debug(thisFuncName + "uniqueYears=" + uniqueYears);
	
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
	logger.debug(thisFuncName + "url=" + url);
	
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
	
	var thisFuncName = "externaldata.matches[get]: ";
	logger.info(thisFuncName + 'ENTER')
	
	var matches = {};
	
	// var matchCol = db.get("matches");

    // Get our query value(s)
    var eventId = req.query.eventId || req.query.event_key;
	if (!eventId)
	{
		logger.debug(thisFuncName + 'No event specified');
		res.redirect("/admin/externaldata/events");
	}
	logger.debug(thisFuncName + 'eventId=' + eventId);

	// Read matches from DB for specified event
	var matches = await utilities.find("matches", {"event_key": eventId},{sort: {"time": 1}});
	
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
	
	var thisFuncName = "externaldata.matches[post]: ";
	logger.info(thisFuncName + 'ENTER')
	
	// var matchCol = db.get("matches");
	// var eventCol = db.get("events");

    // Get our form value(s)
    var eventId = req.body.eventId;
	logger.debug(thisFuncName + 'eventId=' + eventId);
	
	//Set up TBA api request
	var url = `event/${eventId}/matches`;
	logger.debug(thisFuncName + "url=" + url);
	
	//Request from TBA
	var eventData = await utilities.requestTheBlueAlliance(url);
	var matches = JSON.parse(eventData);
	logger.debug(`${thisFuncName} matches= ${JSON.stringify(matches)}`);

	//if request was invalid, redirect to admin page with alert message
	if(matches.length == undefined || matches.length == 0){
		return res.redirect("/manage?alert=Could not get matches from TBA for specified event " + eventId);
	}
	
	logger.debug(thisFuncName + 'Found ' + matches.length + ' data for event ' + eventId);
	
	// First delete existing match data for the given event
	await utilities.remove("matches", {"event_key": eventId});
	// Now, insert the new data
	await utilities.insert("matches", matches);
		
	//redirect to matches page
	res.redirect(`/admin/externaldata/matches?eventId=${eventId}`);
}));


/**
 * Admin page to display all teams in local database.
 * @url /admin/externaldata/teams
 * @view /teams
 */
router.get("/teams", wrap(async (req, res) => {
	
	var thisFuncName = "externaldata.teams[get]: ";
	logger.info(thisFuncName + 'ENTER')
	
	// var teamCol = db.get("teams");
	
	//return res.send(req.query.eventId);
	
	//if no event is specified send page with all teams
	if(req.query.eventId == "" || req.query.eventId == undefined){
		
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
		//get eventId
		var eventId = req.query.eventId;
		
		//prepare api call
		var url = `event/${eventId}/teams/simple`;
		
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
