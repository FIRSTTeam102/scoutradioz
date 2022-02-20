const router = require('express').Router();
const bcrypt = require('bcryptjs');
const logger = require('log4js').getLogger();
const wrap = require('express-async-handler');
const utilities = require('@firstteam102/scoutradioz-utilities');
const e = require('@firstteam102/http-errors');

router.all('/*', wrap(async (req, res, next) => {
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate(process.env.ACCESS_TEAM_ADMIN)) {
		next();
	}
}));

/**
 * Admin page to control and assign pairs of students for scouting.
 * @url /manage/scoutingpairs/
 * @views /manage/scoutingpairs
 */
router.get('/', wrap(async (req, res) => {
	
	const thisFuncName = 'scoutingpairs.scoutingpairs(root): ';
	const startTime = Date.now();
	const org_key = req.user.org_key;
	
	//Log message so we can see on the server side when we enter this
	logger.info(thisFuncName + 'ENTER org_key=' + org_key);
	logger.debug(thisFuncName + 'Requesting all members from db');
	
	if (!req.user.org.config.members.subteams) throw new e.InternalServerError(`Could not get list of subteams from org config: ${org_key}`);
	const subteams = req.user.org.config.members.subteams;
	
	let pitScoutSubteams = []; // for use in the view
	let pitScoutSubteamKeys = []; // for use in the db query
	for (let subteam of subteams) {
		if (subteam.pit_scout) {
			pitScoutSubteams.push(subteam);
			pitScoutSubteamKeys.push(subteam.subteam_key);
		}
	}
	if (pitScoutSubteams.length == 0) throw new e.InternalServerError('Org config error: No subteams have "pit scout" enabled');
	
	// Get all "present but not assigned" members for each subteam
	let dbPromises = [];
	for (let key of pitScoutSubteamKeys) {
		dbPromises.push(
			utilities.find('users', 
				{'org_info.subteam_key': key, 'event_info.present': true, 'event_info.assigned': false, org_key: org_key}, 
				{sort: {'name': 1}}
			)
		);
	}
	//Any team members that are not on a subteam, but are unassigned and present.
	dbPromises.push( utilities.find('users', {'event_info.assigned': false, 'event_info.present': true, org_key: org_key}, {sort: {'name': 1}}) );
	
	logger.debug(thisFuncName + 'Requesting scouting pairs from db');
	
	//Get all already-assigned pairs
	// 2020-02-12, M.O'C - Adding "org_key": org_key, 
	dbPromises.push( utilities.find('scoutingpairs', {'org_key': org_key}) );
	
	logger.trace(thisFuncName + 'Awaiting all db requests');
	
	var preAwaitTime = Date.now() - startTime;
	
	//Await every promise in parallel.
	Promise.all(dbPromises)
		.then(values => {
			// Get the resulting values from the array returned by Promise.all.
			for (let i = 0; i < pitScoutSubteams.length; i++) {
				// the values array will be ordered the same as pitScoutSubteams & pitScoutSubteamKeys
				pitScoutSubteams[i].members = values[i]; 
			}
			var available = values[values.length - 2]; // second to last
			var assigned = values[values.length - 1]; // last
		
			var postAwaitTime = Date.now() - startTime - preAwaitTime;
			logger.trace(`preAwaitTime: ${preAwaitTime}ms, postAwaitTime: ${postAwaitTime}ms`);
		
			logger.trace(thisFuncName + 'Rendering');
		
			res.render('./manage/scoutingpairs', {
				title: 'Scouting Assignments',
				subteams: pitScoutSubteams,
				assigned: assigned,
				available: available
			});
		});
}));

/* POST to Set scoutingPair Service */
router.post('/setscoutingpair', wrap(async (req, res) => {
	
	var thisFuncName = 'scoutingpairs.setscoutingpair[post]: ';
	
	// Get our form values. These rely on the "name" attributes of form elements (e.g., named 'data' in the form)
	var data = req.body.data;
	var org_key = req.user.org_key;

	// Log message so we can see on the server side when we enter this
	logger.info(thisFuncName + 'ENTER org_key=' + org_key);
	
	// The javascript Object was JSON.stringify() on the client end; we need to re-hydrate it with JSON.parse()
	var selectedMembers = JSON.parse(data);
	// 2020-02-12, M.O'C - Adding 'org_key'
	selectedMembers['org_key'] = org_key;
	logger.trace(thisFuncName + 'selectedMembers=' + JSON.stringify(selectedMembers));

	await utilities.insert('scoutingpairs', selectedMembers);

	// TODO: Redo as... teamCol.bulkWrite([{updateMany:{filter:{ "name": {$in: nameList }}, update:{ $set: { "assigned" : "true" } }}}], function(e, docs){
	// Submit to the DB
	var selectedUpdates = [];
	//for (var member in selectedMembers) selectedUpdates.push(member);
	if (selectedMembers.member1)
		selectedUpdates.push(selectedMembers.member1);
	if (selectedMembers.member2)
		selectedUpdates.push(selectedMembers.member2);
	if (selectedMembers.member3)
		selectedUpdates.push(selectedMembers.member3);
	logger.trace(thisFuncName + 'selectedUpdates=' + JSON.stringify(selectedUpdates));

	var query = {'name': {$in: selectedUpdates}};
	var update = {$set: {'event_info.assigned': true}};
	
	await utilities.update('users', query, update, {multi: true, castIds: true});
	
	logger.trace(thisFuncName + 'REDIRECT');
	res.redirect('./');
	
	logger.trace(thisFuncName + 'DONE');
}));

