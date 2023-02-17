import express from 'express';
import bcrypt from 'bcryptjs';
import { getLogger } from 'log4js';
import wrap from '../../helpers/express-async-handler';
import utilities from 'scoutradioz-utilities';
import Permissions from '../../helpers/permissions';
import e from 'scoutradioz-http-errors';
import type { Match, MatchScouting, OrgSubteam, PitScouting, ScoutingPair, Team, TeamKey} from 'scoutradioz-types';

const router = express.Router();
const logger = getLogger('scoutingpairs');

router.all('/*', wrap(async (req, res, next) => {
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate(Permissions.ACCESS_TEAM_ADMIN)) {
		next();
	}
}));

/**
 * Admin page to control and assign pairs of students for scouting.
 * @url /manage/scoutingpairs/
 * @views /manage/scoutingpairs
 */
router.get('/', wrap(async (req, res) => {
	return res.send('dead');
	
	const thisFuncName = 'scoutingpairs.scoutingpairs(root): ';
	const thisUser = req._user;
	const startTime = Date.now();
	const org_key = thisUser.org_key;
	const event_key = req.event.key;
	
	//Log message so we can see on the server side when we enter this
	logger.info(thisFuncName + 'ENTER org_key=' + org_key);
	logger.debug(thisFuncName + 'Requesting all members from db');
	
	if (!thisUser.org.config.members.subteams) throw new e.InternalServerError(`Could not get list of subteams from org config: ${org_key}`);
	const subteams = thisUser.org.config.members.subteams;
	
	let pitScoutSubteams: OrgSubteam[] = []; // for use in the view
	let pitScoutSubteamKeys: string[] = []; // for use in the db query
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
				{
					'org_info.subteam_key': key, 'event_info.present': true, 'event_info.assigned': false, 
					org_key: org_key, visible: true,
				}, 
				{sort: {'name': 1}}
			)
		);
	}
	// Find the number of pit & match assignments WITH data
	dbPromises.push(utilities.find('matchscouting', {org_key: org_key, event_key: event_key, data: {$ne: undefined}}));
	dbPromises.push(utilities.find('pitscouting', {org_key: org_key, event_key: event_key, data: {$ne: undefined}}));
	
	//Any team members that are not on a subteam, but are unassigned and present.
	dbPromises.push(utilities.find('users', 
		{'event_info.assigned': false, 'event_info.present': true, org_key: org_key, visible: true}, 
		{sort: {'name': 1}}
	));
	
	logger.debug(thisFuncName + 'Requesting scouting pairs from db');
	
	//Get all already-assigned pairs
	// 2020-02-12, M.O'C - Adding "org_key": org_key, 
	dbPromises.push( utilities.find('scoutingpairs', {'org_key': org_key}) );
	
	logger.trace(thisFuncName + 'Awaiting all db requests');
	
	let preAwaitTime = Date.now() - startTime;
	
	//Await every promise in parallel.
	Promise.all(dbPromises)
		.then(values => {
			// Get the resulting values from the array returned by Promise.all.
			for (let i = 0; i < pitScoutSubteams.length; i++) {
				// the values array will be ordered the same as pitScoutSubteams & pitScoutSubteamKeys
				// @ts-ignore TODO
				pitScoutSubteams[i].members = values[i]; 
			}
			let matchScoutingCount = values[values.length - 4].length; // fourth to last
			let pitScoutingCount = values[values.length - 3].length;	// third to last
			let available = values[values.length - 2]; 					// second to last
			let assigned = values[values.length - 1]; 					// last
		
			let postAwaitTime = Date.now() - startTime - preAwaitTime;
			logger.trace(`preAwaitTime: ${preAwaitTime}ms, postAwaitTime: ${postAwaitTime}ms`);
		
			logger.trace(thisFuncName + 'Rendering');
		
			res.render('./manage/scoutingpairs', {
				title: 'Scouting Assignments',
				subteams: pitScoutSubteams,
				assigned: assigned,
				available: available,
				matchScoutingCount: matchScoutingCount,
				pitScoutingCount: pitScoutingCount
			});
		});
}));

//////////// Match allocating by batches of matches

