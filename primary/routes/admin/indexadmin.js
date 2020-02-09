const express = require('express');
const logger = require('log4js').getLogger();
const utilities = require('../../utilities');
const router = express.Router();

router.get('/', async function(req, res) {
	
	//res.redirect('/manage');
	res.render('./admin/admindashboard', { 
		title: `Administration`
	});
	
});

router.get('/resynceventsandteams', async function(req, res) {
	// Function to refresh the list of events for the current year (and) to refresh all teams data
	var thisFuncName = "indexadmin.resynceventsandteams[post]: ";
	
    // Get the current year
	var now = new Date();
	var year = now.getFullYear();

	////// Events sync

	//Set up TBA url
	var url = `events/${year}/simple`;
	logger.debug(thisFuncName + "url=" + url);
	
	//Submit request to TBA
	var eventData = await utilities.requestTheBlueAlliance(url);
		
	var events = JSON.parse(eventData);
	//if request was invalid, redirect to admin page with alert message
	if(events.length == undefined || events.length == 0) {
		return res.send("ERROR events not loaded");
	}
	
	//Remove existing events list for year
	await utilities.remove("events", { "year": parseInt(year) });
	//Now insert new events list for year
	await utilities.insert("events", events);

	////// Teams sync

	var teamPageIdx = 0;
	var teamsArray = [];
	var keepLooping = true;
	while (keepLooping) {
		//Set up TBA url
		var url = `teams/${teamPageIdx}`;
		logger.debug(thisFuncName + "url=" + url);
		
		//Submit request to TBA
		var teamData = await utilities.requestTheBlueAlliance(url);
			
		var teams = JSON.parse(teamData);
		//if request was invalid, redirect to admin page with alert message
		if(teams.length == undefined || teams.length == 0) {
			// presumably we've reached the end of the data
			logger.debug(thisFuncName + "finished pulling teams");
			keepLooping = false;
		} else {
			// we have teams to add to the total array
			var printIdx = 0;
			for (var i in teams) {
				var team = teams[i];
				// if (printIdx >= 50) {
				// 	printIdx = 0;
				// 	logger.debug(thisFuncName + "team=" + JSON.stringify(team));
				// }
				// printIdx += 1;
				teamsArray.push(team);
			}
		}

		// increment the index counter
		teamPageIdx += 1;
	}	
	logger.debug(thisFuncName + "total teams=" + teamsArray.length);
	
	//Remove existing events list for year
	await utilities.remove("teams", {});
	//Now insert new events list for year
	await utilities.insert("teams", teamsArray);

	//redirect back to events page
	return res.send("SUCCESS");
});

module.exports = router;