router.post('/deletescoutingpair', wrap(async (req, res) => {
	
	var thisFuncName = 'scoutingpairs.deletescoutingpair[post]: ';
	
	var data = req.body.data;
	var org_key = req.user.org_key;

	// Log message so we can see on the server side when we enter this
	logger.info(thisFuncName + 'ENTER org_key=' + org_key);
		
	// 2020-02-12, M.O'C - Adding "org_key": org_key, 
	var thisPairArray = await utilities.find('scoutingpairs', {'org_key': org_key, '_id': data});
	var thisPair = {};
	if (thisPairArray.length > 0)
		thisPair = thisPairArray[0];

	logger.trace('thisPair=' + JSON.stringify(thisPair));

	var nameList = [];
	if (thisPair.member1)
		nameList.push(thisPair.member1);
	if (thisPair.member2)
		nameList.push(thisPair.member2);
	if (thisPair.member3)
		nameList.push(thisPair.member3);
	logger.trace('nameList=' + JSON.stringify(nameList));

	await utilities.bulkWrite('users', [{updateMany:{filter:{ 'name': {$in: nameList }}, update:{ $set: { 'event_info.assigned' : false } }}}]);

	//teamCol.bulkWrite([{updateMany:{filter:{ "name": {$in: nameList }}, update:{ $set: { "assigned" : "false" } }}}], function(e, docs){
	// 2020-02-12, M.O'C - Adding "org_key": org_key, 
	await utilities.remove('scoutingpairs', {'org_key': org_key, '_id': data});
	//scoutCol.remove({"_id": data}, function(e, docs) {
	logger.trace(thisFuncName + 'REDIRECT');
	res.redirect('./');	
	
	logger.trace(thisFuncName + 'DONE');
}));

router.post('/generateteamallocations', wrap(async (req, res) => {
	
	var thisFuncName = 'scoutingpairs.generateteamallocations[post]: ';

	var passCheckSuccess;
		
	if( !req.body.password || req.body.password == ''){
		
		return res.send({status: 401, alert: 'No password entered.'});
	}

	// Log message so we can see on the server side when we enter this
	logger.info(thisFuncName + 'ENTER');

	var user = await utilities.find('users', { name: req.user.name });

	if(!user[0]){
		res.send({status: 500, alert:'Passport error: no user found in db?'});
		return logger.error('no user found? generateteamallocations');
	}
	
	bcrypt.compare( req.body.password, user[0].password, function(e, out){
		if(e)
			return logger.error(e);
		if(out == true)
			passCheckSuccess = true;
		else
			return res.send({status: 401, alert: 'Password incorrect.'});
		
		if(passCheckSuccess){
			generateTeamAllocations(req, res);
		}
	});
}));	

//////////// Match allocating by batches of matches