router.post('/generatematchallocations2', wrap(async (req, res) => {
	
	let thisFuncName = 'scoutingpairs.generateMATCHallocations2[post]: ';

	// Gap between matches equal to or over this value means a "major" gap (e.g., lunch, overnight, etc.)
	let matchGapBreakThreshold = 30 * 60;  // 30 minutes, in seconds
	// Size of match blocks to be scouted - scouts will do this many matches in a row
	let matchBlockSize = 5;  // default
	logger.trace(thisFuncName + 'req.body.blockSize=' + req.body.blockSize);
	if (req.body.blockSize) {
		matchBlockSize = req.body.blockSize;
		logger.trace(thisFuncName + 'Overriding matchBlockSize to ' + matchBlockSize);
		// remove from req.body before proceeding to pulling out the multi-checkbox list
		req.body.blockSize = null;
	}
	
	let event_key = req.event.key;	
	let org_key = req._user.org_key;

	// Log message so we can see on the server side when we enter this
	logger.info(thisFuncName + 'ENTER org_key=' + org_key + ',matchBlockSize=' + matchBlockSize);

	let availableArray = [];
	logger.trace(thisFuncName + '*** Tagged as available:');
	for(let i in req.body) {
		if (i == 'blockSize') {
			logger.trace(thisFuncName + 'skipping \'blocksize\'');
		}
		else {
			logger.trace(thisFuncName + i);
			availableArray.push(i);
		}
	}

	// 2019-01-23, M.O'C: See YEARFIX comment above
	let year = parseInt(event_key.substring(0,4));
					
	// Pull 'active team key' from DB
	// TODO make a toggle for this?
	// var thisOrg = await utilities.findOne("orgs", {"org_key": org_key});
	// var activeTeamKey = thisOrg.team_key;
	let activeTeamKey = '';
	
	// { year, event_key, match_key, match_number, alliance, 'match_team_key', assigned_scorer, actual_scorer, scoring_data: {} }

	//
	// Need map of team IDs to scouts (scoutingdata)
	//
	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	let scoutDataArray: PitScouting[] = await utilities.find('pitscouting', {'org_key': org_key, 'event_key': event_key});
	
	// Build teamID->primary/secondar/tertiary lookup
	let scoutDataByTeam: Dict<PitScouting> = {};
	let scoutDataLen = scoutDataArray.length;
	for (let i = 0; i < scoutDataLen; i++) {
		scoutDataByTeam[scoutDataArray[i].team_key] = scoutDataArray[i];
		//logger.debug(thisFuncName + "Scout data: For team " + scoutDataArray[i].team_key + ", array is " + JSON.stringify(scoutDataArray[i]));
	}

	//
	// Read all assigned OR tagged members, ordered by 'seniority' ~ have an array ordered by seniority
	//
	// - matchscouts is the "queue"; need a pointer to indicate where we are
	// TODO: Use _id, not name, because names can be modified!
	// 2022-03-01, M.O'C: Adding 'org_key': org_key into the 2nd part of the "or" clause
	let matchScouts = await utilities.find('users', {$or: [{'name': {$in: availableArray}, 'org_key': org_key}, {'event_info.assigned': true, 'org_key': org_key}]}, { sort: {'org_info.seniority': 1, 'org_info.subteam_key': 1, 'name': 1} });
	let matchScoutsLen = matchScouts.length;
	logger.trace(thisFuncName + '*** Assigned + available, by seniority:');
	for (let i = 0; i < matchScoutsLen; i++)
		logger.trace(thisFuncName + 'member['+i+'] = ' + matchScouts[i].name);

	// who is "first" in line in the 'queue'
	let nextMatchScout = 0;

	//
	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	//
	let timestampArray = await utilities.find('matches', { event_key: event_key, 'alliances.red.score': -1 },{sort: {'time': 1}});

	// Avoid crashing server if all matches at an event are done
	let earliestTimestamp = 9999999999;
	if (timestampArray && timestampArray[0]) {
		let earliestMatch = timestampArray[0];
		earliestTimestamp = earliestMatch.time;
	}

	// Clear 'assigned_scorer', 'data' from all unresolved team@matches ('data' is just in case)
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	await utilities.bulkWrite('matchscouting', [{updateMany:{filter:{ 'org_key': org_key, 'event_key': event_key, 'time': { $gte: earliestTimestamp } }, update:{ $unset: { 'assigned_scorer' : '', 'data': '' } }}}]);

	// Get list of matches from latest unresolved onward
	let comingMatches = await utilities.find('matches', {'event_key': event_key, 'time': { $gte: earliestTimestamp }}, { sort: {'time': 1}});
	let lastMatchTimestamp = earliestTimestamp;
	
	let matchBlockCounter = matchBlockSize;  // initialize at the max size so in the first loop iteration, it'll set up the scout list
	let scoutPointer = 0;  // start off with the 0th position
	let scoutArray: string[] = [];  // the current set of scouts (gets regenerated every N matches)
	let scoutAvailableMap: StringDict = {};  // pool of available scouts
	
	let redBlueToggle = 0;  // flips between 0 and 1, signals whether to allocate red alliance or blue alliance first
	
	for (let matchesIdx = 0; matchesIdx < comingMatches.length; matchesIdx++) {
		let thisMatchKey = comingMatches[matchesIdx].key;
		
		let teamScoutMap: Dict<PitScouting> = {};  // map of team->scout associations; reset for each match
		
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
		logger.trace(thisFuncName + 'scoutAvailablemap: ' + JSON.stringify(scoutAvailableMap));
		
		let matchGap = comingMatches[matchesIdx].time - lastMatchTimestamp;
		// Iterate until a "break" is found (or otherwise, if the loop is exhausted)
		if (matchGap > matchGapBreakThreshold) {
			logger.trace(thisFuncName + 'matchGap=' + matchGap + '... found a break');
			break;
		}
		
		//logger.debug(thisFuncName + "comingMatch[" + matchesIdx + "]: matchGap=" + (matchGap) + ", redteams=" + JSON.stringify(comingMatches[matchesIdx].alliances.red.team_keys) + ", blueteams=" + JSON.stringify(comingMatches[matchesIdx].alliances.blue.team_keys));
		let teamArray: TeamKey[] = [];
		let teamScoutMatchMap = {};
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
		let roleArray = [ 'primary', 'secondary', 'tertiary' ];
		for (let roleIdx = 0; roleIdx < roleArray.length; roleIdx++) {
			// Which role (primary? secondary? tertiary?) are we checking
			let thisRole = roleArray[roleIdx];

			// Cycle through teams
			for (let i = 0; i < 6; i++) {
				let thisTeamKey = teamArray[i];
				// Assigned yet? If not...
				if (teamScoutMap[thisTeamKey] == null) {
					// Who is assigned to this team?
					let thisScoutData = scoutDataByTeam[thisTeamKey];
					if (thisScoutData) {
						// @ts-ignore
						let thisPossibleAssignee: PitScouting = thisScoutData[thisRole];
						//console.log(thisFuncName + ">> Comparing: " + thisTeamKey + ", for role " + thisRole + " is " + thisPossibleAssignee);
						
						// Are they available?
						// @ts-ignore
						if (thisPossibleAssignee != null && scoutAvailableMap[thisPossibleAssignee] != null) {
							// Assign them!
							//console.log(thisFuncName + "** Assigning " + thisPossibleAssignee + " to " + thisTeamKey);
							teamScoutMap[thisTeamKey] = thisPossibleAssignee;
							// Take assignee out of available
							// @ts-ignore
							delete scoutAvailableMap[thisPossibleAssignee];
						}
					}
				}
			}
		}
		
		// fill in the rest
		let leftoverScouts = [];
		for (let property in scoutAvailableMap)
			if (scoutAvailableMap.hasOwnProperty(property))
				leftoverScouts.push(scoutAvailableMap[property]);
		//logger.debug(thisFuncName + "leftover scouts are " + JSON.stringify(leftoverScouts));

		// cycle through teams, find the ones without assignees
		let leftoverPointer = 0;
		for (let i = 0; i < 6; i++) {
			let thisTeamKey = teamArray[i];
			// Assigned yet? If not...
			if (teamScoutMap[thisTeamKey] == null) {
				// Grab the next available scout & increment the pointer
				// @ts-ignore
				teamScoutMap[thisTeamKey] = leftoverScouts[leftoverPointer];
				leftoverPointer++;
			}
		}

		// show all the team-scout assignments
		let assignmentPromisesArray = [];
		for (let property in teamScoutMap) {
			if (teamScoutMap.hasOwnProperty(property)) {
				// Write the assignment to the DB!
				let thisMatchTeamKey = thisMatchKey + '_' + property;
				let thisScout = teamScoutMap[property];

				// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
				// @ts-ignore - this will be fixed in other branch
				let thisPromise = utilities.update('matchscouting', { 'org_key': org_key, 'match_team_key' : thisMatchTeamKey }, { $set: { 'assigned_scorer' : thisScout }} );
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
	
	const org_key = req._user.org_key;

	let thisFuncName = 'scoutingpairs.clearmatchallocations[post]: ';
	logger.info(thisFuncName + 'ENTER');

	let passCheckSuccess;
	
	if( !req.body.password || req.body.password == ''){
		return res.send({status: 401, message: 'No password entered.'});
	}
	
	// TODO: Use _id, not name, because names can be modified!
	let user = await utilities.find('users', { name: req._user.name, 'org_key': org_key }, {});

	if(!user[0]){
		res.send({status: 500, message:'Passport error: no user found in db?'});
		return console.error('no user found? clearmatchallocations');
	}
		
	bcrypt.compare( req.body.password, user[0].password, async function(e, out){
		if(e)
			return console.error(e);
		if(out == true)
			passCheckSuccess = true;
		else
			return res.send({status: 401, message: 'Password incorrect.'});
		
		if(passCheckSuccess){
			/* Begin regular code ----------------------------------------------------------- */
	
			let thisFuncName = 'scoutingpairs.clearMATCHallocations[post]: ';
			let org_key = req._user.org_key;

			// Log message so we can see on the server side when we enter this
			logger.info(thisFuncName + 'ENTER');
	
			let event_key = req.event.key;

			// 2019-01-23, M.O'C: See YEARFIX comment above
			let year = parseInt(event_key.substring(0,4));
	
			//
			// Remove 'assigned_scorer' from all matching scoringdata elements
			//
			// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
			await utilities.bulkWrite('matchscouting', [{updateMany:{filter:{ 'org_key': org_key, 'event_key': event_key }, update:{ $unset: { 'assigned_scorer' : '' } }}}]);

			return res.send({status: 200, message: 'Cleared existing match scouting assignments successfully.'});
		
			/* End regular code ----------------------------------------------------------- */
		}
	});
}));

//////////// Match allocating by team assignment

router.post('/generatematchallocations', wrap(async (req, res) => {
	
	const org_key = req._user.org_key;

	let thisFuncName = 'scoutingpairs.generatematchallocations[post]: ';
	logger.info(thisFuncName + 'ENTER');

	let passCheckSuccess;
	
	if( !req.body.password || req.body.password == ''){
		return res.send({status: 401, message: 'No password entered.'});
	}
	
	// TODO: Use _id, not name, because names can be modified!
	//	also change to findOne
	let user = await utilities.find('users', { name: req._user.name, 'org_key': org_key }, {});

	if(!user[0]){
		res.send({status: 500, message:'Passport error: no user found in db?'});
		return logger.error('no user found? generatematchallocations');
	}
	
	bcrypt.compare( req.body.password, user[0].password, function(e, out){
		if(e)
			return logger.error(e);
		if(out == true)
			passCheckSuccess = true;
		else
			return res.send({status: 401, message: 'Password incorrect.'});
		
		if(passCheckSuccess){
			generateMatchAllocations(req, res);
		}
	});
}));

async function generateMatchAllocations(req: express.Request, res: express.Response){
	/* Begin regular code ----------------------------------------------------------- */
	
	let thisFuncName = 'scoutingpairs.generateMATCHallocations[post]: ';

	// Log message so we can see on the server side when we enter this
	logger.info(thisFuncName + 'ENTER');
	
	let event_key = req.event.key;
	let org_key = req._user.org_key;

	// 2019-01-23, M.O'C: See YEARFIX comment above
	let year = parseInt(event_key.substring(0,4));
	
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
	let scoutDataArrayPromise = utilities.find('pitscouting', {'org_key': org_key, 'event_key': event_key});
	// 2019-06-19 JL: Changing TBA request to DB request for matches, for off-season events.
	let matchesPromise = utilities.find('matches', {'event_key': event_key, 'comp_level': 'qm'}, { sort: {'time': 1}} );
	
	// Pull 'active team key' from DB
	// TODO make a toggle
	// var thisOrg = await utilities.findOne("orgs", {"org_key": org_key});
	// var activeTeamKey = thisOrg.team_key;
	let activeTeamKey = '';
		
	logger.debug(thisFuncName + 'Awaiting DB promises');
	
	let scoutDataArray: PitScouting[] = await scoutDataArrayPromise;
	let matchArray: Match[] = await matchesPromise;
	
	// Build teamID->primary/secondar/tertiary lookup
	let scoutDataByTeam: Dict<PitScouting> = {};
	let scoutDataLen = scoutDataArray.length;
	for (let i = 0; i < scoutDataLen; i++){
		scoutDataByTeam[scoutDataArray[i].team_key] = scoutDataArray[i];
	}
	
	// Build up the scoringdata array
	let scoringDataArray: MatchScouting[] = [];
	// Loop through each match
	let matchLen = matchArray.length;
	
	for (let matchIdx = 0; matchIdx < matchLen; matchIdx++) {
		let thisMatch = matchArray[matchIdx];
		//logger.debug(thisFuncName + "*** thisMatch=" + thisMatch.key);
		
		// Build unassigned match-team data elements
		let thisMatchDataArray = [];
		
		// { year, event_key, match_key, match_number, alliance, team_key, 'match_team_key', assigned_scorer, actual_scorer, scoring_data: {} }
		let allianceArray: Array<'red'|'blue'> = ['red', 'blue'];
		
		for (let alliance of allianceArray) {
			// teams are indexed 0, 1, 2
			for (let teamIdx = 0; teamIdx < 3; teamIdx++) {
				
				let team_key = thisMatch.alliances[alliance].team_keys[teamIdx];
				
				let thisScoreData: MatchScouting = {
					year: year,
					event_key: event_key,
					org_key: org_key,
					match_key: thisMatch.key,
					match_number: thisMatch.match_number,
					// time is the best 'chronological order' sort field
					time: thisMatch.time,
					alliance: alliance,
					team_key: team_key,
					match_team_key: thisMatch.key + '_' + team_key
				};

				//logger.debug(thisFuncName + "thisScoreData=" + JSON.stringify(thisScoreData));
				
				thisMatchDataArray.push(thisScoreData);
			}
		}
		let thisMatchLen = thisMatchDataArray.length;
		//logger.debug(thisFuncName + "thisMatchDataArray=" + JSON.stringify(thisMatchDataArray));
		
		// Keep track of who we've assigned - can't assign someone twice!
		let assignedMembers = {};
		// Go through assigning primaries first, then secondaries, then tertiaries
		let roleArray = [ 'primary', 'secondary', 'tertiary' ];
		for (let roleIdx = 0; roleIdx < roleArray.length; roleIdx++) {
			// Which role (primary? secondary? tertiary?) are we checking
			let thisRole = roleArray[roleIdx];
			// Cycle through the scoring data, looking for blank assignees
			for (let thisMatchIdx = 0; thisMatchIdx < thisMatchLen; thisMatchIdx++) {
				let thisScoreData = thisMatchDataArray[thisMatchIdx];
				//logger.debug(thisFuncName + "thisScoreData=" + thisScoreData);
				// Not yet assigned?
				if( !(thisScoreData.assigned_scorer) ){
					// Which team is this?
					let thisTeamKey = thisScoreData.team_key;
					//logger.debug(thisFuncName + 'thisTeamKey=' + thisTeamKey);
					
					// 2018-03-15, M.O'C: Skip assigning if this teams is the "active" team (currently hardcoding to 'frc102')
					if( activeTeamKey && activeTeamKey != thisTeamKey ){
						
						logger.trace(thisFuncName + 'scoutDataByTeam[thisTeamKey]:' + JSON.stringify(scoutDataByTeam[thisTeamKey]));
						
						// Who is assigned to this team?
						let thisScoutData = scoutDataByTeam[thisTeamKey];
						let thisPossibleAssignee = {};
						if (thisScoutData)
							// @ts-ignore
							thisPossibleAssignee = thisScoutData[thisRole];
						// Only check if this role is defined for this team
						if (thisPossibleAssignee) {
							// Only proceed if this person is not yet assigned elsewhere
							// @ts-ignore
							if (!assignedMembers[thisPossibleAssignee]) {
								// Good to assign!
								//logger.debug(thisFuncName + "~~~~ thisPossibleAssignee=" + JSON.stringify(thisPossibleAssignee));
								// @ts-ignore
								thisMatchDataArray[thisMatchIdx].assigned_scorer = thisPossibleAssignee;
								// Mark them as assigned to a team
								// @ts-ignore
								assignedMembers[thisPossibleAssignee] = thisPossibleAssignee;
							}
						}
					}
				}
			}
		}
		
		logger.trace(thisFuncName + '*** thisMatch=' + thisMatch.key);
		for (let thisMatchDataIdx = 0; thisMatchDataIdx < thisMatchLen; thisMatchDataIdx++) {
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
	res.send({status: 200, message: 'Generated team allocations successfully.'});
	
	//All code below is legacy.
	return;
}

module.exports = router;
