import express from 'express';
import bcrypt from 'bcryptjs';
import { getLogger } from 'log4js';
import wrap from '../../helpers/express-async-handler';
import utilities from '@firstteam102/scoutradioz-utilities';
import Permissions from '../../helpers/permissions';
import e, { assert } from '@firstteam102/http-errors';
import type { Match, MatchScouting, OrgSubteam, PitScouting, ScoutingPair, Team, TeamKey, User} from '@firstteam102/scoutradioz-types';

const router = express.Router();
const logger = getLogger('assignments');

router.all('/*', wrap(async (req, res, next) => {
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate(Permissions.ACCESS_TEAM_ADMIN)) {
		next();
	}
}));

/**
 * Admin page to control and assign pairs of students for scouting. TODO REVAMP
 * @url /manage/scoutingpairs/
 * @views /manage/scoutingpairs
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
	dbPromises.push(utilities.find('matchscouting', {org_key: org_key, event_key: event_key, data: {$ne: null}}));
	dbPromises.push(utilities.find('pitscouting', {org_key: org_key, event_key: event_key, data: {$ne: null}}));
	
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
				title: 'Scouting Assignments',
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
	
	// assert(thisUser.org.config.members.subteams, `Could not get list of subteams from org config: ${org_key}`);
	// const subteams = thisUser.org.config.members.subteams;
	
	// Find the number of match assignments WITH data
	
	//Any team members that are not on a subteam, but are unassigned and present.
	const available: User[] = await utilities.find('users', 
		{'event_info.assigned': false, 'event_info.present': true, org_key: org_key, visible: true}, 
		{sort: {'name': 1}}
	);
	
	const matchAssignments = await utilities.find('matchscouting', {org_key: org_key, event_key: event_key, data: {$ne: null}});
	const matchAssignmentsCount = matchAssignments.length;
	
	logger.trace('Awaiting all db requests');
	
	res.render('./manage/assignments/matches', {
		title: 'Match Scouting Assignments',
		available: available,
		matchAssignmentsCount: matchAssignmentsCount
	});
}));

router.get('/matches/generate', wrap(async (req, res) => {
	
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
	
	const availableArray = [];
	logger.trace('*** Tagged as available:');
	for(let user in req.body) {
		const userId = user.split('|')[0];
		const userName = user.split('|')[1];
		logger.trace(`user: ${userId} | ${userName}`);
		assert(userId && userName, 'Could not find both userId and userName');
		availableArray.push({user_id: userId, name: userName});
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
	
	
}));

module.exports = router;