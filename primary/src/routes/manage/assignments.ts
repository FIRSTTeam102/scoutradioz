import bcrypt from 'bcryptjs';
import express from 'express';
import { getLogger } from 'log4js';
import e, { assert, lightAssert } from 'scoutradioz-http-errors';
import type { Match, MatchFormData, MatchScouting, OrgSubteam, PitScouting, PitScoutingSet, ScouterRecord, ScoutingPair, TeamKey, User, UserAgent, WithDbId } from 'scoutradioz-types';
import utilities from 'scoutradioz-utilities';
import wrap from '../../helpers/express-async-handler';
import Permissions from '../../helpers/permissions';

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
	
	// 2023-03-29, M.O'C: Checking list of teams
	//Get list of currentteams
	let teamsArray = req.teams;
	logger.debug(`teamsArray.length = ${teamsArray?.length}`);
	let areTeamsListedInDB = true;
	if (!teamsArray || teamsArray.length < 1) {
		areTeamsListedInDB = false;
		logger.warn('Pit scouting but no teams found in DB');
	}

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
				title: req.msg('manage.assignments.pit'),
				subteams: pitScoutSubteams,
				assigned: assigned,
				available: available,
				matchScoutingCount: matchScoutingCount,
				pitScoutingCount: pitScoutingCount,
				areTeamsListedInDB: areTeamsListedInDB
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
	
	available.forEach(user => lightAssert(subteamsMap[user.org_info.subteam_key], `A user was found with a subteam_key "${user.org_info.subteam_key}", which does not exist in your org configuration. Please fix this by going to the Manage members page and ensuring all users have a valid subteam and class.`));
	
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
		title: req.msg('manage.assignments.match'),
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
	
	const availableArray: number[] = []; // User IDs
	let stoppingForBreaks = true;
	logger.trace('*** Tagged as available:');
	for(let user in req.body) {
		const userId = user.split('|')[0];
		// 2024-01-24, M.O'C: special case, checkbox to 'skipBreaks'
		if (userId != 'skipBreaks') { 
			const userName = user.split('|')[1]; // unused
			logger.trace(`user: ${userId} | ${userName}`);
			assert(userId && userName, 'Could not find both userId and userName');
			availableArray.push(Number(userId));
		}
		else {
			logger.debug('Assignments will continue past breaks!');
			stoppingForBreaks = false;
		}
	}
	
	let matchScoutingAssignments: MatchScouting[] = await utilities.find('matchscouting', 
		{org_key, event_key},
		{sort: {time: 1}}
	);
	
	const matchArray: Match[] = await utilities.find('matches', 
		{event_key, comp_level: 'qm'},
		{sort: {time: 1}}
	);
	
	let outputNotes: string[] = []; // Notes to display to the scouting lead about what went on behind the scenes
	
	// Check whether the list of match assignments matches the schedule
	let needsReGeneration = false;
	
	logger.debug('Checking for length mismatch...'); // Note: if matchScoutingAssignments is empty, this block will catch it so we don't need to check explicitly for length == 0
	if (matchScoutingAssignments.length !== matchArray.length * 6) {
		logger.warn(`Matches need re-generation due to length mismatch. matchArray * 6 = ${matchArray.length * 6}, matchScoutingAssignments = ${matchScoutingAssignments.length}`);
		// No need to write any special notes if there were no assignments to begin with.
		if (matchScoutingAssignments.length > 0) outputNotes.push('A mismatch was detected between the match schedule and the existing list of assignments, so the list of assignments has been regenerated.');
		needsReGeneration = true;
	}
	
	if (!needsReGeneration) {
		logger.debug('Checking for time and team_key mismatch...');
		// This is O(n^2) but there should rarely be more than ~120 matches (therefore ~720 matchscouting entries), so it should only take a few ms maximum.
		for (let i in matchScoutingAssignments) {
			const matchTeam = matchScoutingAssignments[i];
			const match_team_key = matchTeam.match_team_key;
			// logger.trace(`Testing ${match_team_key}`);
			
			let thisMatch; // Associated match with this matchTeam entry
			for (let match of matchArray) {
				if (match.match_number === matchTeam.match_number) {
					thisMatch = match;
					break;
				}
			}
			// If match was not found
			if (!thisMatch) {
				logger.warn(`Associated match not found for match_team_key ${match_team_key}. Regeneration needed.`);
				needsReGeneration = true;
				break;
			}
			// If times mismatch
			if (thisMatch.time !== matchTeam.time) {
				logger.warn(`Time mismatch for match_team_key ${match_team_key}. Assignment's time: ${matchTeam.time}, match's time: ${thisMatch.time}. Regeneration needed.`);
				needsReGeneration = true;
				break;
			}
			// Check to make sure this team is on the list of team keys for the match
			if (matchTeam.alliance === 'blue') {
				if (!thisMatch.alliances.blue.team_keys.includes(matchTeam.team_key)) {
					logger.warn(`Team ${matchTeam.team_key} not found in alliance BLUE for match ${thisMatch.key}. Regeneration needed.`);
					needsReGeneration = true;
					break;
				}
			}
			else {
				if (!thisMatch.alliances.red.team_keys.includes(matchTeam.team_key)) {
					logger.warn(`Team ${matchTeam.team_key} not found in alliance RED for match ${thisMatch.key}. Regeneration needed.`);
					needsReGeneration = true;
					break;
				}
			}
		}
		
		if (needsReGeneration) outputNotes.push('A change to the schedule has been detected, so the list of match assignments have been regenerated.');
	}
	
	if (needsReGeneration) {
		
		// First, generate blank match data
		logger.debug('Generating blank match data');
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
		
		// If there are none in the db, we can simply insert the new ones and call it a day
		if (matchScoutingAssignments.length === 0) {
			logger.debug('No exiting assignments; simply inserting');
			let writeResult = await utilities.insert('matchscouting', newMatchAssignmentsArray);
			logger.debug(`Inserted ${writeResult?.insertedCount} new blank matchData`);
			matchScoutingAssignments = newMatchAssignmentsArray;
		}
		// If not.....
		else {
			logger.info('There are existing assignments in the DB, so we will attempt to re-populate existing data when re-generating...');
			
			// Populate a dict of all the existing data for the match
			const matchTeamKeyToSubmissionsMap: Dict<{
				data: MatchFormData;
				actual_scorer?: ScouterRecord;
				useragent?: UserAgent;
			}> = {};
			// Note to future coders: make sure matchScoutingAssignments is not re-populated before this
			for (let matchTeam of matchScoutingAssignments) {
				if (matchTeam.data) {
					matchTeamKeyToSubmissionsMap[matchTeam.match_team_key] = {
						data: matchTeam.data,
						actual_scorer: matchTeam.actual_scorer,
						useragent: matchTeam.useragent,
					};
				}
			}
			logger.debug(`Retrieved submission data from ${Object.keys(matchTeamKeyToSubmissionsMap).length} matches`);
			
			if (Object.keys(matchTeamKeyToSubmissionsMap).length > 0)
				outputNotes.push('Existing match scouting data was detected, so it has been re-attached to the new list of assignments.');
			
			// Now, populate newMatchAssignmentsArray with the data from the old array
			for (let matchTeam of newMatchAssignmentsArray) {
				let thisSubmission = matchTeamKeyToSubmissionsMap[matchTeam.match_team_key];
				if (thisSubmission) {
					logger.trace(`Repopulating data for ${matchTeam.match_team_key}`);
					matchTeam.data = thisSubmission.data;
					// JL note: actual_scouter and useragent could be undefined, so I'd rather not add the keys unless they're defined
					if (thisSubmission.actual_scorer) matchTeam.actual_scorer = thisSubmission.actual_scorer;
					if (thisSubmission.useragent) matchTeam.useragent = thisSubmission.useragent;
					// Now, delete the key from the submissions map so we can keep track of which entries have NOT yet been repopulated into the new array
					delete matchTeamKeyToSubmissionsMap[matchTeam.match_team_key];
				}
			}
			
			let matchTeamKeysNotRestored = Object.keys(matchTeamKeyToSubmissionsMap);
			if (matchTeamKeysNotRestored.length > 0) {
				logger.warn(`There has been some match submission data that has not been restored during regeneration!!! Dumping here: ${JSON.stringify(matchTeamKeyToSubmissionsMap)}`);
				outputNotes.push('[Warning] Match submissions could not be restored for the following match_team_keys: ' + matchTeamKeysNotRestored.join(', ') + ' - Data for those match_team_keys have been deleted.');
			}
			
			logger.debug('Wiping matchscouting data and re-inserting new data');
			await utilities.remove('matchscouting', {org_key, event_key});
			let writeResult = await utilities.insert('matchscouting', newMatchAssignmentsArray);
			logger.debug(`Inserted ${writeResult?.insertedCount} new blank matchData`);
			matchScoutingAssignments = newMatchAssignmentsArray;
		}
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
	logger.trace(`matchScouts=${JSON.stringify(matchScouts)}`);

	// 2024-01-22, M.O'C: Read in the number of matches already scouted per scout
	const numPerUserList = await utilities.aggregate('matchscouting',
		[
			{ '$match': { 'org_key': org_key, 'event_key': event_key, 'data': { '$ne': null } } },
			{ '$group': { '_id': '$actual_scorer.id', 'numScouted': { '$sum': 1 } } }
		]	
	) as { _id: string, numScouted: number }[];
	// convert to a map
	const numPerUser = Object.fromEntries(numPerUserList.map(x => [x._id, x.numScouted]));
	// add the number of matches scouted to the user data
	const matchScoutsPlusScoutedCount = matchScouts.map(scout => {
		let stringId = String(scout._id);
		return {
			...scout,
			numMatchesScouted: (numPerUser[stringId] == null ? 0 : numPerUser[stringId])
		};
	});
	// re-sort the array by numMatchesScouted: -1, then by seniority: 1, then by subteam_key: 1, etc.
	matchScoutsPlusScoutedCount.sort(function(a, b) {
		if (a.numMatchesScouted == b.numMatchesScouted) {
			if (a.org_info.seniority == b.org_info.seniority) {
				if (a.org_info.subteam_key == b.org_info.subteam_key) {
					return a.name > b.name ? 1 : 1;
				}
				return a.org_info.subteam_key > b.org_info.subteam_key ? 1 : -1;
			}
			return a.org_info.seniority > b.org_info.seniority ? 1 : -1;
		}
		return a.numMatchesScouted > b.numMatchesScouted ? 1 : -1;
	});
	logger.trace(`matchScoutsPlusScoutedCount=${JSON.stringify(matchScoutsPlusScoutedCount)}`);

	logger.trace('*** Assigned + available, by seniority:');
	for (let i in matchScoutsPlusScoutedCount)
		logger.trace('member['+i+'] = ' + matchScoutsPlusScoutedCount[i].name);
	
	//
	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	//
	// 2024-01-27, M.O'C: Switch to *max* time of *resolved* matches [where alliance scores != -1]
	const timestampArray = await utilities.find('matches', { event_key: event_key, 'alliances.red.score': {$ne: -1} },{sort: {'time': -1}});

	// Avoid crashing server if all matches at an event are done
	// 2024-02-06, M.O'C: Have to change 'latestTimestamp' to be *early* UNLESS matches have been played
	let latestTimestamp = 1234;
	if (timestampArray && timestampArray[0]) {
		let latestMatch = timestampArray[0];
		latestTimestamp = latestMatch.time + 1;
	}

	// Clear 'assigned_scorer' from all unresolved team@matches
	await utilities.bulkWrite('matchscouting', 
		[{updateMany: {
			filter: { org_key, event_key, time: { $gte: latestTimestamp } }, 
			update: { $unset: { 'assigned_scorer' : '' } }
		}}]
	);
	
	// Special case for no scouters assigned: Stop the re-assigning process and render the match scouting dashboard
	if (matchScoutsPlusScoutedCount.length === 0) {
		logger.info('No available match scouts were selected; Leaving the match scouting assignments blank');
		return res.redirect('/dashboard/matches?alert=No scouters were selected, so the assignments were left blank.');
	}
	
	let comingMatches: Match[] = await utilities.find('matches', 
		{event_key: event_key, time: {$gte: latestTimestamp}},
		{sort: {time: 1}}
	);
	let lastMatchTimestamp = latestTimestamp;
	
	let matchBlockCounter = matchBlockSize;  // initialize at the max size so in the first loop iteration, it'll set up the scout list
	let scoutPointer = 0;  // start off with the 0th position
	// 2022-11-10 JL: changed scoutArray to be a list of _ids and names
	let scoutArray: ScouterRecord[] = [];  // the current set of scouts (gets regenerated every N matches)
	let scoutAvailableMap: Dict<ScouterRecord> = {};  // pool of available scouts
	let scoutAssignedList: number[] = []; // list of IDs of assigned scouters
	
	let redBlueToggle = 0;  // flips between 0 and 1, signals whether to allocate red alliance or blue alliance first

	// 2024-01-23, M.O'C: Read in the number of matches already assigned per *team*
	// to be used if the SR team has fewer than 6 availale scouts
	const numPerTeamList = await utilities.aggregate('matchscouting',
		[
			{ '$match': { 'org_key': org_key, 'event_key': event_key, 'assigned_scorer': {$ne: null} } },
			{ '$group': { '_id': '$team_key', 'numScouted': { '$sum': 1 } } }
		]	
	) as { _id: string, numScouted: number }[];
	// convert to a map
	const numPerTeam = Object.fromEntries(numPerTeamList.map(x => [x._id, x.numScouted]));
	logger.trace(`numPerTeam=${JSON.stringify(numPerTeam)}`);

	// 2024-01-23, M.O'C: Scouts per match is 6 *unless* fewer than 6 have been passed in
	let scoutsPerMatch = 6;
	if (matchScoutsPlusScoutedCount.length < 6) {
		scoutsPerMatch = matchScoutsPlusScoutedCount.length;
	}

	// 2024-03-20, M.O'C: The changes to "use latest timestamp" instead of "next unplayed timestamp" broke scheduling when you're doing the 2nd run past breaks
	let notFirstMatch: boolean = false;
	for (let matchesIdx in comingMatches) {
		const thisMatch = comingMatches[matchesIdx];
		const thisMatchKey = thisMatch.key;
		
		let teamScoutMap: Dict<ScouterRecord> = {}; // map of team->scout associations; reset for each match
		
		// Work in sets of up to <block size> matches (could be less, if "break" or end is hit)
		if (matchBlockCounter >= matchBlockSize) {
			// Pull off the next N scouts (usually 6)
			scoutArray = [];
			for (let i = 0; i < scoutsPerMatch; i++) {
				let thisScout = matchScoutsPlusScoutedCount[scoutPointer];
				if (!thisScout) {
					logger.trace('Not enough scouts!');
					break;
				}
				scoutArray.push({
					id: thisScout._id,
					name: thisScout.name,
				});
				scoutPointer++;
				if (scoutPointer >= matchScoutsPlusScoutedCount.length)
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
		
		let matchGap = 0;
		// 2024-02-17, M.O'C: Super-jank at the moment fix for scheduling
		// ..."1234" is the 'special' timestamp used when no matches are in the system yet (see above)
		if (lastMatchTimestamp != 1234) 
			matchGap = comingMatches[matchesIdx].time - lastMatchTimestamp;
		// Iterate until a "break" is found (or otherwise, if the loop is exhausted)
		// 2024-01-24, M.O'C: Might optionally not be stopping for breaks
		// 2024-03-20, M.O'C: Only check for breaks on the 2nd and later matches - 'notFirstMatch' is initially "false"
		if (stoppingForBreaks && notFirstMatch)
			if (matchGap > matchGapBreakThreshold) {
				logger.trace('matchGap=' + matchGap + '... found a break');
				break;
			}
		notFirstMatch = true;
		
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
		// 2024-01-24, M.O'C: **IF** there are <6 scouts, THEN sort by matches assigned
		// (so as to end up with an even distribution of assignments across matches)
		if (scoutsPerMatch >= 6)
			teamArray.sort(() => Math.random() - 0.5);
		else {
			for (let i = 0; i < 6; i++) {
				if (!numPerTeam[teamArray[i]])
					numPerTeam[teamArray[i]] = 0;
				logger.trace(`numPerTeam[${teamArray[i]}]=${numPerTeam[teamArray[i]]}`);
			}
			teamArray.sort(function(a, b) {
				if (numPerTeam[a] == numPerTeam[b]) {
					return Number(a.substring(3)) > Number(a.substring(3)) ? 1 : -1;
				}
				return numPerTeam[a] > numPerTeam[b] ? 1 : -1;
			});
			logger.trace(`teamArray=${JSON.stringify(teamArray)}`);
		}
		// cycle through teams and assign to the scouters, after teamArray has been shuffled
		for (let i = 0; i < scoutsPerMatch; i++) {
			let thisTeamKey = teamArray[i];
			// Grab the next available scout
			teamScoutMap[thisTeamKey] = scoutArray[i];
			numPerTeam[thisTeamKey] = numPerTeam[thisTeamKey] + 1;
		}

		// show all the team-scout assignments
		let assignmentPromisesArray = [];
		for (let teamKey in teamScoutMap) {
			if (teamScoutMap.hasOwnProperty(teamKey)) {
				// Write the assignment to the DB!
				let thisMatchTeamKey = thisMatchKey + '_' + teamKey;
				let thisScout = teamScoutMap[teamKey];
				
				// 2024-01-23, M.O'C: If there are fewer than 6 available scouts, some entries might be null
				if (thisScout != null) {
					// Save this scouter as being assigned
					let thisScoutId = thisScout.id;
					if (!scoutAssignedList.includes(thisScoutId)) 
						scoutAssignedList.push(thisScoutId);

					let thisPromise = utilities.update('matchscouting', 
						{ org_key: org_key, match_team_key : thisMatchTeamKey }, 
						{ $set: { assigned_scorer : thisScout }} 
					);
					assignmentPromisesArray.push(thisPromise);
				}
			}
		}									
		// wait for all the updates to finish
		await Promise.all(assignmentPromisesArray);
		
		// update the 'lastMatchTimestamp' so we can track until a break
		lastMatchTimestamp = comingMatches[matchesIdx].time;
	}
	
	// lastly, mark assigned scouters as assigned
	let writeResult = await utilities.bulkWrite('users', [
		
		// JL: TODO LATER AFTER WE MAKE SURE THIS DOESN'T BREAK THINGS: Set scouters NOT assigend to match scouting to event_info.assigned = false
		// {
		// 	updateMany: {
		// 		filter: {_id: {$not: {$in: scoutAssignedObjectIdList}}},
		// 		update: {$set: {'event_info.assigned': false}}
		// 	}
		// }, 
		{
			updateMany: {
				filter: {_id: {$in: scoutAssignedList}},
				update: {$set: {'event_info.assigned': true}}
			}
		}
	]);
	logger.debug(`writeResult=${JSON.stringify(writeResult)}`);

	// all done, go to the matches list
	let alert;
	if (outputNotes.length > 0) {
		alert = `Generated match assignments. Notes of what occurred during the process: \n - ${outputNotes.join('\n - ')}`;
	}
	else {
		alert = 'Generated match assignments successfully.';
	}
	
	res.redirect(`/dashboard/matches?alert=${alert}`);
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
		member2?: string,
		member3?: string
	} = JSON.parse(data);
	
	assert(selectedMembers.member1, 'Select at least one member.');
	
	logger.trace(`Selected members: ${data}`);
	
	let member1 = await utilities.findOne('users', {_id: parseInt(selectedMembers.member1), org_key}); // JL: Temporary until i fix the most recent version of utilities
	let member2;
	if (selectedMembers.member2)
		member2 = await utilities.findOne('users', {_id: parseInt(selectedMembers.member2), org_key});
	let member3;
	if (selectedMembers.member3)
		member3 = await utilities.findOne('users', {_id: parseInt(selectedMembers.member3), org_key});
	
	let idList = [member1._id]; // for bulkWrite operation
	
	let newScoutingPair: ScoutingPair = {
		org_key,
		member1: {
			id: member1._id,
			name: member1.name,
		},
	};
	if (member2) {
		idList.push(member2._id);
		newScoutingPair.member2 = {
			id: member2._id,
			name: member2.name,
		};
	}
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

	logger.debug('bulkWriteResult=' + JSON.stringify(bulkWriteResult));
	
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
	
	
	let idList = [thisPair.member1.id];
	if (thisPair.member2) idList.push(thisPair.member2.id);
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
	
	logger.debug(`writeResult=${JSON.stringify(writeResult)}`);
	
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
			logger.debug(`writeResult=${JSON.stringify(writeResult)}`);
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
	// 2024-01-27, M.O'C: Switch to *max* time of *resolved* matches [where alliance scores != -1]
	let matchDocs = await utilities.find('matches', { event_key: eventKey, 'alliances.red.score': {$ne: -1} },{sort: {'time': -1}});

	// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
	// 2024-02-06, M.O'C: Have to change 'latestTimestamp' to be *early* UNLESS matches have been played
	let latestTimestamp = 1234;
	if (matchDocs && matchDocs[0]) {
		let latestMatch = matchDocs[0];
		latestTimestamp = latestMatch.time + 1;
	}
		
	// Get the distinct list of scorers from the unresolved matches
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let scorers = await utilities.distinct('matchscouting', 'assigned_scorer', {'org_key': org_key, 'event_key': eventKey, 'time': { $gte: latestTimestamp }}) as ScouterRecord[];
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
	let swapoutID = parseInt(req.body.swapout);
	let swapinID = parseInt(req.body.swapin);
	
	if (!swapoutID || !swapinID) return res.redirect('?alert=Please select both users to swap.&type=error');
	
	logger.info(thisFuncName + 'swap out ' + swapinID + ', swap in ' + swapoutID);
	
	let swapout = await utilities.findOne('users', {_id: swapoutID});
	let swapin = await utilities.findOne('users', {_id: swapinID}) as WithDbId<User>; // JL: temporary till i fix utilities
	
	assert(swapout && swapin, new e.InternalDatabaseError('Could not find both users in database!')); // Make sure users are found in the db

	// Get the *min* time of the as-yet-unresolved matches [where alliance scores are still -1]
	// 2024-01-27, M.O'C: Switch to *max* time of *resolved* matches [where alliance scores != -1]
	let matchDocs = await utilities.find('matches', { event_key: event_key, 'alliances.red.score': {$ne: -1} },{sort: {'time': -1}});

	// 2018-03-13, M.O'C - Fixing the bug where dashboard crashes the server if all matches at an event are done
	// 2024-02-06, M.O'C: Have to change 'latestTimestamp' to be *early* UNLESS matches have been played
	let latestTimestamp = 1234;
	if (matchDocs && matchDocs[0]) {
		let latestMatch = matchDocs[0];
		latestTimestamp = latestMatch.time + 1;
	}
		
	// Do the updateMany - change instances of swapout to swapin
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	// 2023-02-07 JL: changing scouter name to ScouterRecord
	let writeResult = await utilities.bulkWrite('matchscouting', [{updateMany:{filter: { 'assigned_scorer.id': swapoutID, org_key, event_key, time: { $gte: latestTimestamp } }, 
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
		let scoutIdNumber = parseInt(scoutId);
		// find teams which have the specified scout in primary OR secondary OR tertiary
		teams1 = await utilities.find('pitscouting', {'org_key': org_key, 'event_key': event_key, data: {$exists: false}, $or: [{ 'primary.id': scoutIdNumber}, {'secondary.id': scoutId}, {'tertiary.id': scoutId}]}, { });
		// find teams which do NOT have the specified scout in primary NOR in secondary NOR in tertiary 
		teams2 = await utilities.find('pitscouting', {'org_key': org_key, 'event_key': event_key, data: {$exists: false}, 'primary.id': {$ne: scoutIdNumber}, 'secondary.id': {$ne: scoutIdNumber}, 'tertiary.id': {$ne: scoutIdNumber} }, { });
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
	let scoutingAssignedArray: number[] = [];
	
	for (let i in scoutingpairs) {
		const thisPair = scoutingpairs[i];
		logger.trace('Current pair:', thisPair);
		
		// Group of 3
		if (thisPair.member3) {
			assert(thisPair.member2, 'If member3 is defined, then member2 must also be defined!');
			
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
		// group of 2
		else if (thisPair.member2) {
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
		// group of 1
		else {
			let set1: PitScoutingSet = {
				primary: thisPair.member1
			};
			primaryAndBackupMap[String(set1.primary.id)] = set1;
			scoutingAssignedArray.push(set1.primary.id);
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