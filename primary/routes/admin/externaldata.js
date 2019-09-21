var express = require("express");
var router = express.Router();

/**
 * Admin page to show a list of events by any given year.
 * @url /admin/data/events
 * @view /events
 */
router.get("/events", async function(req, res) {
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	var thisFuncName = "externaldata.events[get]: ";
	res.log(thisFuncName + 'ENTER')
	
	var events = {};
	
    // Set our internal DB variable
    var db = req.db;

    // Get our query value(s)
    var year = req.query.year;
	if (!year)
	{
		year = (new Date()).getFullYear();
		res.log(thisFuncName + 'No year specified, defaulting to ' + year);
	}
	res.log(thisFuncName + 'Year: ' + year);

	// Read events from DB for specified year
	var eventCol = db.get("events");
	eventCol.find({"year": parseInt(year)},{sort: {"start_date": 1, "end_date": 1, "name": 1}}, function(e, docs){
		
		if(e){ //if error, log to console
			res.log(e);
		}
		events = docs;
		
		// Read unique list of years in DB
		var uniqueYears;
		eventCol.distinct("year", function(e, docs) {
			uniqueYears = docs.sort();
			res.log(thisFuncName + "uniqueYears=" + uniqueYears);
			
			res.render("./admin/events", {
				title: "Events",
				"events": events,
				"years": uniqueYears,
				"selectedYear": year
			});
		});
	});
});

/**
 * POST: Admin page to update all events for a given year.
 * @url POST: /admin/data/events
 * @redirect /admin/data/events
 */
router.post("/events", async function(req, res) {
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	var thisFuncName = "externaldata.events[post]: ";
	
    // Set our internal DB variable
    var db = req.db;
	var eventCol = db.get("events");
	
    // Get our form value(s)
    var year = req.body.year;
	
	//Set up TBA url
	var url = `https://www.thebluealliance.com/api/v3/events/${year}/simple`;
	res.log(thisFuncName + "url=" + url);
	
	//Submit request to TBA
	req.client.get(url, req.tbaRequestArgs, function(data, response){
		
		var events = JSON.parse(data);
		//if request was invalid, redirect to admin page with alert message
		if(events.length == undefined || events.length == 0){
			return res.redirect("/admin?alert=Could not get events from TBA for specified year " + year);
		}
		
		//Remove existing events list for year
		eventCol.remove({ "year": parseInt(year) }, function(){
			//Now insert new events list for year
			eventCol.insert(events, function(){
				//redirect back to events page
				res.redirect(`/admin/data/events?year=${year}`);
			});
		});
	});
	/* OLD VERSION RRRRREEEEEEEEEE
	// Read unique list of years in DB
	var uniqueYears;
	eventCol.distinct("year", function(e, docs) {
		uniqueYears = docs.sort();
	
		client.get(url, args, function (data, response) {
			var array = JSON.parse(data);
			var arrayLength = array.length;
			if (arrayLength == null)
			{
				res.log(thisFuncName + "Whoops, there was an error!")
				res.log(thisFuncName + "data=" + data);
				year = (new Date()).getFullYear();
				
				res.render("./admin/events", {
					title: "Events",
					"years": uniqueYears,
					"selectedYear": year
				});
			}
			else
			{
				res.log(thisFuncName + 'Found ' + arrayLength + ' data for year ' + year);
				//res.log(thisFuncName + 'Stringify array: ' + JSON.stringify(array));
				
				// First delete existing event data for the given year
				eventCol.remove({"year": parseInt(year)}, function(e, docs) {
					// Now, insert the new data
					eventCol.insert(array, function(e, docs) {
						// Then read it back in order
						eventCol.find({"year": parseInt(year)},{sort: {"start_date": 1, "end_date": 1, "name": 1}}, function(e, docs){
							var eventData = docs;
							
							// Re-read the unique years (in case we just added a new one)
							eventCol.distinct("year", function(e, docs) {
								uniqueYears = docs.sort();

								res.render("./admin/events", {
									title: "Events",
									"events": eventData,
									"years": uniqueYears,
									"selectedYear": year
								});
							});
						});
					});
				});
			}
		});
	});
	*/
});

