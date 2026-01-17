import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../../helpers/express-async-handler';
import utilities from 'scoutradioz-utilities';
import Permissions from '../../helpers/permissions';
import { matchData as matchDataHelper } from 'scoutradioz-helpers';
import type { Match, Ranking } from 'scoutradioz-types';

const router = express.Router();
const logger = getLogger('currentevent');

router.all('/*', wrap(async (req, res, next) => {
	logger.removeContext('funcName');
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate (Permissions.ACCESS_TEAM_ADMIN)) {
		next();
	}
}));

router.get('/matches', wrap(async (req, res) => {
	logger.addContext('funcName', 'matches[get]');
	logger.info('ENTER');
	
	let eventKey = req.event.key;
		
	// Read matches from DB for specified event
	let matches: Match[] = await utilities.find('matches', {'event_key': eventKey}, {sort: {'time': 1}});
	
	let orgsAtThisEvent = await utilities.find('orgs', {event_key: eventKey});
		
	res.render('./manage/currentevent/matches', {
		title: 'Matches',
		matches: matches,
		numOrgsAtThisEvent: orgsAtThisEvent.length
	});
}));

router.get('/getcurrentteams', wrap(async (req, res) => {
	logger.addContext('funcName', 'getcurrentteams[get]');
	logger.info('ENTER');

	// 2020-02-09, M.O'C: Refactoring to just update the team_keys for the current event
	let event_key = req.event.key;

	const doForce = (req.query.force === 'true'); // just in case we actually wanna force it

	// Refresh the teams list from TBA
	let eventTeamsUrl = `event/${event_key}/teams/keys`;
	let thisTeamKeys = await utilities.requestTheBlueAlliance(eventTeamsUrl);
	
	// 2023-02-20 JL: Added check to make sure TBA sends back an array
	if (!Array.isArray(thisTeamKeys)) {
		logger.error('TBA didn\'t send back an array!! They sent: ', thisTeamKeys);
		return res.redirect('/manage?alert=Request from The Blue Alliance failed.&type=error');
	}
	
	// 2023-02-20 JL: Added check to not override team keys if TBA sends back none
	if (req.teams && req.teams.length > 0 && thisTeamKeys.length === 0 && !doForce) {
		logger.info('TBA sent back a list of 0 teams and a nonzero amount of teams were detected in the database. Not updating.');
		return res.redirect('/manage?alert=The Blue Alliance sent back a list of 0 teams, but we found a (potentially manually-entered) list of teams in the database. Not overriding.');
	}
	
	await utilities.update( 'events', {'key': event_key}, {$set: {'team_keys': thisTeamKeys}} );

	res.redirect('/manage?alert=Updated team keys for the current event successfully.');
	
}));

router.post('/resetmatches', wrap(async (req, res) => {
	logger.addContext('funcName', 'resetmatches[post]');
	logger.info('ENTER');
	
	// Issue #45 
	// if (!await req.authenticate(Permissions.ACCESS_GLOBAL_ADMIN)) {
	// 	return res.redirect('/manage/currentevent/matches?alert=Unauthorized to modify TBA data.');
	// }
	
	let eventKey = req.event.key;
	
	// update all matches - set 'actualtime' to null/"", and team scores to -1
	let writeResult = await utilities.bulkWrite('matches', [{updateMany:{
		filter: {event_key: eventKey}, 
		update: {$set: {actual_time : '', winning_alliance : '', 'alliances.blue.score': -1, 'alliances.red.score': -1 }}}
	}]);
	logger.debug(`writeResult=${JSON.stringify(writeResult)}`);
	
	res.redirect('/manage/currentevent/matches?alert=Reset matches successfully.');
}));

router.post('/resetmatch', wrap(async (req, res) => {
	logger.addContext('funcName', 'resetmatch[post]');
	
	let matchKey = req.body.matchId;
	
	if (!matchKey) return res.redirect('/manage/currentevent/matches?alert=Match not specified.&type=warn');
	logger.info(`Resetting match ${matchKey}`);
	
	let writeResult = await utilities.update('matches', 
		{key: matchKey}, 
		{$set: { actual_time: '', winning_alliance: '', 'alliances.blue.score': -1, 'alliances.red.score': -1 }}
	);
	logger.debug(`writeResult=${JSON.stringify(writeResult)}`);
	
	res.redirect('/manage/currentevent/matches');
}));

