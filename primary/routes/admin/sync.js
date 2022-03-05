const express = require('express');
const logger = require('log4js').getLogger('sync');
const wrap = require('express-async-handler');
const utilities = require('@firstteam102/scoutradioz-utilities');
const router = express.Router();
const matchDataHelper = require('@firstteam102/scoutradioz-helpers').matchData;
const e = require('@firstteam102/http-errors');

router.all('/*', wrap(async (req, res, next) => {
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	next();
}));

// Gets the list of events without enriching 
router.post('/resynceventlist', wrap(async (req, res) => {
	logger.addContext('funcName', 'resynceventlist[post]');
	logger.info('ENTER');	
	
	// Get the year from the URL (or default to the current year)
	const year = parseInt(req.query.year || req.body.year || new Date().getFullYear());
	
	logger.debug(`Getting event list, year=${year}`);
	
	// Events with simple data
	var url = `events/${year}/simple`;
	var events = await utilities.requestTheBlueAlliance(url);
	// Events with full data
	url = `events/${year}`;
	var eventsFull = await utilities.requestTheBlueAlliance(url);
	// Properties of the full event list to add to the simple event list
	var keysToAdd = ['timezone'];
	
	for (let i in events) {
		let thisEvent = events[i];
		let thisEventFull;
		// if the indices match between eventsFull & events, we don't have to search
		if (eventsFull[i].key === thisEvent.key) {
			thisEventFull = eventsFull[i];
		}
		else {
			// search for the appropriate event
			logger.debug('Need to search for an event in the whole list');
			for (let event of eventsFull) 
				if (event.key === thisEvent.key) {
					thisEventFull = event;
					break;
				}
		}
		// Enrich the event with our desired extra keys
		for (let key of keysToAdd) {
			thisEvent[key] = thisEventFull[key];
		}
	}
	
	logger.info(`Enriched ${events.length} events with the following keys: ${keysToAdd.join(', ')}`);
	
	//Remove matching existing events
	console.log({year: year});
	let removeResult = await utilities.remove('events', { year: year });
	//Now insert new events list
	let insertResult = await utilities.insert('events', events);
	
	logger.info(`${removeResult.deletedCount} removed, ${insertResult.insertedCount} inserted`);
	
	res.send({message: `Found ${events.length} events.`, length: events.length});
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
	
	const keyFilter = { $and: [{'key': {$gt: queryStart}}, {'key': {$lt: queryEnd}}] };
	
	// 2022-02-19 JL: Events now retrieved from TBA in /resynceventlist
	var events = await utilities.find('events', keyFilter, {sort: {key: 1}});
	
	// if no events were found in db, that just means there are none starting with that letter
	if(events.length == 0) {
		return res.send(`SUCCESS ${year} updated 0`);
	}
	
	var updatedNum = 0;
	
	// 2020-02-08, M.O'C: Need to track which teams are at each event, by event key - pull team keys for each event & store in the event
	// 2022-02-19 JL: Cleaned up event resync, switched to update statement instead of delete/insert
	for (let event of events) {
		let thisEventKey = event.key;
		
		let eventTeamsUrl = `event/${thisEventKey}/teams/keys`;
		let thisTeamKeys = [];
		
		let retries = 3;
		while (retries > 0) {
			var readSuccess = false;
			try {
				thisTeamKeys = await utilities.requestTheBlueAlliance(eventTeamsUrl);
				readSuccess = true;
			}
			catch (err) {
				console.log('Problem reading team keys for ' + thisEventKey + ' - ' + err.message);
				retries -= 1;
			}
			
			if (readSuccess) {
				break;
			}
		}
		
		let writeResult = await utilities.update('events', {key: thisEventKey}, {$set: {team_keys: thisTeamKeys}});
		logger.debug(`Updated for ${thisEventKey}, writeResult=${writeResult}`);
		updatedNum += 1;
		
		await promiseTimeout(200); // Wait a short bit
	}
	
	//return a simple SUCCESS message if it works
	return res.send('SUCCESS ' + year + ' updated ' + updatedNum);
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
		var teams = await utilities.requestTheBlueAlliance(url);
		
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
}));

// Function to recalculate all derived data for the current team & current event
router.get('/recalcderived', wrap(async (req, res) => {
	logger.addContext('funcName', 'recalcderived[get]');
	logger.info('ENTER');
	
	var event_year = req.event.year;
	var event_key = req.event.key;
	var org_key = req.user.org_key;

	logger.info('ENTER org_key=' + org_key + ',event_key=' + event_key);

	// read in existing match scouting data
	var scored = await utilities.find('matchscouting', {'org_key': org_key, 'event_key': event_key, 'data': {$exists: true} }, { sort: {'time': 1} });
	// logger.debug("scored[0].data=" + JSON.stringify(scored[0].data));
	// logger.debug("scored[0].data[matchLayout[0].operands[2]]=" + JSON.stringify(scored[0].data[matchLayout[0].operands[2]]));

	// cycle through each scored match & [re]calculate derived metrics - push into new array 'updatedScored'
	// [SEE ALSO SCOUTING.JS]
	var writeQueries = [];
	//var debugCountdown = 0;
	for (var i in scored) {
		if (scored[i].data) {
			// 2022-02-22, JL: Moved dervied metric calculations into matchDataHelper
			var thisScored = await matchDataHelper.calculateDerivedMetrics(org_key, event_year, scored[i].data);
			writeQueries.push({
				updateOne: {
					filter: {_id: scored[i]._id},
					update: {$set: {data: thisScored}}
				}
			});
		}
	}
	
	// 2022-03-04 JL: fixed bug & put the update stuff into a bulkWrite
	let writeResult = await utilities.bulkWrite('matchscouting', writeQueries);
	res.send('SUCCESS - writeResult = ' + JSON.stringify(writeResult));

	// Delete the old scored data
	// await utilities.remove('matchscouting', {'org_key': org_key, 'event_key': event_key, 'data': {$exists: true} });

	// // Insert the revised scored data
	// await utilities.insert('matchscouting', updatedScored);
	
	//2020-03-27 (security hole) removed res.render(admin) and switched with res.send
	// res.send('SUCCESS');
}));


function promiseTimeout(time) {
	return new Promise((resolve, reject) => {
		setTimeout(resolve, time);
	});
}

module.exports = router;