/**
 * Admin page to display matches of a specified event id.
 * @url /admin/data/matches
 * @view /matches
 */
router.get("/matches", async function(req, res) {
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	var thisFuncName = "externaldata.matches[get]: ";
	res.log(thisFuncName + 'ENTER')
	
	var matches = {};
	
    //Set up db and collections
    var db = req.db;
	var matchCol = db.get("matches");

    // Get our query value(s)
    var eventId = req.query.eventId;
	if (!eventId)
	{
		res.log(thisFuncName + 'No event specified');
		res.redirect("/admin/data/events");
	}
	res.log(thisFuncName + 'eventId=' + eventId);

	// Read matches from DB for specified event
	matchCol.find({"event_key": eventId},{sort: {"time": 1}}, function(e, docs){
		
		if(e){ //if error, log to console
			res.log(e);
		}
		matches = docs;
		
		res.render("./admin/matches", {
			title: "Matches",
			"matches": matches
		});
	});
});

/**
 * POST: Admin page to update match information for a given event.
 * @url POST: /admin/data/matches
 * @redirect /admin (to handle error)
 * @redirect /admin/data/matches
 */
router.post("/matches", async function(req, res) {
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	var thisFuncName = "externaldata.matches[post]: ";
	res.log(thisFuncName + 'ENTER')
	
    // Set our internal DB variable
    var db = req.db;
	var matchCol = db.get("matches");
	var eventCol = db.get("events");

    // Get our form value(s)
    var eventId = req.body.eventId;
	res.log(thisFuncName + 'eventId=' + eventId);
	
	//Set up TBA api request
	var url = `https://www.thebluealliance.com/api/v3/event/${eventId}/matches`;
	res.log(thisFuncName + "url=" + url);
	
	//Request from TBA
	req.client.get(url, req.tbaRequestArgs, function (data, response) {
		
		var matches = JSON.parse(data);
		res.log(matches);
		//if request was invalid, redirect to admin page with alert message
		if(matches.length == undefined || matches.length == 0){
			return res.redirect("/admin?alert=Could not get matches from TBA for specified event " + eventId);
		}
		
		res.log(thisFuncName + 'Found ' + matches.length + ' data for event ' + eventId);
		
		// First delete existing match data for the given event
		matchCol.remove({"event_key": eventId}, function(e, docs) {
			// Now, insert the new data
			matchCol.insert(matches, function(e, docs) {
				
				//redirect to matches page
				res.redirect(`/admin/data/matches?eventId=${eventId}`);
			});
		});
	});
});


/**
 * Admin page to display all teams in local database.
 * @url /admin/data/teams
 * @view /teams
 */
router.get("/teams", async function(req, res) {
	//Check authentication for team admin level
	if( !await req.authenticate( process.env.ACCESS_TEAM_ADMIN ) ) return;
	
	var thisFuncName = "externaldata.teams[get]: ";
	res.log(thisFuncName + 'ENTER')
	
    // Set our internal DB variable
    var db = req.db;
	var teamCol = db.get("teams");
	
	//return res.send(req.query.eventId);
	
	//if no event is specified send page with all teams
	if(req.query.eventId == "" || req.query.eventId == undefined){
		
		// Read all teams from DB
		teamCol.find({},{sort: {"key": 1}}, function(e, teams){
			//render page w/ all teams			
			res.render("./admin/teams", {
				title: "All Teams",
				"teams": teams,
				header: "All Teams in Database"
			});
		});
	}
	//if event is specified, get list of teams from event
	else{
		//get eventId
		var eventId = req.query.eventId;
		
		//prepare api call
		var url = `https://www.thebluealliance.com/api/v3/event/${eventId}/teams/simple`;
		
		//perform api call
		req.client.get(url, req.tbaRequestArgs, function(data, response){
			
			var teams = JSON.parse(data);
			
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
			res.render("./admin/teams", {
				title: `Teams in ${req.event.name}`,
				"teams": teams
			});
		});
	}
});

module.exports = router;