router.post('/generatematchallocations2', wrap(async (req, res) => {
	
	var thisFuncName = 'scoutingpairs.generateMATCHallocations2[post]: ';

	// Gap between matches equal to or over this value means a "major" gap (e.g., lunch, overnight, etc.)
	var matchGapBreakThreshold = 30 * 60;  // 30 minutes, in seconds
	// Size of match blocks to be scouted - scouts will do this many matches in a row
	var matchBlockSize = 5;  // default
	logger.trace(thisFuncName + 'req.body.blockSize=' + req.body.blockSize);
	if (req.body.blockSize) {
		matchBlockSize = req.body.blockSize;
		logger.trace(thisFuncName + 'Overriding matchBlockSize to ' + matchBlockSize);
		// remove from req.body before proceeding to pulling out the multi-checkbox list
		req.body.blockSize = null;
	}
	
	var event_key = req.event.key;	
	var org_key = req.user.org_key;

	// Log message so we can see on the server side when we enter this
	logger.info(thisFuncName + 'ENTER org_key=' + org_key + ',matchBlockSize=' + matchBlockSize);

	var availableArray = [];
	logger.trace(thisFuncName + '*** Tagged as available:');
	for(var i in req.body) {
		logger.trace(thisFuncName + i);
		availableArray.push(i);
	}

	// 2019-01-23, M.O'C: See YEARFIX comment above
	var year = parseInt(event_key.substring(0,4));
					
	// Pull 'active team key' from DB
	// TODO make a toggle for this?
	// var thisOrg = await utilities.findOne("orgs", {"org_key": org_key});
	// var activeTeamKey = thisOrg.team_key;
	var activeTeamKey = '';
	
	// { year, event_key, match_key, match_number, alliance, 'match_team_key', assigned_scorer, actual_scorer, scoring_data: {} }

	//
	// Need map of team IDs to scouts (scoutingdata)
	//
	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	var scoutDataArray = await utilities.find('pitscouting', {'org_key': org_key, 'event_key': event_key});
	
	// Build teamID->primary/secondar/tertiary lookup
	var scoutDataByTeam = {};
	var scoutDataLen = scoutDataArray.length;
	for (let i = 0; i < scoutDataLen; i++) {
		scoutDataByTeam[scoutDataArray[i].team_key] = scoutDataArray[i];
		//logger.debug(thisFuncName + "Scout data: For team " + scoutDataArray[i].team_key + ", array is " + JSON.stringify(scoutDataArray[i]));
	}

	//
	// Read all assigned OR tagged members, ordered by 'seniority' ~ have an array ordered by seniority
	//
	// - matchscouts is the "queue"; need a pointer to indicate where we are
	var matchScouts = await utilities.find('users', {$or: [{'name': {$in: availableArray}}, {'event_info.assigned': true}]}, { sort: {'seniority': 1, 'subteam': 1, 'name': 1} });
	var matchScoutsLen = matchScouts.length;
	logger.trace(thisFuncName + '*** Assigned + available, by seniority:');
	for (let i = 0; i < matchScoutsLen; i++)
		logger.trace(thisFuncName + 'member['+i+'] = ' + matchScouts[i].name);

	// who is "first" in line in the 'queue'
	var nextMatchScout = 0;

	//
	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	//
	var timestampArray = await utilities.find('matches', { event_key: event_key, 'alliances.red.score': -1 },{sort: {'time': 1}});

	// Avoid crashing server if all matches at an event are done
	var earliestTimestamp = 9999999999;
	if (timestampArray && timestampArray[0]) {
		var earliestMatch = timestampArray[0];
		earliestTimestamp = earliestMatch.time;
	}

	// Clear 'assigned_scorer', 'data' from all unresolved team@matches ('data' is just in case)
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	await utilities.bulkWrite('matchscouting', [{updateMany:{filter:{ 'org_key': org_key, 'event_key': event_key, 'time': { $gte: earliestTimestamp } }, update:{ $unset: { 'assigned_scorer' : '', 'data': '' } }}}]);

	// Get list of matches from latest unresolved onward
	var comingMatches = await utilities.find('matches', {'event_key': event_key, 'time': { $gte: earliestTimestamp }}, { sort: {'time': 1}});
	var lastMatchTimestamp = earliestTimestamp;
	
	var matchBlockCounter = matchBlockSize;  // initialize at the max size so in the first loop iteration, it'll set up the scout list
	var scoutPointer = 0;  // start off with the 0th position
	var scoutArray = [];  // the current set of scouts (gets regenerated every N matches)
	var scoutAvailableMap = {};  // pool of available scouts
	
	var redBlueToggle = 0;  // flips between 0 and 1, signals whether to allocate red alliance or blue alliance first
	
	for (var matchesIdx = 0; matchesIdx < comingMatches.length; matchesIdx++) {
		var thisMatchKey = comingMatches[matchesIdx].key;
		
		var teamScoutMap = {};  // map of team->scout associations; reset for each match
		
		// Work in sets of up to 5 matches {could be less than 5, if "break" or end is hit}
		if (matchBlockCounter >= matchBlockSize) {
			// Pull off the next 6 scouts
			scoutArray = [];
			for (let i = 0; i < 6; i++) {
				scoutArray.push(matchScouts[scoutPointer].name);
				scoutPointer++;
				if (scoutPointer >= matchScoutsLen)
					scoutPointer = 0;
			}
			logger.trace(thisFuncName + 'Updated current scouts: ' + JSON.stringify(scoutArray));
			
			matchBlockCounter = 0;
		}
		matchBlockCounter++;
		
		// reset the scout available map
		scoutAvailableMap = {};
		for (let i = 0; i < 6; i++)
			scoutAvailableMap[scoutArray[i]] = scoutArray[i];
		
		
		var matchGap = comingMatches[matchesIdx].time - lastMatchTimestamp;
		// Iterate until a "break" is found (or otherwise, if the loop is exhausted)
		if (matchGap > matchGapBreakThreshold) {
			logger.trace(thisFuncName + 'matchGap=' + matchGap + '... found a break');
			break;
		}
		
		//logger.debug(thisFuncName + "comingMatch[" + matchesIdx + "]: matchGap=" + (matchGap) + ", redteams=" + JSON.stringify(comingMatches[matchesIdx].alliances.red.team_keys) + ", blueteams=" + JSON.stringify(comingMatches[matchesIdx].alliances.blue.team_keys));
		var teamArray = [];
		var teamScoutMatchMap = {};
		if (redBlueToggle == 0)
			for (let i = 0; i < 3; i++) {
				teamArray.push(comingMatches[matchesIdx].alliances.red.team_keys[i]);
				teamArray.push(comingMatches[matchesIdx].alliances.blue.team_keys[i]);
			}
		else
			for (let i = 0; i < 3; i++) {
				teamArray.push(comingMatches[matchesIdx].alliances.blue.team_keys[i]);
				teamArray.push(comingMatches[matchesIdx].alliances.red.team_keys[i]);
			}
		logger.trace(thisFuncName + 'comingMatch[' + matchesIdx + ']: matchGap=' + (matchGap) + ', teamArray=' + JSON.stringify(teamArray));
		
		// -- In each match, assign 6 scouts to 6 teams in 'scoringdata'
		// *** PUZZLE: How to do team preferential assignment?
		// * Cycle through - attempt to assign teams to primary (if not yet assigned) ~ pseudorandom? sort { time: 1, _id: 1 }
		// * Cycle through remaining teams - assigning remaining scouts
		// --- Update scoringdata, set assigned_scorer where team_key, match_key, etc.

		// Go through assigning primaries first, then secondaries, then tertiaries
		var roleArray = [ 'primary', 'secondary', 'tertiary' ];
		for (var roleIdx = 0; roleIdx < roleArray.length; roleIdx++) {
			// Which role (primary? secondary? tertiary?) are we checking
			var thisRole = roleArray[roleIdx];

			// Cycle through teams
			for (let i = 0; i < 6; i++) {
				var thisTeamKey = teamArray[i];
				// Assigned yet? If not...
				if (teamScoutMap[thisTeamKey] == null) {
					// Who is assigned to this team?
					var thisScoutData = scoutDataByTeam[thisTeamKey];
					if (thisScoutData) {
						var thisPossibleAssignee = thisScoutData[thisRole];
						//console.log(thisFuncName + ">> Comparing: " + thisTeamKey + ", for role " + thisRole + " is " + thisPossibleAssignee);
						
						// Are they available?
						if (thisPossibleAssignee != null && scoutAvailableMap[thisPossibleAssignee] != null) {
							// Assign them!
							//console.log(thisFuncName + "** Assigning " + thisPossibleAssignee + " to " + thisTeamKey);
							teamScoutMap[thisTeamKey] = thisPossibleAssignee;
							// Take assignee out of available
							delete scoutAvailableMap[thisPossibleAssignee];
						}
					}
				}
			}
		}
		
		// fill in the rest
		var leftoverScouts = [];
		for (var property in scoutAvailableMap)
			if (scoutAvailableMap.hasOwnProperty(property))
				leftoverScouts.push(scoutAvailableMap[property]);
		//logger.debug(thisFuncName + "leftover scouts are " + JSON.stringify(leftoverScouts));

		// cycle through teams, find the ones without assignees
		var leftoverPointer = 0;
		for (let i = 0; i < 6; i++) {
			let thisTeamKey = teamArray[i];
			// Assigned yet? If not...
			if (teamScoutMap[thisTeamKey] == null) {
				// Grab the next available scout & increment the pointer
				teamScoutMap[thisTeamKey] = leftoverScouts[leftoverPointer];
				leftoverPointer++;
			}
		}

		// show all the team-scout assignments
		var assignmentPromisesArray = [];
		for (let property in teamScoutMap) {
			if (teamScoutMap.hasOwnProperty(property)) {
				// Write the assignment to the DB!
				var thisMatchTeamKey = thisMatchKey + '_' + property;
				var thisScout = teamScoutMap[property];

				// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
				var thisPromise = utilities.update('matchscouting', { 'org_key': org_key, 'match_team_key' : thisMatchTeamKey }, { $set: { 'assigned_scorer' : thisScout }} );
				assignmentPromisesArray.push(thisPromise);
			}
		}									
		// wait for all the updates to finish
		Promise.all(assignmentPromisesArray);
		
		// update the 'lastMatchTimestamp' so we can track until a break
		lastMatchTimestamp = comingMatches[matchesIdx].time;
	}

	// all done, go to the matches list
	res.redirect('/dashboard/matches');
}));