router.post('/updatematch', wrap(async (req, res) => {
	logger.addContext('funcName', 'updatematch[post]');
	logger.info('ENTER');
	
	// Issue #45 
	// if (!await req.authenticate(Permissions.ACCESS_GLOBAL_ADMIN)) {
	// 	return res.redirect('/manage/currentevent/matches?alert=Unauthorized to modify TBA data.');
	// }
	
	let matchId = req.body.matchId;

	let event_year = req.event.year;
	let event_key = req.event.key;
	let org_key = req._user.org_key;
		
	let eventKey = req.event.key;
	
	// While we're here - Get the latest ranking (& OPR data...? maybe not?)
	// https://www.thebluealliance.com/api/v3/event/2018njfla/rankings
	// https://www.thebluealliance.com/api/v3/event/2018njfla/oprs (?)

	// Synchronize the event data such as rankings, OPR, Statbotics, etc.
	await syncEventData(eventKey);

	// Delete the matching match record
	await utilities.remove('matches', {'key': matchId});

	// Reload the match data from TBA
	let url = 'match/' + matchId;
	logger.debug('url=' + url);
	let match = await utilities.requestTheBlueAlliance(url);
	
	// Now, insert the new object
	await utilities.insert('matches', match);
	//2020-03-29 JL: Removed the part where matches are re-pulled from DB because it was unnecessary
	//
	// 2019-03-21, M.O'C: Adding in recalculation of aggregation data
	//
	logger.debug('About to start in on updating min/maxes of agg data');
	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	//var scorelayout = await utilities.find("scoringlayout", { "year": event_year }, {sort: {"order": 1}});

	// call out to aggrange recalculator
	await matchDataHelper.calculateAndStoreAggRanges(org_key, event_year, event_key);
	
	//and we're done!
	if (match && !match.score_breakdown) res.redirect('/manage/currentevent/matches?alert=Score not found for this match.&type=warn');
	else res.redirect('/manage/currentevent/matches');
}));

router.post('/updatematches', wrap(async (req, res) => {
	logger.addContext('funcName', 'updatematches[post]');
	logger.info('ENTER');
	
	// Issue #45 
	// if (!await req.authenticate(Permissions.ACCESS_GLOBAL_ADMIN)) {
	// 	return res.redirect('/manage/currentevent/matches?alert=Unauthorized to modify TBA data.');
	// }
	
	//var matchId = req.body.matchId;
	let eventKey = req.event.key;
	let event_year = req.event.year;
	let org_key = req._user.org_key;

	// While we're here - Get the latest ranking (& OPR data...? maybe not?)
	// https://www.thebluealliance.com/api/v3/event/2018njfla/rankings
	// https://www.thebluealliance.com/api/v3/event/2018njfla/oprs (?)

	// Synchronize the event data such as rankings, OPR, Statbotics, etc.
	await syncEventData(eventKey);

	// Get matches data from TBA
	let url = 'event/' + eventKey + '/matches';
	logger.debug('url=' + url);
	let matchData = await utilities.requestTheBlueAlliance(url);
	let arrayLength = matchData.length;
	if (arrayLength == null) {
		logger.debug('Whoops, there was an error!');
		logger.debug('data=' + matchData);
		
		res.redirect('/manage/currentevent/matches?alert=An error occurred. arrayLength==null.&alertType=error');
	}
	else {
		logger.debug('Found ' + arrayLength + ' data for event ' + eventKey);
		
		// First delete existing match data for the given event
		await utilities.remove('matches', {'event_key': eventKey});
		// Now, insert the new data
		await utilities.insert('matches', matchData);
		// Then read it back in order
		//var matches = await utilities.find("matches", {"event_key": eventKey},{sort: {"time": 1}});
			
		// call out to aggrange recalculator
		await matchDataHelper.calculateAndStoreAggRanges(org_key, event_year, eventKey);
		
		if (arrayLength == 0) res.redirect('/manage/currentevent/matches?alert=Match data not found.&type=warn');
		else res.redirect('/manage/currentevent/matches');
	}
}));

export default router;

