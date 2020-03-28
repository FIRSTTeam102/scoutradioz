const express = require('express');
const logger = require('log4js').getLogger('sync');
const wrap = require('express-async-handler');
const utilities = require('@firstteam102/scoutradioz-utilities');
const router = express.Router();

router.all('/*', wrap(async (req, res, next) => {
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	next();
}));

// Function to refresh the list of events for the current year (and) to refresh all teams data
router.get('/resyncevents', wrap(async (req, res) => {
	logger.addContext('funcName', 'resyncevents[get]');
	logger.info('ENTER');	

	// Get the year from the URL (or default to the current year)
	var year = req.query.year;
	if (!year) {
		// Get the current year
		var now = new Date();
		year = now.getFullYear();
	}

	// Get the start query character (or default to 'a')
	var urlStart = req.query.start;
	if (!urlStart) {
		urlStart = 'a';
	}
	var queryStart = year + urlStart;

	// Get the start query character (or default to 'a')
	var urlEnd = req.query.end;
	if (!urlEnd) {
		urlEnd = 'z';
	}
	// We append 'zzzzzzz' to bracket every possible alphanumeric combination (after the first alpha character after the year) 
	var queryEnd = year + urlEnd + 'zzzzzzz';

	logger.debug('from URL (or defaults): year=' + year + ',queryStart=' + queryStart + ',queryEnd=' + queryEnd);

	//Set up TBA url
	var url = `events/${year}/simple`;
	logger.debug('url=' + url);
	
	//Submit request to TBA
	var eventData = await utilities.requestTheBlueAlliance(url);
		
	var events = JSON.parse(eventData);
	//if request was invalid, redirect to admin page with alert message
	if(events.length == undefined || events.length == 0) {
		return res.send('ERROR events not loaded');
	}
	
	// 2020-02-08, M.O'C: Need to track which teams are at each event, by event key - pull team keys for each event & store in the event
	var enrichedEvents = [];
	for (var i in events) {
		if (events[i]) {
			var thisEvent = events[i];
			var thisEventKey = thisEvent.key;
	
			if ( thisEventKey > queryStart && thisEventKey < queryEnd)  {
				var eventTeamsUrl = `event/${thisEventKey}/teams/keys`;
				var thisTeamKeys = [];
		
				var retries = 3;
				while (retries > 0) {
					var readSuccess = false;
					try {
						var thisTeamKeysData = await utilities.requestTheBlueAlliance(eventTeamsUrl);
						readSuccess = true;
					}
					catch(err) {
						console.log('Problem reading team keys for ' + thisEventKey + ' - ' + err.message);
						retries -= 1;
					}
		
					if (readSuccess) {
						thisTeamKeys = JSON.parse(thisTeamKeysData);
						retries = -1;
					}
				}
				thisEvent['team_keys'] = thisTeamKeys;
		
				enrichedEvents.push(thisEvent);
			}
		}
	}

	console.log('enrichedEvents.length=' + enrichedEvents.length);
	
	//Find existing events list for year & query brackets
	var dbEvents = await utilities.find('events', { $and: [{'key': {$gt: queryStart}}, {'key': {$lt: queryEnd}}] }, {'key': 1} );
	console.log('removing dbEvents.length=' + dbEvents.length);

	//Remove matching existing events
	await utilities.remove('events', { $and: [{'key': {$gt: queryStart}}, {'key': {$lt: queryEnd}}] });
	//Now insert new events list
	await utilities.insert('events', enrichedEvents);

	//return a simple SUCCESS message if it works
	return res.send('SUCCESS ' + year + ' removed ' + dbEvents.length + ' inserted ' + enrichedEvents.length);
}));