router.post('/clearmatchallocations', wrap(async (req, res) => {
	
	var thisFuncName = 'scoutingpairs.clearmatchallocations[post]: ';
	logger.info(thisFuncName + 'ENTER');

	var passCheckSuccess;
	
	if( !req.body.password || req.body.password == ''){
		return res.send({status: 401, alert: 'No password entered.'});
	}
	
	var user = await utilities.find('users', { name: req.user.name }, {});

	if(!user[0]){
		res.send({status: 500, alert:'Passport error: no user found in db?'});
		return console.error('no user found? clearmatchallocations');
	}
		
	bcrypt.compare( req.body.password, user[0].password, async function(e, out){
		if(e)
			return console.error(e);
		if(out == true)
			passCheckSuccess = true;
		else
			return res.send({status: 401, alert: 'Password incorrect.'});
		
		if(passCheckSuccess){
			/* Begin regular code ----------------------------------------------------------- */
	
			var thisFuncName = 'scoutingpairs.clearMATCHallocations[post]: ';
			var org_key = req.user.org_key;

			// Log message so we can see on the server side when we enter this
			logger.info(thisFuncName + 'ENTER');
	
			var event_key = req.event.key;

			// 2019-01-23, M.O'C: See YEARFIX comment above
			var year = parseInt(event_key.substring(0,4));
	
			//
			// Remove 'assigned_scorer' from all matching scoringdata elements
			//
			// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
			await utilities.bulkWrite('matchscouting', [{updateMany:{filter:{ 'org_key': org_key, 'event_key': event_key }, update:{ $unset: { 'assigned_scorer' : '' } }}}]);

			return res.send({status: 200, alert: 'Cleared existing match scouting assignments successfully.'});
		
			/* End regular code ----------------------------------------------------------- */
		}
	});
}));