// 2026-01-16, M.O'C: Function to sync event data such as rankings, OPR, Statbotics, etc.
async function syncEventData(eventKey: string) {
	//// Simultaneous pulls
	let eventDataPromises = [];

	let rankingUrl = 'event/' + eventKey + '/rankings';
	logger.debug('rankingUrl=' + rankingUrl);
	let rankingPromise = utilities.requestTheBlueAlliance(rankingUrl);
	eventDataPromises.push(rankingPromise);

	let oprUrl = 'event/' + eventKey + '/oprs';
	logger.debug('oprUrl=' + oprUrl);
	let oprPromise = utilities.requestTheBlueAlliance(oprUrl);
	eventDataPromises.push(oprPromise);

	let coprUrl = 'event/' + eventKey + '/coprs';
	logger.debug('coprUrl=' + coprUrl);
	let coprPromise = utilities.requestTheBlueAlliance(coprUrl);
	eventDataPromises.push(coprPromise);

	// wait for all the pulls to finish
	let eventData = await Promise.all(eventDataPromises);

	// extract the various data
	let rankinfo = eventData[0]; 
	let oprInfo = eventData[1];
	let coprInfo = eventData[2];
	
	//// Rankings from TBA
	let rankArr: Ranking[] = [];
	if (rankinfo && rankinfo.rankings && rankinfo.rankings.length > 0) {
		// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings'; enrich with event_key 
		let thisRankings = rankinfo.rankings;
		for (let thisRank of thisRankings) {
			thisRank['event_key'] = eventKey;
			rankArr.push(thisRank);
		}
	}
	//logger.debug('rankArr=' + JSON.stringify(rankArr));

	let rankMap: Dict<Ranking> = {};
	for (let rankIdx = 0; rankIdx < rankArr.length; rankIdx++) {
		//logger.debug('rankIdx=' + rankIdx + ', team_key=' + rankings[rankIdx].team_key + ', rank=' + rankings[rankIdx].rank);
		rankMap[rankArr[rankIdx].team_key] = rankArr[rankIdx];
	}

	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
	// Delete the current rankings
	//await utilities.remove("currentrankings", {});
	await utilities.remove('rankings', {'event_key': eventKey});
	// Insert into DB
	//await utilities.insert("currentrankings", rankArr);
	await utilities.insert('rankings', rankArr);

	// OPR & cOPR
	//logger.debug('oprInfo=' + JSON.stringify(oprInfo));
	//logger.debug('coprInfo=' + JSON.stringify(coprInfo));

	let teamMap: Dict<{}> = {};
	// process the OPR first
	if (oprInfo) {
		let oprKeys = Object.keys(oprInfo);
		logger.debug(`Processing OPRs, oprKeys=${JSON.stringify(oprKeys)}`);
		for (let oprIdx = 0; oprIdx < oprKeys.length; oprIdx++) {
			let thisOpr = oprKeys[oprIdx];
			// process key name - drop plural, uppercase first letter, prefix 'tba'
			thisOpr = thisOpr.slice(0, -1);
			thisOpr = thisOpr.charAt(0).toUpperCase() + thisOpr.slice(1);
			thisOpr = 'tba' + thisOpr;
			//logger.debug(`Processing OPR type ${thisOpr}`);

			let teamKeys = Object.keys(oprInfo[oprKeys[oprIdx]]);
			if (teamKeys.length > 0) {
				let teamData = oprInfo[oprKeys[oprIdx]];
				//logger.debug(`teamData=${JSON.stringify(teamData)}`);
				for (let teamIdx = 0; teamIdx < teamKeys.length; teamIdx++) {
					let thisTeamKey = teamKeys[teamIdx];
					let thisValue = teamData[thisTeamKey];
					// add a team to the map if not already present
					if (!teamMap[thisTeamKey]) teamMap[thisTeamKey] = {
						year: parseInt(eventKey.substring(0,4)),
						event_key: eventKey,
						team_key: thisTeamKey,
						type: 'tba',
						data: {}
					};
					teamMap[thisTeamKey]['data'][thisOpr] = thisValue;
				}
			}
		}
	}

	// cOPR next
	if (coprInfo) {
		let coprKeys = Object.keys(coprInfo);
		logger.debug(`Processing cOPRs, coprKeys=${JSON.stringify(coprKeys)}`);
		for (let coprIdx = 0; coprIdx < coprKeys.length; coprIdx++) {
			let thisCOpr = coprKeys[coprIdx];
			// process key name - remove spaces, uppercase first letter, prefix 'tba'
			thisCOpr = thisCOpr.replaceAll(' ', '');
			thisCOpr = thisCOpr.charAt(0).toUpperCase() + thisCOpr.slice(1);
			thisCOpr = 'tba' + thisCOpr;
			//logger.debug(`Processing OPR type ${thisCOpr}`);

			let teamKeys = Object.keys(coprInfo[coprKeys[coprIdx]]);
			if (teamKeys.length > 0) {
				let teamData = coprInfo[coprKeys[coprIdx]];
				//logger.debug(`teamData=${JSON.stringify(teamData)}`);
				for (let teamIdx = 0; teamIdx < teamKeys.length; teamIdx++) {
					let thisTeamKey = teamKeys[teamIdx];
					let thisValue = teamData[thisTeamKey];
					// add a team to the map if not already present
					if (!teamMap[thisTeamKey]) teamMap[thisTeamKey] = {
						year: parseInt(eventKey.substring(0,4)),
						event_key: eventKey,
						team_key: thisTeamKey,
						type: 'tba',
						data: {}
					};
					teamMap[thisTeamKey]['data'][thisCOpr] = thisValue;
				}
			}
		}
	}

	// sanity check
	//logger.debug(`After OPR processing, teamMap=${JSON.stringify(teamMap)}`);
}