import express from 'express';
import bcrypt from 'bcryptjs';
import { getLogger } from 'log4js';
import wrap from '../../helpers/express-async-handler';
import utilities, { MongoDocument } from 'scoutradioz-utilities';
import Permissions from '../../helpers/permissions';
import e, { assert } from 'scoutradioz-http-errors';
import type { Match, MatchScouting, OrgSubteam, PitScouting, PitScoutingSet, ScouterRecord, ScoutingPair, Team, TeamKey, User, WithDbId} from 'scoutradioz-types';
import { AnyBulkWriteOperation, ObjectId } from 'mongodb';

const router = express.Router();
const logger = getLogger('assignments');

router.all('/*', wrap(async (req, res, next) => {
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate(Permissions.ACCESS_TEAM_ADMIN)) {
		next();
	}
}));

/**
 * Admin page to control and assign pairs of students for pit scouting.
 * @url /manage/assignments/
 * @views /manage/assignments/index
 */
router.get('/', wrap(async (req, res) => {
	logger.addContext('funcName', 'scoutingassignments(root)');
	
	const thisUser = req._user;
	const startTime = Date.now();
	const org_key = thisUser.org_key;
	const event_key = req.event.key;
	
	//Log message so we can see on the server side when we enter this
	logger.info('ENTER org_key=' + org_key);
	logger.debug('Requesting all members from db');
	
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
	
	logger.debug('Requesting scouting pairs from db');
	
	//Get all already-assigned pairs
	// 2020-02-12, M.O'C - Adding "org_key": org_key, 
	dbPromises.push( utilities.find('scoutingpairs', {'org_key': org_key}) );
	
	logger.trace('Awaiting all db requests');
	
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
		
			logger.trace('Rendering');
		
			res.render('./manage/assignments/index', {
				title: 'Pit Scouting Assignments',
				subteams: pitScoutSubteams,
				assigned: assigned,
				available: available,
				matchScoutingCount: matchScoutingCount,
				pitScoutingCount: pitScoutingCount
			});
		});
}));

router.get('/matches', wrap(async (req, res) => {
	
	const thisUser = req._user;
	const org_key = thisUser.org_key;
	const event_key = req.event.key;
	
	//Log message so we can see on the server side when we enter this
	logger.info('ENTER org_key=' + org_key);
	
	assert(thisUser.org.config.members.subteams, `Could not get list of subteams from org config: ${org_key}`);
	const subteams = thisUser.org.config.members.subteams;
	
	subteams.sort((a, b) => {
		return Number(b.pit_scout) - Number(a.pit_scout) || a.subteam_key.localeCompare(b.subteam_key);
	});
	// for sorting members
	let subteamsMap: Dict<OrgSubteam> = {};
	for (let subteam of subteams) {
		subteamsMap[subteam.subteam_key] = subteam;
	}
	
	//Any team members that are not on a subteam, but are unassigned and present.
	const available: User[] = await utilities.find('users', 
		{'event_info.present': true, org_key: org_key, visible: true}, 
		{sort: {'name': 1}}
	);
	
	// sort by subteam the same way as above
	available.sort((a, b) => {
		return Number(subteamsMap[b.org_info.subteam_key].pit_scout) -
			Number(subteamsMap[a.org_info.subteam_key].pit_scout) ||
			a.org_info.subteam_key.localeCompare(b.org_info.subteam_key);
	});
	
	// Find the number of match assignments WITH data
	const matchAssignments = await utilities.find('matchscouting', {org_key: org_key, event_key: event_key, data: {$ne: null}});
	const matchAssignmentsCount = matchAssignments.length;
	
	logger.trace('Awaiting all db requests');
	
	res.render('./manage/assignments/matches', {
		title: 'Match Scouting Assignments',
		available: available,
		subteams: subteams,
		matchAssignmentsCount: matchAssignmentsCount
	});
}));