//////////// Match allocating by team assignment

router.post('/generatematchallocations', wrap(async (req, res) => {
	
	var thisFuncName = 'scoutingpairs.generatematchallocations[post]: ';
	logger.info(thisFuncName + 'ENTER');

	var passCheckSuccess;
	
	if( !req.body.password || req.body.password == ''){
		return res.send({status: 401, alert: 'No password entered.'});
	}
	
	var user = await utilities.find('users', { name: req.user.name }, {});

	if(!user[0]){
		res.send({status: 500, alert:'Passport error: no user found in db?'});
		return logger.error('no user found? generatematchallocations');
	}
	
	bcrypt.compare( req.body.password, user[0].password, function(e, out){
		if(e)
			return logger.error(e);
		if(out == true)
			passCheckSuccess = true;
		else
			return res.send({status: 401, alert: 'Password incorrect.'});
		
		if(passCheckSuccess){
			generateMatchAllocations(req, res);
		}
	});
}));

router.get('/swapmembers', wrap(async (req, res) => {
	
	var thisFuncName = 'scoutingpairs.swapmembers[get]: ';
	
	// for later querying by event_key
	var eventKey = req.event.key;
	var org_key = req.user.org_key;

	// Log message so we can see on the server side when we enter this
	logger.info(thisFuncName + 'ENTER eventKey=' + eventKey + ',org_key=' + org_key);

	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	var matchDocs = await utilities.find('matches', { event_key: eventKey, 'alliances.red.score': -1 },{sort: {'time': 1}});

	// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
	var earliestTimestamp = 9999999999;
	if (matchDocs && matchDocs[0]) {
		var earliestMatch = matchDocs[0];
		earliestTimestamp = earliestMatch.time;
	}
		
	// Get the distinct list of scorers from the unresolved matches
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	var scorers = await utilities.distinct('matchscouting', 'assigned_scorer', {'org_key': org_key, 'event_key': eventKey, 'time': { $gte: earliestTimestamp }});
	console.log(thisFuncName + 'distinct assigned_scorers: ' + JSON.stringify(scorers));

	// Get list of all users for this org
	var users = await utilities.find('users', {org_key: org_key}, {sort:{ 'name': 1 }});

	// Go to a Pug to show two lists & a button to do the swap - form with button
	res.render('./manage/swapmembers', {
		title: 'Swap Match Scouts',
		scorers: scorers,
		users: users
	});
}));

router.post('/swapmembers', wrap(async (req, res) => {
	
	var thisFuncName = 'scoutingpairs.swapmembers[post]: ';
	
	// for later querying by event_key
	var eventKey = req.event.key;
	var org_key = req.user.org_key;

	// Log message so we can see on the server side when we enter this
	logger.info(thisFuncName + 'ENTER org_key=' + org_key);
	
	// Extract 'from' & 'to' from req
	var swapout = req.body.swapout;
	var swapin = req.body.swapin;
	logger.info(thisFuncName + 'swap out ' + swapin + ', swap in ' + swapout);

	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	var matchDocs = await utilities.find('matches', { event_key: eventKey, 'alliances.red.score': -1 },{sort: {'time': 1}});
	// matchCol.find({ event_key: eventKey, "alliances.red.score": -1 },{sort: {"time": 1}}, function(e, docs){

	// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
	var earliestTimestamp = 9999999999;
	if (matchDocs && matchDocs[0]) {
		var earliestMatch = matchDocs[0];
		earliestTimestamp = earliestMatch.time;
	}
		
	// Do the updateMany - change instances of swapout to swapin
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	await utilities.bulkWrite('matchscouting', [{updateMany:{filter: { assigned_scorer: swapout, org_key: org_key, event_key: eventKey, 'time': { $gte: earliestTimestamp } }, 
		update:{ $set: { assigned_scorer: swapin } }}}]);

	res.redirect('/dashboard/matches');
}));