// Function to refresh all teams data
router.get('/resyncteams', wrap(async (req, res) => {
	logger.addContext('funcName', 'resyncteams[get]');
	logger.info('ENTER');
		
	////// Teams sync

	var teamPageIdx = 0;
	var teamsArray = [];
	var keepLooping = true;
	while (keepLooping) {
		//Set up TBA url
		var url = `teams/${teamPageIdx}`;
		logger.debug('url=' + url);
		
		//Submit request to TBA
		var teamData = await utilities.requestTheBlueAlliance(url);
			
		var teams = JSON.parse(teamData);
		//if request was invalid, redirect to admin page with alert message
		if(teams.length == undefined || teams.length == 0) {
			// presumably we've reached the end of the data
			logger.debug('finished pulling teams');
			keepLooping = false;
		}
		else {
			// we have teams to add to the total array
			//var printIdx = 0;
			for (var team of teams) {
				//var team = teams[i];
				// if (printIdx >= 50) {
				// 	printIdx = 0;
				// 	logger.debug("team=" + JSON.stringify(team));
				// }
				// printIdx += 1;
				teamsArray.push(team);
			}
		}

		// increment the index counter
		teamPageIdx += 1;
	}	
	logger.debug('total teams=' + teamsArray.length);
	
	//Remove existing events list for year
	await utilities.remove('teams', {});
	//Now insert new events list for year
	await utilities.insert('teams', teamsArray);

	//redirect back to events page
	return res.send('SUCCESS inserted ' + teamsArray.length);

	/* Moved into its own method

	////// Events sync

    // Get the current year
	var now = new Date();
	var year = now.getFullYear();

	//Set up TBA url
	var url = `events/${year}/simple`;
	logger.debug("url=" + url);
	
	//Submit request to TBA
	var eventData = await utilities.requestTheBlueAlliance(url);
		
	var events = JSON.parse(eventData);
	//if request was invalid, redirect to admin page with alert message
	if(events.length == undefined || events.length == 0) {
		return res.send("ERROR events not loaded");
	}
	
	// 2020-02-08, M.O'C: Need to track which teams are at each event, by event key - pull team keys for each event & store in the event
	var enrichedEvents = [];
	for (var i in events) {
		var thisEvent = events[i];
		var thisEventKey = thisEvent.key;

		var eventTeamsUrl = `event/${thisEventKey}/teams/keys`;
		var thisTeamKeys = [];

		var retries = 3;
		while (retries > 0) {
			var readSuccess = false;
			try {
				var thisTeamKeysData = await utilities.requestTheBlueAlliance(eventTeamsUrl);
				readSuccess = true;
			} catch(err) {
				console.log("Problem reading team keys for " + thisEventKey + " - " + err.message);
				retries -= 1;
			}

			if (readSuccess) {
				thisTeamKeys = JSON.parse(thisTeamKeysData);
				retries = -1;
			}
		}
		thisEvent['team_keys'] = thisTeamKeys;
		
		enrichedEvents.push(thisEvent);
	}

	//Remove existing events list for year
	await utilities.remove("events", { "year": year });
	//Now insert new events list for year
	//await utilities.insert("events", events);
	await utilities.insert("events", enrichedEvents);
	*/
}));

// Function to recalculate all derived data for the current team & current event
router.get('/recalcderived', wrap(async (req, res) => {
	logger.addContext('funcName', 'recalcderived[get]');
	logger.info('ENTER');
	
	var event_year = req.event.year;
	var event_key = req.event.key;
	var org_key = req.user.org_key;

	logger.info('ENTER org_key=' + org_key + ',event_key=' + event_key);

	// read in the 'derived' metrics from the matchscouting layout
	var matchLayout = await utilities.find('layout', {org_key: org_key, year: event_year, form_type: 'matchscouting', type: 'derived'}, {sort: {'order': 1}});
	// logger.debug("matchLayout[0]" + JSON.stringify(matchLayout[0]));
	// for (var z in matchLayout[0].operands)
	// 	logger.debug("operands[" + z + "]=" + matchLayout[0].operands[z]);

	// read in existing match scouting data
	var scored = await utilities.find('matchscouting', {'org_key': org_key, 'event_key': event_key, 'data': {$exists: true} }, { sort: {'time': 1} });
	// logger.debug("scored[0].data=" + JSON.stringify(scored[0].data));
	// logger.debug("scored[0].data[matchLayout[0].operands[2]]=" + JSON.stringify(scored[0].data[matchLayout[0].operands[2]]));

	// cycle through each scored match & [re]calculate derived metrics - push into new array 'updatedScored'
	// [SEE ALSO SCOUTING.JS]
	var updatedScored = [];
	//var debugCountdown = 0;
	for (var i in scored) {
		if (scored[i].data) {
			var thisScored = scored[i];
			for (var thisItem of matchLayout) {
				//var thisItem = matchLayout[j];
				
				var derivedMetric = NaN;
				switch (thisItem.operator) {
					case 'sum':
						// add up the operands
						var sum = 0;
						//eslint-disable-next-line
						for (var metricId in thisItem.operands)
							sum += thisScored.data[thisItem.operands[metricId]];
						derivedMetric = sum;
						break;
				}
				thisScored.data[thisItem.id] = derivedMetric;
			}	
			updatedScored.push(thisScored);
		}
	}

	// Delete the old scored data
	await utilities.remove('matchscouting', {'org_key': org_key, 'event_key': event_key, 'data': {$exists: true} });

	// Insert the revised scored data
	await utilities.insert('matchscouting', updatedScored);
	
	//2020-03-27 (security hole) removed res.render(admin) and switched with res.send
	res.send('SUCCESS');
}));

module.exports = router;