router.post('/matches/generate', wrap(async (req, res) => {
	logger.addContext('funcName', 'matches/generate[post]');
	
	// Gap between matches equal to or over this value means a "major" gap (e.g., lunch, overnight, etc.)
	const matchGapBreakThreshold = 30 * 60;  // 30 minutes, in seconds
	// Size of match blocks to be scouted - scouts will do this many matches in a row
	let matchBlockSize = 5;  // default
	
	if (req.body.blockSize) {
		matchBlockSize = req.body.blockSize;
		logger.trace('Overriding matchBlockSize to ' + matchBlockSize);
		// remove from req.body before proceeding to pulling out the multi-checkbox list
		delete req.body.blockSize;
	}
	assert(!req.body.blockSize);
	
	const event_key = req.event.key;
	const org_key = req._user.org_key;
	const event_year = req.event.year;
	
	logger.info(`ENTER org_key=${org_key}, matchBlockSize=${matchBlockSize}`);
	
	const availableArray: ObjectId[] = []; // User IDs
	logger.trace('*** Tagged as available:');
	for(let user in req.body) {
		const userId = user.split('|')[0];
		const userName = user.split('|')[1]; // unused
		logger.trace(`user: ${userId} | ${userName}`);
		assert(userId && userName, 'Could not find both userId and userName');
		availableArray.push(ObjectId.createFromHexString(userId));
	}
	
	let matchScoutingAssignments: MatchScouting[] = await utilities.find('matchscouting', 
		{org_key, event_key}
	);
	
	// Generate blank match data
	if (matchScoutingAssignments.length == 0) {
		logger.debug('No match data found');
		
		const matchArray: Match[] = await utilities.find('matches', 
			{event_key, comp_level: 'qm'},
			{sort: {time: 1}}
		);
		
		// All of the matchscouting data to be generated
		const newMatchAssignmentsArray: MatchScouting[] = [];
		
		for (let matchIdx in matchArray) {
			let thisMatch = matchArray[matchIdx];
		
			let allianceArray: Array<'red'|'blue'> = ['red', 'blue'];
		
			for (let alliance of allianceArray) {
				// teams are indexed 0, 1, 2
				for (let teamIdx = 0; teamIdx < 3; teamIdx++) {
				
					let team_key = thisMatch.alliances[alliance].team_keys[teamIdx];
				
					let thisMatchAssignment: MatchScouting = {
						year: event_year,
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
					newMatchAssignmentsArray.push(thisMatchAssignment);
				}
			}
			
		}
		
		// now, update db
		let writeResult = await utilities.insert('matchscouting', newMatchAssignmentsArray);
		logger.debug(`Inserted ${writeResult?.insertedCount} new blank matchData`);
		matchScoutingAssignments = newMatchAssignmentsArray;
	}
	//
	// Read all assigned OR tagged members, ordered by 'seniority' ~ have an array ordered by seniority
	//
	// - matchscouts is the "queue"; need a pointer to indicate where we are
	// TODO: Use _id, not name, because names can be modified!
	// 2022-03-01, M.O'C: Adding 'org_key': org_key into the 2nd part of the "or" clause
	const matchScouts = await utilities.find('users', 
		{$or: [
			{'_id': {$in: availableArray}, 'org_key': org_key}, 
			// {'event_info.assigned': true, 'org_key': org_key}
		]}, 
		{ sort: {'org_info.seniority': 1, 'org_info.subteam_key': 1, 'name': 1} }
	) as WithDbId<User>[]; // JL: temporary
	
	logger.trace('*** Assigned + available, by seniority:');
	for (let i in matchScouts)
		logger.trace('member['+i+'] = ' + matchScouts[i].name);
	
	//
	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	//
	const timestampArray = await utilities.find('matches', { event_key: event_key, 'alliances.red.score': -1 },{sort: {'time': 1}});

	// Avoid crashing server if all matches at an event are done
	let earliestTimestamp = 9999999999;
	if (timestampArray && timestampArray[0]) {
		let earliestMatch = timestampArray[0];
		earliestTimestamp = earliestMatch.time;
	}


	// Clear 'assigned_scorer' from all unresolved team@matches
	await utilities.bulkWrite('matchscouting', 
		[{updateMany: {
			filter: { org_key, event_key, time: { $gte: earliestTimestamp } }, 
			update: { $unset: { 'assigned_scorer' : '' } }
		}}]
	);
	
	let comingMatches: Match[] = await utilities.find('matches', 
		{event_key: event_key, time: {$gte: earliestTimestamp}},
		{sort: {time: 1}}
	);
	let lastMatchTimestamp = earliestTimestamp;
	
	let matchBlockCounter = matchBlockSize;  // initialize at the max size so in the first loop iteration, it'll set up the scout list
	let scoutPointer = 0;  // start off with the 0th position
	// 2022-11-10 JL: changed scoutArray to be a list of _ids and names
	let scoutArray: ScouterRecord[] = [];  // the current set of scouts (gets regenerated every N matches)
	let scoutAvailableMap: Dict<ScouterRecord> = {};  // pool of available scouts
	
	let redBlueToggle = 0;  // flips between 0 and 1, signals whether to allocate red alliance or blue alliance first
	
	for (let matchesIdx in comingMatches) {
		const thisMatch = comingMatches[matchesIdx];
		const thisMatchKey = thisMatch.key;
		
		let teamScoutMap: Dict<ScouterRecord> = {}; // map of team->scout associations; reset for each match
		
		// Work in sets of up to <block size> matches (could be less, if "break" or end is hit)
		if (matchBlockCounter >= matchBlockSize) {
			// Pull off the next 6 scouts
			scoutArray = [];
			for (let i = 0; i < 6; i++) {
				let thisScout = matchScouts[scoutPointer];
				if (!thisScout) {
					logger.trace('Not enough scouts!');
					break;
				}
				scoutArray.push({
					id: thisScout._id,
					name: thisScout.name,
				});
				scoutPointer++;
				if (scoutPointer >= matchScouts.length)
					scoutPointer = 0;
			}
			logger.trace(`Updated current scouts: ${JSON.stringify(scoutArray)}`);
			
			matchBlockCounter = 0;
		}
		matchBlockCounter++;
		
		// reset the scout available map
		// scoutAvailableMap = {};
		// for (let i = 0; i < 6; i++) {
		// 	let thisScout = scoutArray[i];
		// 	scoutAvailableMap[thisScout.id] = thisScout;
		// }
		// logger.trace('scoutAvailablemap: ' + JSON.stringify(scoutAvailableMap));
		
		let matchGap = comingMatches[matchesIdx].time - lastMatchTimestamp;
		// Iterate until a "break" is found (or otherwise, if the loop is exhausted)
		if (matchGap > matchGapBreakThreshold) {
			logger.trace('matchGap=' + matchGap + '... found a break');
			break;
		}
		
		let teamArray: TeamKey[] = [];
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
		logger.trace('comingMatch[' + matchesIdx + ']: matchGap=' + (matchGap) + ', teamArray=' + JSON.stringify(teamArray));
		
		// -- In each match, assign 6 scouts to 6 teams in 'scoringdata'
		// * Cycle through - attempt to assign teams to primary (if not yet assigned) ~ pseudorandom? sort { time: 1, _id: 1 }
		// * Cycle through remaining teams - assigning remaining scouts
		// --- Update scoringdata, set assigned_scorer where team_key, match_key, etc.
		
		// 2022-11-10 JL: Removed the role (primary/secondary/tertiary) stuff
		// 	and switched to just shuffling the team array
		
		// Shuffle the team array
		teamArray.sort(() => Math.random() - 0.5);
		// cycle through teams and assign to the scouters, after teamArray has been shuffled
		for (let i = 0; i < 6; i++) {
			let thisTeamKey = teamArray[i];
			// Assigned yet? If not...
			if (!teamScoutMap[thisTeamKey]) {
				// Grab the next available scout
				teamScoutMap[thisTeamKey] = scoutArray[i];
			}
		}

		// show all the team-scout assignments
		let assignmentPromisesArray = [];
		for (let property in teamScoutMap) {
			if (teamScoutMap.hasOwnProperty(property)) {
				// Write the assignment to the DB!
				let thisMatchTeamKey = thisMatchKey + '_' + property;
				let thisScout = teamScoutMap[property];

				let thisPromise = utilities.update('matchscouting', 
					{ org_key: org_key, match_team_key : thisMatchTeamKey }, 
					{ $set: { assigned_scorer : thisScout }} 
				);
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

/* POST to Set scoutingPair Service */
router.post('/setscoutingpair', wrap(async (req, res) => {
	logger.addContext('funcName', 'setscoutingpair[post]');
	
	// Get our form values. These rely on the "name" attributes of form elements (e.g., named 'data' in the form)
	const data = req.body.data;
	const org_key = req._user.org_key;

	// Log message so we can see on the server side when we enter this
	logger.info('ENTER org_key=' + org_key);
	
	// The javascript Object was JSON.stringify() on the client end; we need to re-hydrate it with JSON.parse()
	let selectedMembers: {
		member1: string,
		member2: string,
		member3?: string
	} = JSON.parse(data);
	
	assert(selectedMembers.member1 && selectedMembers.member2, 'Select at least two members.');
	
	logger.trace(`Selected members: ${data}`);
	
	let member1 = await utilities.findOne('users', {_id: new ObjectId(selectedMembers.member1), org_key}) as WithDbId<User>; // JL: Temporary until i fix the most recent version of utilities
	let member2 = await utilities.findOne('users', {_id: new ObjectId(selectedMembers.member2), org_key}) as WithDbId<User>;
	let member3;
	if (selectedMembers.member3)
		member3 = await utilities.findOne('users', {_id: new ObjectId(selectedMembers.member3), org_key}) as WithDbId<User>;
	
	let idList = [member1._id, member2._id]; // for bulkWrite operation
	let newScoutingPair: ScoutingPair = {
		org_key,
		member1: {
			id: member1._id,
			name: member1.name,
		},
		member2: {
			id: member2._id,
			name: member2.name,
		},
	};
	if (member3) {
		idList.push(member3._id);
		newScoutingPair.member3 = {
			id: member3._id,
			name: member3.name
		};
	}
	
	logger.trace(`Inserting into scoutingpairs: ${JSON.stringify(newScoutingPair)}. idList=${JSON.stringify(idList)}`);
	
	await utilities.insert('scoutingpairs', newScoutingPair);
	
	let bulkWriteResult = await utilities.bulkWrite('users', [{updateMany: {
		filter: {_id: {$in: idList}},
		update: {
			$set: {
				'event_info.assigned': true
			}
		}
	}}]);

	logger.debug('bulkWriteResult=', bulkWriteResult);
	
	res.redirect('./');
}));


// ================================== SCOUTING PAIRS ==================================

router.post('/deletescoutingpair', wrap(async (req, res) => {
	logger.addContext('funcName', 'deletescoutingpair[post]');
	
	let thisPairId = req.body.data;
	let org_key = req._user.org_key;

	// Log message so we can see on the server side when we enter this
	logger.info(`ENTER org_key=${org_key}, thisPairId=${thisPairId}`);
	
	// 2023-02-12 JL: Switching to findOne
	let thisPair = await utilities.findOne('scoutingpairs', {_id: thisPairId, org_key});
	assert(thisPair, 'Scouting pair could not be found!');
		
	// 2020-02-12, M.O'C - Adding "org_key": org_key, 

	logger.trace('thisPair=', thisPair);
	
	
	let idList = [thisPair.member1.id, thisPair.member2.id];
	if (thisPair.member3) idList.push(thisPair.member3.id);
	
	logger.trace(`idList=${idList}`);
	
	// 2023-02-12 JL: Switching query to scouter IDs
	let writeResult = await utilities.bulkWrite('users', [{
		updateMany: {
			filter: {
				_id: {$in: idList}
			},
			update: {
				$set: {
					'event_info.assigned': false
				}
			}
		}
	}]);
	
	logger.debug('writeResult=', writeResult);
	
	// 2020-02-12, M.O'C - Adding "org_key": org_key, 
	await utilities.remove('scoutingpairs', {org_key, '_id': thisPair._id});
	res.redirect('./');	
	
	logger.trace('DONE');
}));

// Originally named /setallunassigned, but now also deletes all scouting pairs, for ease of use
router.post('/clearscoutingpairs', wrap(async (req, res) => {
	logger.addContext('funcName', 'clearscoutingpairs[post]');
	logger.debug('ENTER');
	
	const org_key = req._user.org_key;
	
	logger.info(`Deleting all scouting pairs under ${org_key}`);
	
	let deleteResult = await utilities.remove('scoutingpairs', {org_key: org_key});
	logger.debug(`writeResult=${JSON.stringify(deleteResult)}`);
	
	logger.info(`Setting everyone under ${org_key} to assigned=false`);
	
	let writeResult = await utilities.bulkWrite('users', [{updateMany: {
		filter: {org_key: org_key},
		update: {$set: {'event_info.assigned': false}}
	}}]);
	logger.debug(`writeResult=${JSON.stringify(writeResult)}`);
	
	return res.send({status: 200, message: 'Cleared scouting pairs successfully.'});
}));


router.post('/generateteamallocations', wrap(async (req, res) => {
	
	generateTeamAllocations(req, res);
}));


router.post('/clearpitallocations', wrap(async (req, res) => {
	
	let thisFuncName = 'scoutingpairs.generateteamallocations[post]: ';
	let org_key = req._user.org_key;
	let event_key = req.event.key;
	let passCheckSuccess;
		
	if( !req.body.password || req.body.password == ''){
		
		return res.send({status: 401, message: 'No password entered.'});
	}

	// Log message so we can see on the server side when we enter this
	logger.info(thisFuncName + 'ENTER');

	// TODO: Use _id, not name, because names can be modified!
	//	also, change to findOne instead of doing stuff with user[0] and whatever
	let user = await utilities.find('users', { name: req._user.name, 'org_key': org_key });

	if(!user[0]){
		res.send({status: 500, message:'Passport error: no user found in db?'});
		return logger.error('no user found? generateteamallocations');
	}
	
	bcrypt.compare( req.body.password, user[0].password, async function(e, out){
		if(e)
			return logger.error(e);
		if(out == true)
			passCheckSuccess = true;
		else
			return res.send({status: 401, message: 'Password incorrect.'});
		
		if(passCheckSuccess){
			let writeResult = await utilities.remove('pitscouting', {org_key, event_key});
			logger.debug('writeResult=', writeResult);
			return res.send({
				status: 200, message: 'Cleared pit scouting data successfully.'
			});
		}
	});
}));

// ================================== MATCH SCOUTING ==================================

router.get('/swapmatchscouters', wrap(async (req, res) => {
	logger.addContext('funcName', 'swapmembers[get]');
	
	// for later querying by event_key
	let eventKey = req.event.key;
	let org_key = req._user.org_key;

	// Log message so we can see on the server side when we enter this
	logger.info('ENTER eventKey=' + eventKey + ',org_key=' + org_key);

	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	let matchDocs = await utilities.find('matches', { event_key: eventKey, 'alliances.red.score': -1 },{sort: {'time': 1}});

	// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
	let earliestTimestamp = 9999999999;
	if (matchDocs && matchDocs[0]) {
		let earliestMatch = matchDocs[0];
		earliestTimestamp = earliestMatch.time;
	}
		
	// Get the distinct list of scorers from the unresolved matches
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let scorers = await utilities.distinct('matchscouting', 'assigned_scorer', {'org_key': org_key, 'event_key': eventKey, 'time': { $gte: earliestTimestamp }}) as ScouterRecord[];
	logger.debug('distinct assigned_scorers: ' + JSON.stringify(scorers));
	
	// 2022-02-07 JL: sorting le scorers' names
	scorers.sort((a, b) => a.name.localeCompare(b.name));

	// Get list of all users for this org
	let users = await utilities.find('users', {org_key: org_key, visible: true}, {sort:{ 'name': 1 }});
	
	// 2023-02-07 JL: added (assigned) to the end of names 
	users.forEach(user => {
		if (user.event_info.assigned === true) user.name += ' (assigned)';
	});

	// Go to a Pug to show two lists & a button to do the swap - form with button
	res.render('./manage/assignments/swapmatchscouters', {
		title: 'Swap Match Scouts',
		scorers: scorers,
		users: users
	});
}));

router.post('/swapmatchscouters', wrap(async (req, res) => {
	
	let thisFuncName = 'scoutingpairs.swapmembers[post]: ';
	
	// for later querying by event_key
	let event_key = req.event.key;
	let org_key = req._user.org_key;

	// Log message so we can see on the server side when we enter this
	logger.info(thisFuncName + 'ENTER org_key=' + org_key);
	
	// Extract 'from' & 'to' from req
	let swapoutID = req.body.swapout;
	let swapinID = req.body.swapin;
	
	if (!swapoutID || !swapinID) return res.redirect('?alert=Please select both users to swap.&type=error');
	
	logger.info(thisFuncName + 'swap out ' + swapinID + ', swap in ' + swapoutID);
	
	let swapout = await utilities.findOne('users', {_id: swapoutID});
	let swapin = await utilities.findOne('users', {_id: swapinID}) as WithDbId<User>; // JL: temporary till i fix utilities
	
	assert(swapout && swapin, new e.InternalDatabaseError('Could not find both users in database!')); // Make sure users are found in the db

	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	let matchDocs = await utilities.find('matches', { event_key: event_key, 'alliances.red.score': -1 },{sort: {'time': 1}});
	// matchCol.find({ event_key: eventKey, "alliances.red.score": -1 },{sort: {"time": 1}}, function(e, docs){

	// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
	let earliestTimestamp = 9999999999;
	if (matchDocs && matchDocs[0]) {
		let earliestMatch = matchDocs[0];
		earliestTimestamp = earliestMatch.time;
	}
		
	// Do the updateMany - change instances of swapout to swapin
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	// 2023-02-07 JL: changing scouter name to ScouterRecord
	let writeResult = await utilities.bulkWrite('matchscouting', [{updateMany:{filter: { 'assigned_scorer.id': new ObjectId(swapoutID), org_key, event_key, time: { $gte: earliestTimestamp } }, 
		update:{ $set: { assigned_scorer: {
			id: swapin._id,
			name: swapin.name
		}}}}}]);
	logger.debug(`writeResult=${JSON.stringify(writeResult)}`);

	res.redirect('/dashboard/matches');
}));

router.get('/swappitassignments', wrap(async (req, res) => {

	logger.addContext('funcName', 'swappitassignments[get]');
	logger.info('ENTER');
	
	// for later querying by event_key
	let event_key = req.event.key;
	let org_key = req._user.org_key;

	// who is the scout we're querying (if specified)
	let scoutId = req.query.scoutId;
	
	let doEveryone = req.query.all;
	if (doEveryone == 'true') {
		logger.debug('"All scouters" set to true; redirecting to get rid of the scoutId= and all= parameters');
		return res.redirect('/manage/assignments/swappitassignments');
	}

	// Two sets of teams - one for each select control
	let teams1: PitScouting[] = [];
	let teams2: PitScouting[] = [];
	if (scoutId) {
		assert(typeof scoutId === 'string', 'Invalid scout ID provided');
		let scoutObjectId = new ObjectId(scoutId);
		// find teams which have the specified scout in primary OR secondary OR tertiary
		teams1 = await utilities.find('pitscouting', {'org_key': org_key, 'event_key': event_key, data: {$exists: false}, $or: [{ 'primary.id': scoutObjectId}, {'secondary.id': scoutId}, {'tertiary.id': scoutId}]}, { });
		// find teams which do NOT have the specified scout in primary NOR in secondary NOR in tertiary 
		teams2 = await utilities.find('pitscouting', {'org_key': org_key, 'event_key': event_key, data: {$exists: false}, 'primary.id': {$ne: scoutObjectId}, 'secondary.id': {$ne: scoutObjectId}, 'tertiary.id': {$ne: scoutObjectId} }, { });
	}
	else {
		// just get two sets of all teams
		teams1 = await utilities.find('pitscouting', {'org_key': org_key, 'event_key': event_key, data: {$exists: false}}, { });
		teams2 = await utilities.find('pitscouting', {'org_key': org_key, 'event_key': event_key, data: {$exists: false}}, { });
	}
	//sort teams lists by number
	teams1.sort(function(a, b) {
		let aNum = parseInt(a.team_key.substring(3));
		let bNum = parseInt(b.team_key.substring(3));
		return aNum - bNum;
	});
	teams2.sort(function(a, b) {
		let aNum = parseInt(a.team_key.substring(3));
		let bNum = parseInt(b.team_key.substring(3));
		return aNum - bNum;
	});
	logger.debug('teams1.length=' + teams1.length);
	logger.debug('teams2.length=' + teams2.length);

	// get the list of assigned scouts
	let pitScouts = await utilities.distinct('pitscouting', 'primary', {'org_key': org_key, 'event_key': event_key});
	logger.debug('distinct pitScouts=' + JSON.stringify(pitScouts));

	res.render('./manage/assignments/swappitassignments', {
		title: 'Team Assignments',
		teams1: teams1,
		teams2: teams2,
		pitScouts: pitScouts,
		scoutId: scoutId
	});	
}));

router.post('/swappitassignments', wrap(async (req, res) => {
	logger.addContext('funcName', 'swappitassignments[post]');
	
	// for later querying by event_key
	let event_key = req.event.key;
	let org_key = req._user.org_key;

	// Log message so we can see on the server side when we enter this
	logger.info('ENTER org_key=' + org_key);
	
	let scoutId = req.body.scoutId || req.query.scoutId;
	// Extract from req the two teams to be swapped
	let team1 = req.body.team1;
	let team2 = req.body.team2;
	logger.info('team1=' + team1 + ',team2=' + team2 + ';scoutId=' + scoutId);
	
	if (!team1 || !team2) {
		let redirect = req.getURLWithQueryParameters('/manage/assignments/swappitassignments', {
			scoutId: scoutId,
			alert: 'Please specify two teams to be swapped.',
			type: 'bad'
		});
		return res.redirect(redirect);
	}
	
	// create keys from the team values
	let team_key1 = 'frc' + team1;
	let team_key2 = 'frc' + team2;
	// use a temporary value during the swapping process
	let team_key2_temp = team_key2 + 'SWAP';

	// updates
	// set team1 record key to team2+SWAP
	await utilities.update(
		'pitscouting',
		{ 'org_key': org_key, 'event_key': event_key, 'team_key': team_key1 },
		{ $set: { 'team_key': team_key2_temp } }
	);
	// set team2 record key to team1
	await utilities.update(
		'pitscouting',
		{ 'org_key': org_key, 'event_key': event_key, 'team_key': team_key2 },
		{ $set: { 'team_key': team_key1 } }
	);
	// set team1 record key to team2+SWAP
	await utilities.update(
		'pitscouting',
		{ 'org_key': org_key, 'event_key': event_key, 'team_key': team_key2_temp },
		{ $set: { 'team_key': team_key2 } }
	);

	let redirect = req.getURLWithQueryParameters('/manage/assignments/swappitassignments', {scoutId: scoutId});
	res.redirect(redirect);
}));

async function generateTeamAllocations(req: express.Request, res: express.Response) {
	logger.addContext('funcName', 'generateTEAMallocations');
	
	const event_key = req.event.key;
	const year = req.event.year;
	const org_key = req._user.org_key;
	
	// Pull 'active team key' from DB
	let thisOrg = await utilities.findOne('orgs', {'org_key': org_key});
	// Get a list of all the active team keys in this org. Usually only 1 long, sometimes multiple, should never be 0 long but accounting for it just in case.
	let activeTeamKeys = (thisOrg.team_key ? [thisOrg.team_key] : thisOrg.team_keys) || [];
	
	//
	// Get the current set of already-assigned pairs; make a map of {"id": {"prim", "seco", "tert"}}
	//
	const scoutingpairs = await utilities.find('scoutingpairs', {org_key});
	
	// Iterate through scoutingpairs; create {1st: 2nd: 3rd:} and add to 'dict' keying off 1st <1, or 1/2 2/1, or 1/2/3 2/3/1 3/1/2>
	let primaryAndBackupMap: Dict<PitScoutingSet> = {};
	let scoutingAssignedArray: ObjectId[] = [];
	
	for (let i in scoutingpairs) {
		const thisPair = scoutingpairs[i];
		
		// 2023-02-12 JL: Scoutingpairs are now required to have at least 2 members each, so I removed the third case where there's no member2
		assert(thisPair.member1 &&thisPair.member2, 'Each scouting pair must have at least 2 members!');
		
		// Group of 3
		if (thisPair.member3) {
			let set1: PitScoutingSet = {
				primary: thisPair.member1,
				secondary: thisPair.member2,
				tertiary: thisPair.member3,
			};
			let set2: PitScoutingSet = {
				primary: thisPair.member2,
				secondary: thisPair.member3,
				tertiary: thisPair.member1,
			};
			let set3: PitScoutingSet = {
				primary: thisPair.member3,
				secondary: thisPair.member1,
				tertiary: thisPair.member2
			};
			// JL note: Can't use ObjectId as a dictionary key, so they have to be typecast to a string
			primaryAndBackupMap[String(set1.primary.id)] = set1;
			primaryAndBackupMap[String(set2.primary.id)] = set2;
			primaryAndBackupMap[String(set3.primary.id)] = set3;
			scoutingAssignedArray.push(set1.primary.id, set2.primary.id, set3.primary.id);
		}
		else {
			let set1: PitScoutingSet = {
				primary: thisPair.member1,
				secondary: thisPair.member2,
			};
			let set2: PitScoutingSet = {
				primary: thisPair.member2,
				secondary: thisPair.member1,
			};
			primaryAndBackupMap[String(set1.primary.id)] = set1;
			primaryAndBackupMap[String(set2.primary.id)] = set2;
			scoutingAssignedArray.push(set1.primary.id, set2.primary.id);
		}
	}
	
	//
	// Read all present members, ordered by 'seniority' ~ have an array ordered by seniority
	//
	const teamMembers = await utilities.find('users',
		{_id: {$in: scoutingAssignedArray}, org_key},
		{sort: {'org_info.seniority': 1, 'org_info.subteam_key': 1, name: 1}}
	);
	
	// 2020-02-09, M.O'C: Switch from "currentteams" to using the list of keys in the current event
	// 2023-02-12 JL: Switching to req.teams
	assert(req.teams, 'List of teams not defined! Make sure to click "Update current teams"');
	const teamArray = req.teams;
	
	// 2023-02-12 JL: Added a query to get existing scouting data on a per-team basis
	const existingScoutingData = await utilities.find('pitscouting', {event_key, org_key, data: {$ne: undefined}});
	
	//
	// Cycle through teams, adding 1st 2nd 3rd to each based on array of 1st2nd3rds
	//
	let teamAssignments: PitScouting[] = [];
	// 2023-02-12 JL: Removed unused teamassignmentsbyTeam
	let assigneePointer = 0;
	for (let i in teamArray) {
		const thisTbaTeam = teamArray[i];
		let thisTeammember = teamMembers[assigneePointer];
		let thisTeammemberId = String(thisTeammember._id);
		let thisPrimaryAndBackup = primaryAndBackupMap[thisTeammemberId];
		logger.trace(`i=${i}, assigneePointer=${assigneePointer}, team=${thisTbaTeam.key}, thisTeamMember=${thisTeammember.name}`);
		logger.trace('thisPrimaryAndBackup', thisPrimaryAndBackup);
		
		const team_key = thisTbaTeam.key;
		
		let thisAssignment: PitScouting = {
			year,
			event_key,
			org_key,
			team_key,
		};
		
		// 2018-03-15, M.O'C: Skip assigning if this teams is the "active" team
		// 2023-02-12 JL: Switched to supporting multiple "active" teams
		if (!activeTeamKeys.some(key => key === team_key)) {
			thisAssignment.primary = thisPrimaryAndBackup.primary;
			thisAssignment.secondary = thisPrimaryAndBackup.secondary;
			if (thisPrimaryAndBackup.tertiary)
				thisAssignment.tertiary = thisPrimaryAndBackup.tertiary;
			
			// Update assignee pointer
			assigneePointer++;
			if (assigneePointer >= teamMembers.length)
				assigneePointer = 0;
		}
		else {
			logger.trace(`Skipping team ${team_key}`);
		}
		
		// 2023-02-12 JL: Check for existing scouting data and insert it 
		for (let thisEntry of existingScoutingData) {
			if (thisEntry.team_key === team_key) {
				logger.trace(`Appending data for team_key ${team_key}`);
				thisAssignment.data = thisEntry.data;
			}
		}
		
		// Array for mass insert
		teamAssignments.push(thisAssignment);
	}
	logger.trace('****** New/updated teamassignments:');
	for (let assignment of teamAssignments) {
		logger.trace(`team=${assignment.team_key}, primary=${assignment.primary?.name}, secondary=${assignment.secondary?.name}, tertiary=${assignment.tertiary?.name}`);
	}
	
	// Sanity check for data deletion
	let teamAssignmentsWithData = 0;
	for (let assignment of teamAssignments) if (assignment.data) teamAssignmentsWithData++;
	logger.info(`Generated team assignments with data inserted: ${teamAssignmentsWithData}. Previously found: ${existingScoutingData.length}`);
	if (teamAssignmentsWithData !== existingScoutingData.length) {
		logger.warn('Numbers do not match!!!');
		logger.debug('Data dump:', existingScoutingData.map(item => {
			return {key: item.team_key, data: item.data};
		}));
	}
	
	// Delete ALL the old elements first for the 'current' event
	await utilities.remove('pitscouting', {org_key, event_key});
	
	// Insert the new data
	await utilities.insert('pitscouting', teamAssignments);
	
	res.redirect('./?alert=Generated pit scouting assignments successfully.');
}

module.exports = router;