async function generateMatchAllocations(req, res){
	/* Begin regular code ----------------------------------------------------------- */
	
	var thisFuncName = 'scoutingpairs.generateMATCHallocations[post]: ';

	// Log message so we can see on the server side when we enter this
	logger.info(thisFuncName + 'ENTER');
	
	var event_key = req.event.key;
	var org_key = req.user.org_key;

	// 2019-01-23, M.O'C: See YEARFIX comment above
	var year = parseInt(event_key.substring(0,4));
	
	// { year, event_key, match_key, match_number, alliance, 'match_team_key', assigned_scorer, actual_scorer, scoring_data: {} }
	
	// Need: Map, teamID->primary/secondar/tertiary
	// Read all matches
	// For each match:
	// Go through the teams, build data elements without assignees
	// Try to allocate primaries (track assigned members in a map - can't assign someone twice!)
	// Repeat again if blanks left over with secondaries
	// Repeat again if blanks left over with tertiaries
	// Add batch to collecting array for eventual DB mass insert
	
	logger.debug(thisFuncName + 'Requesting scoutingdata and matches');
	
	// Need map of team IDs to scouts (scoutingdata)
	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	var scoutDataArrayPromise = utilities.find('pitscouting', {'org_key': org_key, 'event_key': event_key});
	// 2019-06-19 JL: Changing TBA request to DB request for matches, for off-season events.
	var matchesPromise = utilities.find('matches', {'event_key': event_key, 'comp_level': 'qm'}, { sort: {'time': 1}} );
	
	// Pull 'active team key' from DB
	// TODO make a toggle
	// var thisOrg = await utilities.findOne("orgs", {"org_key": org_key});
	// var activeTeamKey = thisOrg.team_key;
	var activeTeamKey = '';
		
	logger.debug(thisFuncName + 'Awaiting DB promises');
	
	var scoutDataArray = await scoutDataArrayPromise;
	var matchArray = await matchesPromise;
	
	// Build teamID->primary/secondar/tertiary lookup
	var scoutDataByTeam = {};
	var scoutDataLen = scoutDataArray.length;
	for (let i = 0; i < scoutDataLen; i++){
		scoutDataByTeam[scoutDataArray[i].team_key] = scoutDataArray[i];
	}
	
	// Build up the scoringdata array
	var scoringDataArray = [];
	// Loop through each match
	var matchLen = matchArray.length;
	
	for (var matchIdx = 0; matchIdx < matchLen; matchIdx++) {
		var thisMatch = matchArray[matchIdx];
		//logger.debug(thisFuncName + "*** thisMatch=" + thisMatch.key);
		
		// Build unassigned match-team data elements
		var thisMatchDataArray = [];
		
		// { year, event_key, match_key, match_number, alliance, team_key, 'match_team_key', assigned_scorer, actual_scorer, scoring_data: {} }
		var allianceArray = [ 'red', 'blue' ];
		for (var allianceIdx = 0; allianceIdx < allianceArray.length; allianceIdx++) {
			// teams are indexed 0, 1, 2
			for (var teamIdx = 0; teamIdx < 3; teamIdx++) {
				var thisScoreData = {};
				
				thisScoreData['year'] = year;
				thisScoreData['event_key'] = event_key;
				thisScoreData['org_key'] = org_key;
				thisScoreData['match_key'] = thisMatch.key;
				thisScoreData['match_number'] = thisMatch.match_number;
				// time is the best 'chronological order' sort field
				thisScoreData['time'] = thisMatch.time;
				
				thisScoreData['alliance'] = allianceArray[allianceIdx];
				thisScoreData['team_key'] = thisMatch.alliances[allianceArray[allianceIdx]].team_keys[teamIdx];
				thisScoreData['match_team_key'] = thisMatch.key + '_' + thisScoreData['team_key'];

				//logger.debug(thisFuncName + "thisScoreData=" + JSON.stringify(thisScoreData));
				
				thisMatchDataArray.push(thisScoreData);
			}
		}
		var thisMatchLen = thisMatchDataArray.length;
		//logger.debug(thisFuncName + "thisMatchDataArray=" + JSON.stringify(thisMatchDataArray));
		
		// Keep track of who we've assigned - can't assign someone twice!
		var assignedMembers = {};
		// Go through assigning primaries first, then secondaries, then tertiaries
		var roleArray = [ 'primary', 'secondary', 'tertiary' ];
		for (var roleIdx = 0; roleIdx < roleArray.length; roleIdx++) {
			// Which role (primary? secondary? tertiary?) are we checking
			var thisRole = roleArray[roleIdx];
			// Cycle through the scoring data, looking for blank assignees
			for (var thisMatchIdx = 0; thisMatchIdx < thisMatchLen; thisMatchIdx++) {
				let thisScoreData = thisMatchDataArray[thisMatchIdx];
				//logger.debug(thisFuncName + "thisScoreData=" + thisScoreData);
				// Not yet assigned?
				if( !(thisScoreData.assigned_scorer) ){
					// Which team is this?
					var thisTeamKey = thisScoreData.team_key;
					//logger.debug(thisFuncName + 'thisTeamKey=' + thisTeamKey);
					
					// 2018-03-15, M.O'C: Skip assigning if this teams is the "active" team (currently hardcoding to 'frc102')
					if( activeTeamKey && activeTeamKey != thisTeamKey ){
						
						logger.trace(thisFuncName + 'scoutDataByTeam[thisTeamKey]:' + JSON.stringify(scoutDataByTeam[thisTeamKey]));
						
						// Who is assigned to this team?
						var thisScoutData = scoutDataByTeam[thisTeamKey];
						var thisPossibleAssignee = {};
						if (thisScoutData)
							thisPossibleAssignee = thisScoutData[thisRole];
						// Only check if this role is defined for this team
						if (thisPossibleAssignee) {
							// Only proceed if this person is not yet assigned elsewhere
							if (!assignedMembers[thisPossibleAssignee]) {
								// Good to assign!
								//logger.debug(thisFuncName + "~~~~ thisPossibleAssignee=" + JSON.stringify(thisPossibleAssignee));
								thisMatchDataArray[thisMatchIdx].assigned_scorer = thisPossibleAssignee;
								// Mark them as assigned to a team
								assignedMembers[thisPossibleAssignee] = thisPossibleAssignee;
							}
						}
					}
				}
			}
		}
		
		logger.trace(thisFuncName + '*** thisMatch=' + thisMatch.key);
		for (var thisMatchDataIdx = 0; thisMatchDataIdx < thisMatchLen; thisMatchDataIdx++) {
			logger.trace(thisFuncName + 'team,assigned=' + thisMatchDataArray[thisMatchDataIdx].team_key + ' ~> ' + thisMatchDataArray[thisMatchDataIdx].assigned_scorer);
			// add to the overall array of match assignments
			scoringDataArray.push(thisMatchDataArray[thisMatchDataIdx]);
		}
	}
	
	logger.trace(thisFuncName + 'Removing old scoreData elements');
	// Delete ALL the old elements first for the 'current' event
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	await utilities.remove('matchscouting', {'org_key': org_key, 'event_key': event_key});
	
	logger.trace(thisFuncName + 'Inserting new scoreData elements');
	// Insert the new data - w00t!
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	await utilities.insert('matchscouting', scoringDataArray);
	
	logger.info(thisFuncName + 'EXIT');
	// Done!
	res.send({status: 200, alert: 'Generated team allocations successfully.'});
	
	//All code below is legacy.
	return;
}

//SEPARATE FUNCTION FOR GENERATETEAMALLOCATIONS
async function generateTeamAllocations(req, res){
	/* Begin regular code ----------------------------------------------------------- */	
	
	var thisFuncName = 'scoutingpairs.generateTEAMallocations[post]: ';

	// Log message so we can see on the server side when we enter this
	logger.info(thisFuncName + 'ENTER');
	
	var event_key = req.event.key;
	var year = req.event.year;
	var org_key = req.user.org_key;
	
	// Pull 'active team key' from DB
	var thisOrg = await utilities.findOne('orgs', {'org_key': org_key});
	var activeTeamKey = thisOrg.team_key;
		
	//
	// Get the current set of already-assigned pairs; make a map of {"id": {"prim", "seco", "tert"}}
	//
	// 2020-02-12, M.O'C - Adding "org_key": org_key, 
	var scoutingpairs = await utilities.find('scoutingpairs', {'org_key': org_key});

	// Iterate through scoutingpairs; create {1st: 2nd: 3rd:} and add to 'dict' keying off 1st <1, or 1/2 2/1, or 1/2/3 2/3/1 3/1/2>
	var primaryAndBackupMap = {};
	var scoutingAssignedArray = [];
	
	var pairsLen = scoutingpairs.length;
	for (let i = 0; i < pairsLen; i++) {
		var thisPair = scoutingpairs[i];
		if (thisPair.member3) {
			let set1 = {}; set1.primary = thisPair.member1; set1.secondary = thisPair.member2; set1.tertiary = thisPair.member3; primaryAndBackupMap[set1.primary] = set1;
			scoutingAssignedArray.push(set1.primary);
			let set2 = {}; set2.primary = thisPair.member2; set2.secondary = thisPair.member3; set2.tertiary = thisPair.member1; primaryAndBackupMap[set2.primary] = set2;
			scoutingAssignedArray.push(set2.primary);
			let set3 = {}; set3.primary = thisPair.member3; set3.secondary = thisPair.member1; set3.tertiary = thisPair.member2; primaryAndBackupMap[set3.primary] = set3;
			scoutingAssignedArray.push(set3.primary);
		}
		else if (thisPair.member2) {
			let set1 = {}; set1.primary = thisPair.member1; set1.secondary = thisPair.member2; primaryAndBackupMap[set1.primary] = set1;
			scoutingAssignedArray.push(set1.primary);
			let set2 = {}; set2.primary = thisPair.member2; set2.secondary = thisPair.member1; primaryAndBackupMap[set2.primary] = set2;
			scoutingAssignedArray.push(set2.primary);
		}
		else {
			let set1 = {}; set1.primary = thisPair.member1; primaryAndBackupMap[set1.primary] = set1;
			scoutingAssignedArray.push(set1.primary);
		}
	}
	//logger.debug(thisFuncName + "primaryAndBackupMap=" + JSON.stringify(primaryAndBackupMap));

	//
	// Read all present members, ordered by 'seniority' ~ have an array ordered by seniority
	//
	var teammembers = await utilities.find('users', { 'name': {$in: scoutingAssignedArray }}, { sort: {'seniority': 1, 'subteam': 1, 'name': 1} });
	var teammembersLen = teammembers.length;

	// 2020-02-09, M.O'C: Switch from "currentteams" to using the list of keys in the current event
	var thisEventData = await utilities.find('events', {'key': event_key});
	var thisEvent = thisEventData[0];
	var teamArray = [];
	if (thisEvent && thisEvent.team_keys && thisEvent.team_keys.length > 0) {
		logger.trace(thisFuncName + 'thisEvent.team_keys=' + JSON.stringify(thisEvent.team_keys));
		teamArray = await utilities.find('teams', {'key': {$in: thisEvent.team_keys}}, {sort: {team_number: 1}});
	}
	
	// currentTeamsCol.find({},{}, function(e, teamArray){
		
	// 	//
	// 	// Cycle through teams, adding 1st 2nd 3rd to each based on array of 1st2nd3rds
	// 	//
	var teamArrayLen = teamArray.length;
	var teamassignments = [];
	var teamassignmentsByTeam = {};
	var assigneePointer = 0;
	for (let i = 0; i < teamArrayLen; i++) {
		var thisTbaTeam = teamArray[i];
		var thisTeammemberName = teammembers[assigneePointer].name;
		var thisPrimaryAndBackup = primaryAndBackupMap[thisTeammemberName];
		/*
		logger.debug(thisFuncName + "i=" + i + "; assigneePointer=" + assigneePointer);
		logger.debug(thisFuncName + "thisTbaTeam=" + JSON.stringify(thisTbaTeam));
		logger.debug(thisFuncName + "thisTeammemberName=" + thisTeammemberName);
		logger.debug(thisFuncName + "thisPrimaryAndBackup=" + JSON.stringify(thisPrimaryAndBackup));
		*/
		
		// { year, event_key, team_key, primary, secondary, tertiary, actual, scouting_data: {} }
		var thisAssignment = {};
		// general info
		thisAssignment['year'] = year;
		thisAssignment['event_key'] = event_key;
		thisAssignment['org_key'] = org_key;
		// unique per team
		thisAssignment['team_key'] = thisTbaTeam.key;
		
		// 2018-03-15, M.O'C: Skip assigning if this teams is the "active" team (currently hardcoding to 'frc102')
		if ((activeTeamKey && activeTeamKey != thisTbaTeam.key) || !activeTeamKey) {						
			thisAssignment['primary'] = thisPrimaryAndBackup.primary;
			if (thisPrimaryAndBackup.secondary)
				thisAssignment['secondary'] = thisPrimaryAndBackup.secondary;
			if (thisPrimaryAndBackup.tertiary)
				thisAssignment['tertiary'] = thisPrimaryAndBackup.tertiary;
			
			assigneePointer += 1;
			if (assigneePointer >= teammembersLen)
				assigneePointer = 0;
		}
		else {
			logger.trace(thisFuncName + 'Skipping team ' + thisTbaTeam.key);
		}
			
		
		// Array for mass insert
		teamassignments.push(thisAssignment);
		// Map of assignments by team so we can lookup by team later during match assigning
		teamassignmentsByTeam[thisTbaTeam.key] = thisAssignment;
	}
	logger.trace(thisFuncName + '****** New/updated teamassignments:');
	for (let i = 0; i < teamArrayLen; i++)
		logger.trace(thisFuncName + 'team,primary,secondary,tertiary=' + teamassignments[i].team_key + ' ~> ' + teamassignments[i].primary + ',' + teamassignments[i].secondary + ','  + teamassignments[i].tertiary);
	
	// Delete ALL the old elements first for the 'current' event
	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	await utilities.remove('pitscouting', {'org_key': org_key, 'event_key': event_key});
	// scoutDataCol.remove({"event_key": event_key}, function(e, docs) {
	// 	// Insert the new data
	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	await utilities.insert('pitscouting', teamassignments);
	// scoutDataCol.insert(teamassignments, function(e, docs) {
	// 	//res.redirect("./");	
	return res.send({status: 200, alert: 'Generated team allocations successfully.'});

/* End regular code ----------------------------------------------------------- */
}

module.exports = router;
