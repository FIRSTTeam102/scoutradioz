import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../helpers/express-async-handler';
import utilities from '@firstteam102/scoutradioz-utilities';
import Permissions from '../helpers/permissions';
import { matchData as matchDataHelper, upload as uploadHelper } from '@firstteam102/scoutradioz-helpers';
import e from '@firstteam102/http-errors';
import type { MongoDocument } from '@firstteam102/scoutradioz-utilities';
import type { AggRange, Event, Layout, Match, MatchFormData, MatchScouting, PitScouting, Ranking, RankingPoints, Team } from '@firstteam102/scoutradioz-types';

const router = express.Router();
const logger = getLogger('reports');

router.all('/*', wrap(async (req, res, next) => {
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	//Require viewer-level authentication for every method in this route.
	if (await req.authenticate (Permissions.ACCESS_VIEWER)) {
		next();
	}
}));

router.get('/', wrap(async (req, res) => {
	
	// TODO - we should probaby make an index for reports?
	res.redirect('/?alert=No index page for /reports/');
}));

router.get('/rankings', wrap(async (req, res) => {
	logger.addContext('funcName', 'rankings[get]');
	logger.info('ENTER');

	let eventKey = req.event.key;

	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
	let rankings: Ranking[] = await utilities.find('rankings', 
		{'event_key': eventKey}, 
		{sort:{rank: 1}}
	);

	res.render('./reports/rankings', {
		title: 'Rankings',
		rankings: rankings
	});
}));

router.get('/finishedmatches', wrap(async (req, res) => {
	logger.addContext('funcName', 'finishedmatches[get]');
	logger.info('ENTER');
	let year = req.event.year;
	
	// for later querying by event_key
	let eventKey = req.event.key;
	logger.debug('event_key=' + eventKey);

	// Match history info
	let matches: Match[] = await utilities.find('matches', {'alliances.red.score': { $ne: -1}, 'event_key' : eventKey}, {sort: {time: -1}});

	// Ranking point info
	let rankingPoints: RankingPoints[] = await utilities.findOne('rankingpoints', {year: year});
	//logger.debug("rankingPoints=" + JSON.stringify(rankingPoints));
	
	//logger.debug('matches=' + JSON.stringify(matches));
	res.render('./reports/finishedmatches', {
		title: 'Completed Matches',
		matches: matches,
		rankingPoints: rankingPoints
	});
}));

router.get('/upcoming', wrap(async (req, res) => {
	logger.addContext('funcName', 'upcoming[get]');
	logger.info('ENTER');

	let eventKey = req.event.key;
	let teamKey = 'all';
	if (typeof req.query.team_key === 'string') teamKey = req.query.team_key;
	// 2020-03-21 JL: Changed query.team to query.team_key
	// 2022-03-20, M.O'C: Need org_key for predictive metrics
	let orgKey = req._user.org_key;

	// use helper function
	let upcomingData = await matchDataHelper.getUpcomingMatchData(eventKey, teamKey, orgKey);
	
	let matches = upcomingData.matches;
	let teamRanks = upcomingData.teamRanks;
	//var teamNumbers = upcomingData.teamNumbers;
	
	// 2020-03-21 JL: Removed teamNumbers from locals (already set in usefunctions)
	//	+ renamed team to teamKey
	res.render('./reports/upcoming', {
		title: 'Upcoming',
		matches: matches,
		teamRanks: teamRanks,
		teamKey: teamKey
	});
}));

router.get('/teamintel', wrap(async (req, res) => {
	logger.addContext('funcName', 'teamintel[get]');
	logger.info('ENTER');
	
	let eventKey = req.event.key;
	let eventYear = req.event.year;
	let orgKey = req._user.org_key;
	
	logger.debug('event_year=' + eventYear);
	
	let teamKey = req.query.team_key;
	let expandSection = req.query.expand; // 2022-03-12 JL: adding a way to auto expand a section
	if (typeof teamKey !== 'string') throw new e.UserError('Please specify one team_key.');
	
	logger.debug('teamKey=' + teamKey);
	
	
	// Team details
	// 2020-02-09, M.O'C: Adjusted "currentteams" to "teams"
	let team: Team = await utilities.findOne('teams', 
		{ 'key' : teamKey }, {},
		{allowCache: true}
	);
	
	if (!team) throw new e.UserError(`Team ${teamKey.substring(3)} does not exist or did not participate in this event.`);

	// Extract the current team ranking, etc.
	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings'
	let ranking: Ranking = await utilities.findOne('rankings', 
		{'event_key': eventKey, 'team_key': teamKey}, 
		{sort:{rank: 1}}
	);
	
	// Pit scouting info
	// 2020-02-11, M.O'C: Renaming "scoutingdata" to "pitscouting", adding "org_key": org_key, 
	let pitFind: PitScouting = await utilities.findOne('pitscouting', 
		{ 'org_key': orgKey, 'event_key' : eventKey, 'team_key' : teamKey }
	);
	let pitData = null;
	let pitData1 = null;
	if (pitFind)
		pitData = pitFind.data;
	// if (pitFind.data1)
	// 	pitData1 = pitFind.data1;
	
	// Pit data layout
	// 2020-02-11, M.O'C: Combined "scoutinglayout" into "layout" with an org_key & the type "pitscouting"
	let layout: Layout[] = await utilities.find('layout', 
		{org_key: orgKey, year: eventYear, form_type: 'pitscouting'}, 
		{sort: {'order': 1}},
		{allowCache: true}
	);
	
	logger.trace('layout=' + JSON.stringify(layout));
	
	// Pull in individual scouting data for this team, for this event, to enhance the match data
	logger.debug('Pulling scoring data for teamKey=' + teamKey + ',event_key=' + eventKey);
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let matchDataFind: MatchScouting[] = await utilities.find('matchscouting', {'org_key': orgKey, 'team_key': teamKey, 'event_key': eventKey}, {});
	// Build a map of match_key->data
	let matchDataMap: Dict<MatchFormData> = {};
	if (matchDataFind && matchDataFind.length > 0) {
		for (let mDMidx = 0; mDMidx < matchDataFind.length; mDMidx++) {
			let thisTeamMatch = matchDataFind[mDMidx];
			//logger.debug('Match scouting data for thisTeamMatch.match_key=' + thisTeamMatch.match_key);
			if (thisTeamMatch.data) {
				//logger.debug('Adding data to map');
				matchDataMap[thisTeamMatch.match_key] = thisTeamMatch.data;
			}
		}
	}
	
	// Match history info
	let matches: Match[] = await utilities.find('matches', 
		{'alliances.red.score': { $ne: -1}, 'event_key' : eventKey, 
			$or: [{'alliances.blue.team_keys': teamKey}, {'alliances.red.team_keys': teamKey}]}, 
		{sort: {time: -1}}
	);
	if (matches && matches.length > 0) {
		for (let matchesIdx = 0; matchesIdx < matches.length; matchesIdx++) {
			//logger.debug('For match ' + matches[matchesIdx].key);
			let thisScoreData = matchDataMap[matches[matchesIdx].key];
			if (thisScoreData) {
				//logger.debug('Enhancing match #' + matchesIdx + ': match_key=' + matches[matchesIdx].match_key + ', thisScoreData=' + JSON.stringify(thisScoreData));
				matches[matchesIdx].scoringdata = thisScoreData;
			}
		}
	}
	logger.trace('matches=' + JSON.stringify(matches));

	// Ranking point info
	let rankingPoints: RankingPoints[] = await utilities.findOne('rankingpoints', {year: eventYear});

	// Match data layout - use to build dynamic Mongo aggregation query
	// db.scoringdata.aggregate( [ 
	// { $match : { "data":{$exists:true}, "event_key": "2018njfla", "team_key": "frc303" } }, 
	// { $group : { _id: "$team_key",
	// "teleScaleMIN": {$min: "$data.teleScale"},
	// "teleScaleAVG": {$avg: "$data.teleScale"},
	// "teleScaleMAX": {$max: "$data.teleScale"}
	//  } }
	// ] );	
	
	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	//var cookie_key = org_key + "_" + event_year + "_cols";
	//var colCookie = req.cookies[cookie_key];
	//var scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);
	// 2020-03-07, M.O'C: Disabled filtered columns for this report
	let scorelayout: Layout[] = await utilities.find('layout', 
		{org_key: orgKey, year: eventYear, form_type: 'matchscouting'}, 
		{sort: {'order': 1}},
		{allowCache: true}
	);

	let aggQuery = [];
	aggQuery.push({ $match : { 'data':{$exists:true}, 'org_key': orgKey, 'event_key': eventKey, 'team_key': teamKey } });

	// M.O'C, 2022-03-38: Replacing $avg with $expMovingAvg
	//get the alpha from the process.env
	if (!process.env.EMA_ALPHA) throw new e.InternalServerError('EMA_ALPHA not defined');
	let emaAlpha = parseFloat(process.env.EMA_ALPHA);
	//initialize setWindowFieldsClause
	let setWindowFieldsClause: MongoDocument = {};
	setWindowFieldsClause['partitionBy'] = '$team_key';
	let sortField: MongoDocument = {};
	sortField['time'] = 1;
	setWindowFieldsClause['sortBy'] = sortField;
	let outputClause: MongoDocument = {};
	//iterate through scoringlayout
	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		//pull this layout element from score layout
		let thisLayout = scorelayout[scoreIdx];
		thisLayout.key = thisLayout.id;
		scorelayout[scoreIdx] = thisLayout;
		//if it is a valid data type, add this layout's ID to groupClause
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			let thisEMAclause: MongoDocument = {};
			let thisEMAinner: MongoDocument = {};
			thisEMAinner['alpha'] = emaAlpha;
			thisEMAinner['input'] = '$data.' + thisLayout.id;
			thisEMAclause['$expMovingAvg'] = thisEMAinner;
			outputClause[thisLayout.id + 'EMA'] = thisEMAclause;
		}
	}
	setWindowFieldsClause['output'] = outputClause;
	logger.debug('setWindowFieldsClause=' + JSON.stringify(setWindowFieldsClause));
	aggQuery.push({$setWindowFields: setWindowFieldsClause});
	
	let groupClause: MongoDocument = {};
	groupClause['_id'] = '$team_key';

	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		let thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			//logger.debug('thisLayout.type=' + thisLayout.type + ', thisLayout.id=' + thisLayout.id);
			groupClause[thisLayout.id + 'MIN'] = {$min: '$data.' + thisLayout.id};
			// 2022-03-28, M.O'C: Replacing flat $avg with the exponential moving average
			//groupClause[thisLayout.id + 'AVG'] = {$avg: '$data.' + thisLayout.id}; 
			groupClause[thisLayout.id + 'AVG'] = {$last: '$' + thisLayout.id + 'EMA'};
			groupClause[thisLayout.id + 'VAR'] = {$stdDevSamp: '$data.' + thisLayout.id};
			groupClause[thisLayout.id + 'MAX'] = {$max: '$data.' + thisLayout.id};
		}
	}
	aggQuery.push({ $group: groupClause });
	//logger.debug('aggQuery=' + JSON.stringify(aggQuery));

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let aggFind = await utilities.aggregate('matchscouting', aggQuery);
	let aggresult: MongoDocument = {};
	if (aggFind && aggFind[0])
		aggresult = aggFind[0];
	//logger.debug('aggresult=' + JSON.stringify(aggresult));

	// Unspool single row of aggregate results into tabular form
	let aggTable = [];
	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		let thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			let aggRow: MongoDocument = {};
			aggRow['key'] = thisLayout.id;
			
			// Recompute VAR first = StdDev/Mean
			aggRow['var'] = aggRow['var'] / (aggRow['avg'] + 0.001);

			aggRow['min'] = (Math.round(aggresult[thisLayout.id + 'MIN'] * 10)/10).toFixed(1);
			aggRow['avg'] = (Math.round(aggresult[thisLayout.id + 'AVG'] * 10)/10).toFixed(1);
			aggRow['var'] = (Math.round(aggresult[thisLayout.id + 'VAR'] * 10)/10).toFixed(1);
			aggRow['max'] = (Math.round(aggresult[thisLayout.id + 'MAX'] * 10)/10).toFixed(1);
			aggTable.push(aggRow);
		}
	}
	//logger.debug('aggTable=' + JSON.stringify(aggTable));
	//logger.debug('pitData=' + JSON.stringify(pitData));
	//logger.debug('pitData1=' + JSON.stringify(pitData1));

	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	let currentAggRanges: AggRange[] = await utilities.find('aggranges', {'org_key': orgKey, 'event_key': eventKey});
	
	const images = await uploadHelper.findTeamImages(orgKey, eventYear, teamKey);
	
	res.render('./reports/teamintel', {
		title: 'Intel: Team ' + teamKey.substring(3),
		team: team,
		ranking: ranking,
		data: pitData,
		data1: pitData1,
		layout: layout,
		scorelayout: scorelayout,
		aggdata: aggTable,
		currentAggRanges: currentAggRanges,
		matches: matches,
		matchDataHelper: matchDataHelper,
		images: images,
		rankingPoints: rankingPoints,
		expandSection: expandSection
	});
}));

router.get('/teamintelhistory', wrap(async (req, res) => {
	logger.addContext('funcName', 'teamintelhistory[get]');
	logger.info('ENTER');
	
	let orgKey = req._user.org_key;
	// 2020-02-21, M.O'C: Fixed to be event year
	let eventYear = req.event.year;
	// need timestamp at 00:00 on Jan 1 for match querying - looking for matches where time > Jan 1. {year}
	let yearString = eventYear + '-01-01T00:00:00';
	let yearInt = new Date(yearString).getTime() / 1000;
	
	let teamKey = req.query.team_key;
	if (typeof teamKey !== 'string') throw new e.UserError('Please specify one team_key.');
	logger.debug('teamKey=' + teamKey);
	
	// Team details
	let team: Team = await utilities.findOne('teams', 
		{key : teamKey}, {},
		{allowCache: true}
	);
	if(!team) throw new e.UserError(`Team ${teamKey.substring(3)} does not exist.`);
	
	//logger.debug('team=' + JSON.stringify(team));

	// Pull in ALL individual scouting data for this team, for this event, to enhance the match data
	logger.debug('Pulling scoring data for teamKey=' + teamKey);
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let matchDataFind: MatchScouting[] = await utilities.find('matchscouting', {'org_key': orgKey, 'team_key': teamKey, 'year': eventYear}, {});
	// Build a map of match_key->data
	let matchDataMap: Dict<MatchFormData> = {};
	if (matchDataFind && matchDataFind.length > 0) {
		for (let mDMidx = 0; mDMidx < matchDataFind.length; mDMidx++) {
			let thisTeamMatch = matchDataFind[mDMidx];
			//logger.debug('Match scouting data for thisTeamMatch.match_key=' + thisTeamMatch.match_key);
			if (thisTeamMatch.data) {
				//logger.debug('Adding data to map');
				matchDataMap[thisTeamMatch.match_key] = thisTeamMatch.data;
			}
		}
	}

	// ALL Match history info
	let matches: Match[] = await utilities.find('matches', 
		{'alliances.red.score': { $ne: -1}, 'time': { $gt: yearInt}, 
			$or: [{'alliances.blue.team_keys': teamKey}, {'alliances.red.team_keys': teamKey}]}, 
		{sort: {time: -1}}
	);
	let eventKeys: Dict<boolean> = {}, eventKeysArray = [];
	
	if (matches && matches.length > 0) {
		for (let match of matches) {
			//logger.debug('For match ' + matches[matchesIdx].key);
			let thisScoreData = matchDataMap[match.key];
			if (thisScoreData) {
				//logger.debug('Enhancing match #' + matchesIdx + ': match_key=' + matches[matchesIdx].match_key + ', thisScoreData=' + JSON.stringify(thisScoreData));
				match.scoringdata = thisScoreData;
			}
			// 2020-03-09 JL: get list of all events that these matches contain
			if (!eventKeys[match.event_key]) {
				eventKeys[match.event_key] = true;
			}
		}
	}
	// 2020-03-09 JL: Teamintelhistory previous matches section used to show event key.
	//		Edited to show event name instead.
	//eslint-disable-next-line
	for (var key in eventKeys) {
		eventKeysArray.push(key);
	}
	let events: Event[] = await utilities.find('events', 
		{key: {$in: eventKeysArray}}, {},
		{allowCache: true}
	);
	let eventInfos: Dict<{year: number, name: string}> = {};
	for (let event of events){
		eventInfos[event.key] = {
			year: event.year,
			name: event.name
		};
	}
	
	// Ranking point info
	let rankingPoints: RankingPoints = await utilities.findOne('rankingpoints', {year: eventYear});

	// Match data layout - use to build dynamic Mongo aggregation query
	// db.scoringdata.aggregate( [ 
	// { $match : { "data":{$exists:true}, "team_key": "frc303" } },    <- No event; avg across ALL events
	// { $group : { _id: "$team_key",
	// "teleScaleMIN": {$min: "$data.teleScale"},
	// "teleScaleAVG": {$avg: "$data.teleScale"},
	// "teleScaleMAX": {$max: "$data.teleScale"}
	//  } }
	// ] );

	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	let cookie_key = orgKey + '_' + eventYear + '_cols';
	let colCookie = req.cookies[cookie_key];
	let scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(orgKey, eventYear, colCookie);

	let aggQuery = [];
	aggQuery.push({ $match : { 'data':{$exists:true}, 'org_key': orgKey, 'team_key': teamKey, 'year': eventYear } });

	// M.O'C, 2022-03-38: Replacing $avg with $expMovingAvg
	//get the alpha from the process.env
	if (!process.env.EMA_ALPHA) throw new e.InternalServerError('EMA_ALPHA not defined');
	let emaAlpha = parseFloat(process.env.EMA_ALPHA);
	//initialize setWindowFieldsClause
	let setWindowFieldsClause: MongoDocument = {};
	setWindowFieldsClause['partitionBy'] = '$team_key';
	let sortField: MongoDocument = {};
	sortField['time'] = 1;
	setWindowFieldsClause['sortBy'] = sortField;
	let outputClause: MongoDocument = {};
	//iterate through scoringlayout
	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		//pull this layout element from score layout
		let thisLayout = scorelayout[scoreIdx];
		thisLayout.key = thisLayout.id;
		scorelayout[scoreIdx] = thisLayout;
		//if it is a valid data type, add this layout's ID to groupClause
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			let thisEMAclause: MongoDocument = {};
			let thisEMAinner: MongoDocument = {};
			thisEMAinner['alpha'] = emaAlpha;
			thisEMAinner['input'] = '$data.' + thisLayout.id;
			thisEMAclause['$expMovingAvg'] = thisEMAinner;
			outputClause[thisLayout.id + 'EMA'] = thisEMAclause;
		}
	}
	setWindowFieldsClause['output'] = outputClause;
	logger.debug('setWindowFieldsClause=' + JSON.stringify(setWindowFieldsClause));
	aggQuery.push({$setWindowFields: setWindowFieldsClause});
	
	let groupClause: MongoDocument = {};
	groupClause['_id'] = '$team_key';

	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		let thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			//logger.debug('thisLayout.type=' + thisLayout.type + ', thisLayout.id=' + thisLayout.id);
			groupClause[thisLayout.id + 'MIN'] = {$min: '$data.' + thisLayout.id};
			// 2022-03-28, M.O'C: Replacing flat $avg with the exponential moving average
			//groupClause[thisLayout.id + 'AVG'] = {$avg: '$data.' + thisLayout.id}; 
			groupClause[thisLayout.id + 'AVG'] = {$last: '$' + thisLayout.id + 'EMA'};
			groupClause[thisLayout.id + 'VAR'] = {$stdDevSamp: '$data.' + thisLayout.id};
			groupClause[thisLayout.id + 'MAX'] = {$max: '$data.' + thisLayout.id};
		}
	}
	aggQuery.push({ $group: groupClause });
	//logger.debug('aggQuery=' + JSON.stringify(aggQuery));

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let aggFind = await utilities.aggregate('matchscouting', aggQuery);
	let aggresult: MongoDocument = {};
	if (aggFind && aggFind[0])
		aggresult = aggFind[0];
	//logger.debug('aggresult=' + JSON.stringify(aggresult));

	// Unspool single row of aggregate results into tabular form
	let aggTable = [];
	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		let thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			let aggRow: MongoDocument = {};
			aggRow['key'] = thisLayout.id;
			
			// Recompute VAR first = StdDev/Mean
			aggRow['var'] = aggRow['var'] / (aggRow['avg'] + 0.001);

			aggRow['min'] = (Math.round(aggresult[thisLayout.id + 'MIN'] * 10)/10).toFixed(1);
			aggRow['avg'] = (Math.round(aggresult[thisLayout.id + 'AVG'] * 10)/10).toFixed(1);
			aggRow['var'] = (Math.round(aggresult[thisLayout.id + 'VAR'] * 10)/10).toFixed(1);
			aggRow['max'] = (Math.round(aggresult[thisLayout.id + 'MAX'] * 10)/10).toFixed(1);
			aggTable.push(aggRow);
		}
	}
	//logger.debug('aggTable=' + JSON.stringify(aggTable));

	//logger.debug('pitData=' + JSON.stringify(pitData));
	//logger.debug('pitData1=' + JSON.stringify(pitData1));

	res.render('./reports/teamintelhistory', {
		title: 'Intel History: Team ' + teamKey.substring(3),
		team: team,
		scorelayout: scorelayout,
		aggdata: aggTable,
		matches: matches,
		year: eventYear,
		rankingPoints: rankingPoints,
		events: eventInfos,
	});
}));

router.get('/matchintel', wrap(async (req, res) => {
	logger.addContext('funcName', 'matchintel[get]');
	logger.info('ENTER');
	
	let matchKey = req.query.key;
	if (typeof matchKey !== 'string') throw new e.UserError('Please specify one match key.');
	
	logger.debug('matchKey=' + matchKey);
	
	let match: Match = await utilities.findOne('matches', 
		{'key': matchKey}, {},
		{allowCache: true, maxCacheAge: 10}
	);
	if (!match) throw new e.InternalDatabaseError(`Could not find match: ${matchKey}`);
	
	//logger.debug('match=' + JSON.stringify(match));
	res.render('./reports/matchintel', {
		title: 'Intel: Match '+matchKey.substring(matchKey.indexOf('qm')+2),
		match: match
	});
}));


router.get('/teammatchintel', wrap(async (req, res) => {
	logger.addContext('funcName', 'teammatchintel[get]');
	logger.info('ENTER');
	
	let matchTeamKey = req.query.key;
	if (typeof matchTeamKey !== 'string') throw new e.UserError('Please specify one team-match key.');
	
	logger.debug('teamMatchKey=' + matchTeamKey);
	
	let eventYear = req.event.year;
	let orgKey = req._user.org_key;
	
	// Match data layout
	let layout: Layout[] = await utilities.find('layout', 
		{org_key: orgKey, year: eventYear, form_type: 'matchscouting'}, 
		{sort: {'order': 1}},
		{allowCache: true}
	);

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	// 2020-03-06 JL: utilities.find -> utilities.findOne
	let teammatch: MatchScouting = await utilities.findOne('matchscouting', {'org_key': orgKey, 'match_team_key': matchTeamKey}, {});
	let data = null;
	if (teammatch) {
		data = teammatch.data;
	}
	
	let x = matchTeamKey;
	let matchType, matchNum;
	let teamNum = x.substring(x.lastIndexOf('_')+4);
	
	if( x.indexOf('qm') != -1 ){
		matchType = 'Match';
		matchNum = x.substring(x.indexOf('qm')+2, x.lastIndexOf('_'));
	}
	else if( x.indexOf('qf') != -1){
		matchType = 'Quarterfinal';
		matchNum = x.substring(x.indexOf('qf')+2, x.lastIndexOf('_'));
	}
	else if( x.indexOf('sf') != -1 ){
		matchType = 'Semifinal';
		matchNum = x.substring(x.indexOf('sf')+2, x.lastIndexOf('_'));
	}
	else{
		matchType = 'Final';
		matchNum = x.substring(x.indexOf('f')+2, x.lastIndexOf('_'));
	}
	
	
	//logger.debug('teammatch=' + JSON.stringify(teammatch));
	res.render('./reports/teammatchintel', {
		title: `Intel: ${matchType} ${matchNum} Team ${teamNum}`,
		layout: layout,
		data: data,
		teammatch: teammatch,
		teamKey: matchTeamKey.split('_')[2],
		matchDataHelper: matchDataHelper
	});
}));

router.get('/alliancestats', wrap(async (req, res) =>  {
	logger.addContext('funcName', 'alliancestats[get]');
	logger.info('ENTER');
	
	let eventYear = req.event.year;
	let eventKey = req.event.key;
	let orgKey = req._user.org_key;
	
	let teamsInput = req.query.teams;
	if (typeof teamsInput !== 'string') throw new e.UserError('Must specify a comma-separated list of teams.');

	// use helper function
	let allianceStatsData = await matchDataHelper.getAllianceStatsData(eventYear, eventKey, orgKey, teamsInput, req.cookies);
	
	let teams = allianceStatsData.teams;
	let teamList = allianceStatsData.teamList;
	let currentAggRanges = allianceStatsData.currentAggRanges;
	let avgTable = allianceStatsData.avgTable;
	let maxTable = allianceStatsData.maxTable;
	// var avgNorms = allianceStatsData.avgNorms;
	let maxNorms = allianceStatsData.maxNorms;

	res.render('./reports/alliancestats', {
		title: 'Alliance Team Statistics',
		teams: teams,
		teamList: teamList,
		currentAggRanges: currentAggRanges,
		avgdata: avgTable,
		maxdata: maxTable,
		// avgnorms: avgNorms, 2022-03-18 JL: avgNorms not used on alliancestats page; Modifying the way it calculates the norms for the spider chart on drive team dashboard
		maxnorms: maxNorms
	});
}));

router.get('/teamdata', wrap(async (req, res) =>  {
	logger.addContext('funcName', 'teamdata[get]');
	logger.info('ENTER');
	
	// 2020-03-21 JL: Changed query.key to query.team_key
	let eventYear = req.event.year;
	let eventKey = req.event.key;
	let teamKey = req.query.team_key;
	let orgKey = req._user.org_key;
	
	if (typeof teamKey !== 'string') throw new e.UserError('Must specify one team key for reports/teamdata.');
			
	logger.debug(`teamKey: ${teamKey}`);

	// get the specified team object
	// 2020-02-09, M.O'C: Adjusted "currentteams" to "teams"
	// 2020-03-06 JL: find -> findOne
	let team: Team = await utilities.findOne('teams', 
		{'key': teamKey}, {},
		{allowCache: true}
	);
	
	if (!team) throw new e.UserError('Could not find team: ' + teamKey);
	
	logger.debug(`team: ${JSON.stringify(team)}`);

	// get the scoring data for the matches
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let matches: MatchScouting[] = await utilities.find('matchscouting', {'team_key': teamKey, 'year': eventYear, 'org_key': orgKey, 'event_key': eventKey}, {sort: {'match_number': -1}});
	
	logger.trace(`matches: ${JSON.stringify(matches)}`);

	// get the scoring layout
	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	let cookie_key = orgKey + '_' + eventYear + '_cols';
	let colCookie = req.cookies[cookie_key];
	let scoreLayout = await matchDataHelper.getModifiedMatchScoutingLayout(orgKey, eventYear, colCookie);

	logger.trace(`scoreLayout: ${JSON.stringify(scoreLayout)}`);

	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	let currentAggRanges: AggRange[] = await utilities.find('aggranges', {'org_key': orgKey, 'event_key': eventKey});
	
	res.render('./reports/teamdata', {
		title: 'Match Scouting Data for Team #' + teamKey.substring(3),
		layout: scoreLayout,
		currentAggRanges: currentAggRanges,
		matches: matches,
		team: team,
		matchDataHelper: matchDataHelper
	});
}));

router.get('/matchdata', wrap(async (req, res) =>  {
	logger.addContext('funcName', 'matchdata[get]');
	logger.info('ENTER');
	
	let eventYear = req.event.year;
	let eventKey = req.event.key;
	let matchKey = req.query.key;
	let orgKey = req._user.org_key;

	if (!matchKey) throw new e.UserError('Must specify match key.');
	
	logger.debug(`matchKey: ${matchKey}`);

	// get the specified match object
	let match: Match = await utilities.findOne('matches', {'key': matchKey}, {});
	if (!match) throw new e.UserError(`Could not find match: ${matchKey}`);
	
	logger.trace(`match: ${JSON.stringify(match)}`);

	// get the scoring data for the match
	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let matches: MatchScouting[] = await utilities.find('matchscouting', {'org_key': orgKey, 'match_key': matchKey}, {});
	
	logger.trace(`matches: ${JSON.stringify(matches)}`);

	// get the scoring layout
	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	let cookie_key = orgKey + '_' + eventYear + '_cols';
	let colCookie = req.cookies[cookie_key];
	let scoreLayout = await matchDataHelper.getModifiedMatchScoutingLayout(orgKey, eventYear, colCookie);

	logger.trace(`scoreLayout: ${JSON.stringify(scoreLayout)}`);

	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	let currentAggRanges: AggRange[] = await utilities.find('aggranges', {'org_key': orgKey, 'event_key': eventKey});
	
	res.render('./reports/matchdata', {
		title: 'Scoring Data For Match',
		scoreLayout: scoreLayout,
		currentAggRanges: currentAggRanges,
		matches: matches,
		match: match,
		matchDataHelper: matchDataHelper
	});
}));

router.get('/matchmetrics', wrap(async (req, res) =>  {
	logger.addContext('funcName', 'matchmetrics[get]');
	logger.info('ENTER');
	
	let eventYear = req.event.year;
	let eventKey = req.event.key;
	let matchKey = req.query.key;
	let orgKey = req._user.org_key;
	
	if (!matchKey) throw new e.UserError('Must specify match key.');
	
	logger.debug(`matchKey: ${matchKey}`);

	// get the specified match object
	let match: Match = await utilities.findOne('matches', {'key': matchKey}, {}) || {};
	
	logger.trace(`match: ${JSON.stringify(match)}`);

	// Match data layout - use to build dynamic Mongo aggregation query  --- Comboing twice, on two sets of team keys: red alliance & blue alliance
	// db.scoringdata.aggregate( [ 
	// { $match : { "team_key":{$in: [...]}, "event_key": event_key } }, 
	// { $group : { _id: "$event_key",
	// "autoScaleAVG": {$avg: "$data.autoScale"},
	// "teleScaleAVG": {$avg: "$data.teleScale"},
	//  } }
	// ] );

	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	let cookie_key = orgKey + '_' + eventYear + '_cols';
	let colCookie = req.cookies[cookie_key];
	let scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(orgKey, eventYear, colCookie);

	let aggQuery = [];
	let redAllianceArray = match.alliances.red.team_keys;
	aggQuery.push({ $match : { 'team_key': {$in: redAllianceArray}, 'org_key': orgKey, 'event_key': eventKey } });

	// M.O'C, 2022-03-38: Replacing $avg with $expMovingAvg
	//get the alpha from the process.env
	if (!process.env.EMA_ALPHA) throw new e.InternalServerError('EMA_ALPHA not defined');
	let emaAlpha = parseFloat(process.env.EMA_ALPHA);
	//initialize setWindowFieldsClause
	let setWindowFieldsClause: MongoDocument = {};
	setWindowFieldsClause['partitionBy'] = '$team_key';
	let sortField: MongoDocument = {};
	sortField['time'] = 1;
	setWindowFieldsClause['sortBy'] = sortField;
	let outputClause: MongoDocument = {};
	//iterate through scoringlayout
	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		//pull this layout element from score layout
		let thisLayout = scorelayout[scoreIdx];
		thisLayout.key = thisLayout.id;
		scorelayout[scoreIdx] = thisLayout;
		//if it is a valid data type, add this layout's ID to groupClause
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			let thisEMAclause: MongoDocument = {};
			let thisEMAinner: MongoDocument = {};
			thisEMAinner['alpha'] = emaAlpha;
			thisEMAinner['input'] = '$data.' + thisLayout.id;
			thisEMAclause['$expMovingAvg'] = thisEMAinner;
			outputClause[thisLayout.id + 'EMA'] = thisEMAclause;
		}
	}
	setWindowFieldsClause['output'] = outputClause;
	logger.debug('setWindowFieldsClause=' + JSON.stringify(setWindowFieldsClause));
	aggQuery.push({$setWindowFields: setWindowFieldsClause});
	
	let groupClause: MongoDocument = {};
	groupClause['_id'] = '$team_key';

	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		let thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			//logger.debug('thisLayout.type=' + thisLayout.type + ', thisLayout.id=' + thisLayout.id);
			// 2022-03-28, M.O'C: Replacing flat $avg with the exponential moving average
			//groupClause[thisLayout.id + 'AVG'] = {$avg: '$data.' + thisLayout.id}; 
			groupClause[thisLayout.id + 'AVG'] = {$last: '$' + thisLayout.id + 'EMA'};
		}
	}
	aggQuery.push({ $group: groupClause });
	//logger.debug('aggQuery=' + JSON.stringify(aggQuery));

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let aggR = await utilities.aggregate('matchscouting', aggQuery);

	// Unspool single row of aggregate results into tabular form
	let aggTable = [];
	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		let thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			let aggRow: MongoDocument = {};
			aggRow['key'] = thisLayout.id;
			// 2022-03-30 JL: Compute the average from all three teams
			let sum = 0;
			for (let aggresult of aggR) {
				sum += aggresult[thisLayout.id + 'AVG'];
			}
			aggRow['red'] = (sum / aggR.length).toFixed(1);
			aggTable.push(aggRow);
		}
	}

	// repeat aggregation for blue alliance
	aggQuery = [];
	let blueAllianceArray = match.alliances.blue.team_keys;
	aggQuery.push({ $match : { 'team_key': {$in: blueAllianceArray}, 'org_key': orgKey, 'event_key': eventKey } });
	// 2022-03-30, M.O'C: Also reuse prior setWindowFields clause
	aggQuery.push({$setWindowFields: setWindowFieldsClause});
	// reuse prior groupClause
	aggQuery.push({ $group: groupClause });
	//logger.debug('aggQuery=' + JSON.stringify(aggQuery));

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let aggR2 = await utilities.aggregate('matchscouting', aggQuery);

	// Unspool single row of aggregate results into tabular form
	// Utilize pointer to aggTable to line up data
	let aggTablePointer = 0;
	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		let thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			// 2022-03-30 JL: Compute the average from all three teams
			let sum = 0;
			for (let aggresult of aggR2) {
				sum += aggresult[thisLayout.id + 'AVG'];
			}
			aggTable[aggTablePointer].blue = (sum / aggR2.length).toFixed(1);
			aggTablePointer++;
		}
	}

	logger.trace('aggTable=' + JSON.stringify(aggTable));

	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	let currentAggRanges: AggRange[] = await utilities.find('aggranges', {'org_key': orgKey, 'event_key': eventKey});

	res.render('./reports/matchmetrics', {
		title: 'Metrics For Upcoming Match',
		aggdata: aggTable,
		currentAggRanges: currentAggRanges,
		match: match
	});
}));

router.get('/metricsranked', wrap(async (req, res) => {
	logger.addContext('funcName', 'metricsranked[get]');
	logger.info('ENTER');
	
	let eventYear = req.event.year;
	let orgKey = req._user.org_key;
	let eventKey = req.event.key;

	// Match data layout - use to build dynamic Mongo aggregation query  --- No team key specified! Will combo ALL teams
	// db.scoringdata.aggregate( [ 
	// { $match : { "data":{$exists:true}, "event_key": "2018njfla" } }, 
	// { $group : { _id: "$team_key",
	// "teleScaleMIN": {$min: "$data.teleScale"},
	// "teleScaleAVG": {$avg: "$data.teleScale"},
	// "teleScaleMAX": {$max: "$data.teleScale"}
	//  } }
	// ] );

	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	// var cookie_key = org_key + "_" + event_year + "_cols";
	// var colCookie = req.cookies[cookie_key];
	// var scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);
	// 2020-03-07, M.O'C: Disabled filtered columns for this report
	let scorelayout: Layout[] = await utilities.find('layout', 
		{org_key: orgKey, year: eventYear, form_type: 'matchscouting'}, 
		{sort: {'order': 1}},
		{allowCache: true}
	);

	let aggQuery = [];
	aggQuery.push({ $match : { 'data':{$exists:true}, 'org_key': orgKey, 'event_key': eventKey } });

	// M.O'C, 2022-03-38: Replacing $avg with $expMovingAvg
	//get the alpha from the process.env
	if (!process.env.EMA_ALPHA) throw new e.InternalServerError('EMA_ALPHA not defined');
	let emaAlpha = parseFloat(process.env.EMA_ALPHA);
	//initialize setWindowFieldsClause
	let setWindowFieldsClause: MongoDocument = {};
	setWindowFieldsClause['partitionBy'] = '$team_key';
	let sortField: MongoDocument = {};
	sortField['time'] = 1;
	setWindowFieldsClause['sortBy'] = sortField;
	let outputClause: MongoDocument = {};
	//iterate through scoringlayout
	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		//pull this layout element from score layout
		let thisLayout = scorelayout[scoreIdx];
		thisLayout.key = thisLayout.id;
		scorelayout[scoreIdx] = thisLayout;
		//if it is a valid data type, add this layout's ID to groupClause
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			let thisEMAclause: MongoDocument = {};
			let thisEMAinner: MongoDocument = {};
			thisEMAinner['alpha'] = emaAlpha;
			thisEMAinner['input'] = '$data.' + thisLayout.id;
			thisEMAclause['$expMovingAvg'] = thisEMAinner;
			outputClause[thisLayout.id + 'EMA'] = thisEMAclause;
		}
	}
	setWindowFieldsClause['output'] = outputClause;
	logger.debug('setWindowFieldsClause=' + JSON.stringify(setWindowFieldsClause));
	aggQuery.push({$setWindowFields: setWindowFieldsClause});
	
	let groupClause: MongoDocument = {};
	groupClause['_id'] = '$team_key';

	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		let thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			//logger.debug('thisLayout.type=' + thisLayout.type + ', thisLayout.id=' + thisLayout.id);
			// 2022-03-28, M.O'C: Replacing flat $avg with the exponential moving average
			//groupClause[thisLayout.id + 'AVG'] = {$avg: '$data.' + thisLayout.id}; 
			groupClause[thisLayout.id + 'AVG'] = {$last: '$' + thisLayout.id + 'EMA'};
		}
	}
	aggQuery.push({ $group: groupClause });
	//logger.debug('aggQuery=' + JSON.stringify(aggQuery));

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let aggR = await utilities.aggregate('matchscouting', aggQuery);
	let aggData = [];
	//var aggresult = {};
	if (aggR)
		aggData = aggR;
		//aggresult = docs[0];
	//logger.debug('aggresult=' + JSON.stringify(aggresult));

	// Unspool rows of aggregate results into tabular form - update values as higher values found
	let aggTable = [];
	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		let thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			let aggRow: MongoDocument = {};
			aggRow['key'] = thisLayout.id;
			aggRow['team'] = 'frcNone';
			aggRow['avg'] = -1;

			// cycle through each team row, looking for a higher (or equal) value for this particular scoring ID
			for (let aggIdx = 0; aggIdx < aggData.length; aggIdx++) {
				let aggresult = aggData[aggIdx];
				// Recompute VAR first = StdDev/Mean
				//aggRow['var'] = aggRow['var'] / (aggRow['avg'] + 0.001);
				
				let thisAvg = parseFloat( (Math.round(aggresult[thisLayout.id + 'AVG'] * 10)/10).toFixed(1) );
				if (thisAvg > aggRow['avg']) {
					aggRow['team'] = aggresult['_id'];
					aggRow['avg'] = thisAvg;
				}
				else if (thisAvg == aggRow['avg']) {
					if (aggRow['team'] != 'frc(mult)')
						aggRow['team'] = 'frc(mult)';
				}
				
				////aggRow['min'] = (Math.round(aggresult[thisLayout.id + "MIN"] * 10)/10).toFixed(1);
				//aggRow['avg'] = (Math.round(aggresult[thisLayout.id + "AVG"] * 10)/10).toFixed(1);
				////aggRow['var'] = (Math.round(aggresult[thisLayout.id + "VAR"] * 10)/10).toFixed(1);
				////aggRow['max'] = (Math.round(aggresult[thisLayout.id + "MAX"] * 10)/10).toFixed(1);
			}
			aggTable.push(aggRow);
		}
	}
	logger.debug('aggTable=' + JSON.stringify(aggTable));
	
	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	let currentAggRanges: AggRange[] = await utilities.find('aggranges', {'org_key': orgKey, 'event_key': eventKey});
	
	res.render('./reports/metricsranked', {
		title: 'Metrics For All Teams',
		currentAggRanges: currentAggRanges,
		aggdata: aggTable
	});
}));

router.get('/metrics', wrap(async (req, res) => {
	logger.addContext('funcName', 'metrics[get]');
	logger.info('ENTER');
	
	let eventYear = req.event.year;
	let orgKey = req._user.org_key;
	
	// for later querying by event_key
	let event_key = req.event.key;
	logger.debug('event_key=' + event_key);

	// Match data layout - use to build dynamic Mongo aggregation query  --- No team key specified! Will combo ALL teams
	// db.scoringdata.aggregate( [ 
	// { $match : { "data":{$exists:true}, "event_key": "2018njfla" } }, 
	// { $group : { _id: "$team_key",
	// "teleScaleMIN": {$min: "$data.teleScale"},
	// "teleScaleAVG": {$avg: "$data.teleScale"},
	// "teleScaleMAX": {$max: "$data.teleScale"}
	//  } }
	// ] );

	// 2020-02-11, M.O'C: Combined "scoringlayout" into "layout" with an org_key & the type "matchscouting"
	// var cookie_key = org_key + "_" + event_year + "_cols";
	// var colCookie = req.cookies[cookie_key];
	// var scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(org_key, event_year, colCookie);
	// 2020-03-07, M.O'C: Disabled filtered columns for this report
	let scorelayout: Layout[] = await utilities.find('layout', 
		{org_key: orgKey, year: eventYear, form_type: 'matchscouting'}, 
		{sort: {'order': 1}},
		{allowCache: true}
	);

	let aggQuery = [];
	aggQuery.push({ $match : { 'data':{$exists:true}, 'org_key': orgKey, 'event_key': event_key } });
	let groupClause: MongoDocument = {};
	// group on event for single row
	groupClause['_id'] = '$event_key';

	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		let thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			//logger.debug('thisLayout.type=' + thisLayout.type + ', thisLayout.id=' + thisLayout.id);
			groupClause[thisLayout.id + 'MIN'] = {$min: '$data.' + thisLayout.id};
			// 2022-03-28, M.O'C: Leave this as flat $avg (and not exponential moving average) because the data is '2-dimensional' (not just 1D time)
			groupClause[thisLayout.id + 'AVG'] = {$avg: '$data.' + thisLayout.id};
			groupClause[thisLayout.id + 'VAR'] = {$stdDevSamp: '$data.' + thisLayout.id};
			groupClause[thisLayout.id + 'MAX'] = {$max: '$data.' + thisLayout.id};
		}
	}
	aggQuery.push({ $group: groupClause });
	//logger.debug('aggQuery=' + JSON.stringify(aggQuery));

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let aggR = await utilities.aggregate('matchscouting', aggQuery);
	let aggresult: MongoDocument = {};
	if (aggR && aggR[0])
		aggresult = aggR[0];
	//logger.debug('aggresult=' + JSON.stringify(aggresult));

	// Unspool single row of aggregate results into tabular form
	let aggTable = [];
	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		let thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			let aggRow: MongoDocument = {};
			aggRow['key'] = thisLayout.id;
			
			// Recompute VAR first = StdDev/Mean
			aggRow['var'] = aggRow['var'] / (aggRow['avg'] + 0.001);
		
			aggRow['min'] = (Math.round(aggresult[thisLayout.id + 'MIN'] * 10)/10).toFixed(1);
			aggRow['avg'] = (Math.round(aggresult[thisLayout.id + 'AVG'] * 10)/10).toFixed(1);
			aggRow['var'] = (Math.round(aggresult[thisLayout.id + 'VAR'] * 10)/10).toFixed(1);
			aggRow['max'] = (Math.round(aggresult[thisLayout.id + 'MAX'] * 10)/10).toFixed(1);
			aggTable.push(aggRow);
		}
	}
	//logger.debug('aggTable=' + JSON.stringify(aggTable));
	
	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	let currentAggRanges: AggRange[] = await utilities.find('aggranges', {'org_key': orgKey, 'event_key': event_key});
	
	res.render('./reports/metrics', {
		title: 'Metrics For All Teams',
		currentAggRanges: currentAggRanges,
		aggdata: aggTable
	});
}));

router.get('/metricintel', wrap(async (req, res) => {
	logger.addContext('funcName', 'metricintel[get]');
	logger.info('ENTER');
	
	let metricKey = req.query.key;
	if (typeof metricKey !== 'string') throw new Error('Please specify one metric key.');
	
	logger.debug('metricKey=' + metricKey);
	
	// for later querying by event_key
	let eventKey = req.event.key;
	let orgKey = req._user.org_key;
	logger.debug('event_key=' + eventKey);

	// Match data layout - use to build dynamic Mongo aggregation query  --- No team key specified! Will output ALL teams
	// db.scoringdata.aggregate( [ 
	// { $match : { "data":{$exists:true}, "event_key": "2018njfla" } }, 
	// { $group : { _id: "$team_key",
	// "teleScaleMIN": {$min: "$data.teleScale"},
	// "teleScaleAVG": {$avg: "$data.teleScale"},
	// "teleScaleMAX": {$max: "$data.teleScale"}
	//  } }
	// ] );						
	let aggQuery = [];
	aggQuery.push({ $match : { 'data':{$exists:true}, 'org_key': orgKey, 'event_key': eventKey } });

	// M.O'C, 2022-03-38: Replacing $avg with $expMovingAvg
	//get the alpha from the process.env
	if (!process.env.EMA_ALPHA) throw new e.InternalServerError('EMA_ALPHA not defined');
	let emaAlpha = parseFloat(process.env.EMA_ALPHA);
	//initialize setWindowFieldsClause
	let setWindowFieldsClause: MongoDocument = {};
	setWindowFieldsClause['partitionBy'] = '$team_key';
	let sortField: MongoDocument = {};
	sortField['time'] = 1;
	setWindowFieldsClause['sortBy'] = sortField;
	let outputClause: MongoDocument = {};
	//iterate through scoringlayout

	let thisEMAclause: MongoDocument = {};
	let thisEMAinner: MongoDocument = {};
	thisEMAinner['alpha'] = emaAlpha;
	thisEMAinner['input'] = '$data.' + metricKey;
	thisEMAclause['$expMovingAvg'] = thisEMAinner;
	outputClause[metricKey + 'EMA'] = thisEMAclause;

	setWindowFieldsClause['output'] = outputClause;
	logger.debug('setWindowFieldsClause=' + JSON.stringify(setWindowFieldsClause));
	aggQuery.push({$setWindowFields: setWindowFieldsClause});

	let groupClause: MongoDocument = {};
	// group on team for multiple rows
	groupClause['_id'] = '$team_key';

	groupClause[metricKey + 'MIN'] = {$min: '$data.' + metricKey};
	// 2022-03-28, M.O'C: Replacing flat $avg with the exponential moving average
	// groupClause[metricKey + 'AVG'] = {$avg: '$data.' + metricKey};
	groupClause[metricKey + 'AVG'] = {$last: '$' + metricKey + 'EMA'};
	groupClause[metricKey + 'VAR'] = {$stdDevSamp: '$data.' + metricKey};
	groupClause[metricKey + 'MAX'] = {$max: '$data.' + metricKey};

	let sortKey = metricKey + 'AVG';
	let sortClause: MongoDocument = {};
	sortClause[sortKey] = -1;

	aggQuery.push({ $group: groupClause }, { $sort: sortClause });
	//logger.debug('aggQuery=' + JSON.stringify(aggQuery));

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let aggdata = await utilities.aggregate('matchscouting', aggQuery);

	if (aggdata) {
		for (let thisAgg of aggdata) {
			//var thisAgg = aggdata[aggIdx];
			// Recompute VAR first = StdDev/Mean
			thisAgg[metricKey + 'VAR'] = thisAgg[metricKey + 'VAR'] / (thisAgg[metricKey + 'AVG'] + 0.001);
			
			thisAgg[metricKey + 'MIN'] = (Math.round(thisAgg[metricKey + 'MIN'] * 10)/10).toFixed(1);
			thisAgg[metricKey + 'AVG'] = (Math.round(thisAgg[metricKey + 'AVG'] * 10)/10).toFixed(1);
			thisAgg[metricKey + 'VAR'] = (Math.round(thisAgg[metricKey + 'VAR'] * 10)/10).toFixed(1);
			thisAgg[metricKey + 'MAX'] = (Math.round(thisAgg[metricKey + 'MAX'] * 10)/10).toFixed(1);
		}
	}
	
	//logger.debug('aggdata=' + JSON.stringify(aggdata));
	
	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	let currentAggRanges: AggRange[] = await utilities.find('aggranges', {'org_key': orgKey, 'event_key': eventKey});
	
	res.render('./reports/metricintel', {
		title: 'Intel: ' + metricKey,
		aggdata: aggdata,
		currentAggRanges: currentAggRanges,
		key: metricKey
	});
}));

/**
 * Metrics view
 */
router.get('/allteammetrics', wrap(async (req, res) => {
	logger.addContext('funcName', 'allteammetrics[get]');
	logger.info('ENTER');
	
	// for later querying by event_key
	let eventKey = req.event.key;
	let eventYear = req.event.year;
	let orgKey = req._user.org_key;
	logger.debug('event_key=' + eventKey);
	
	// get the current rankings
	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
	let rankings: Ranking[] = await utilities.find('rankings', {'event_key': eventKey}, {});
	
	let rankMap: Dict<Ranking> = {};
	for (let rankIdx = 0; rankIdx < rankings.length; rankIdx++) {
		//logger.debug('rankIdx=' + rankIdx + ', team_key=' + rankings[rankIdx].team_key + ', rank=' + rankings[rankIdx].rank);
		rankMap[rankings[rankIdx].team_key] = rankings[rankIdx];
	}
	//logger.debug('rankMap=' + JSON.stringify(rankMap));

	// Match data layout - use to build dynamic Mongo aggregation query  --- Comboing twice, on two sets of team keys: red alliance & blue alliance
	// db.scoringdata.aggregate( [ 
	// { $match : { "team_key":{$in: [...]}, "event_key": event_key } }, 
	// { $group : { _id: "$event_key",
	// "autoScaleAVG": {$avg: "$data.autoScale"},
	// "teleScaleAVG": {$avg: "$data.teleScale"},
	//  } }
	// ] );

	// Variables ahead of modifying match scoring layout for cookies
	// 2020-02-15, M.O'C: Leverage column selection cookies - pull in the cookies
	let cookie_key = orgKey + '_' + eventYear + '_cols';
	let colCookie = req.cookies[cookie_key];
	let scorelayout = await matchDataHelper.getModifiedMatchScoutingLayout(orgKey, eventYear, colCookie);

	// Build the aggregation data
	let aggQuery = [];
	aggQuery.push({ $match : { 'org_key': orgKey, 'event_key': eventKey } });

	// M.O'C, 2022-03-38: Replacing $avg with $expMovingAvg
	//get the alpha from the process.env
	if (!process.env.EMA_ALPHA) throw new e.InternalServerError('EMA_ALPHA not defined');
	let emaAlpha = parseFloat(process.env.EMA_ALPHA);
	//initialize setWindowFieldsClause
	let setWindowFieldsClause: MongoDocument = {};
	setWindowFieldsClause['partitionBy'] = '$team_key';
	let sortField: MongoDocument = {};
	sortField['time'] = 1;
	setWindowFieldsClause['sortBy'] = sortField;
	let outputClause: MongoDocument = {};
	//iterate through scoringlayout
	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		//pull this layout element from score layout
		let thisLayout = scorelayout[scoreIdx];
		thisLayout.key = thisLayout.id;
		scorelayout[scoreIdx] = thisLayout;
		//if it is a valid data type, add this layout's ID to groupClause
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			let thisEMAclause: MongoDocument = {};
			let thisEMAinner: MongoDocument = {};
			thisEMAinner['alpha'] = emaAlpha;
			thisEMAinner['input'] = '$data.' + thisLayout.id;
			thisEMAclause['$expMovingAvg'] = thisEMAinner;
			outputClause[thisLayout.id + 'EMA'] = thisEMAclause;
		}
	}
	setWindowFieldsClause['output'] = outputClause;
	logger.debug('setWindowFieldsClause=' + JSON.stringify(setWindowFieldsClause));
	aggQuery.push({$setWindowFields: setWindowFieldsClause});
	
	let groupClause: MongoDocument = {};
	groupClause['_id'] = '$team_key';

	for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
		let thisLayout = scorelayout[scoreIdx];
		//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
		if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
			// 2022-03-28, M.O'C: Replacing flat $avg with the exponential moving average
			//groupClause[thisLayout.id + 'AVG'] = {$avg: '$data.' + thisLayout.id}; 
			groupClause[thisLayout.id + 'AVG'] = {$last: '$' + thisLayout.id + 'EMA'};
			groupClause[thisLayout.id + 'MAX'] = {$max: '$data.' + thisLayout.id};
		}
	}
	aggQuery.push({ $group: groupClause });
	aggQuery.push({ $sort: { _id: 1 } });
	//logger.debug('aggQuery=' + JSON.stringify(aggQuery));

	// 2020-02-11, M.O'C: Renaming "scoringdata" to "matchscouting", adding "org_key": org_key, 
	let aggR = await utilities.aggregate('matchscouting', aggQuery);
	let aggArray = [];
	if (aggR)
		aggArray = aggR;
		
	//logger.debug('rankMap=' + rankMap);
	
	// Rewrite data into display-friendly values
	for (let aggIdx = 0; aggIdx < aggArray.length; aggIdx++) {
		let thisAgg = aggArray[aggIdx];
		for (let scoreIdx = 0; scoreIdx < scorelayout.length; scoreIdx++) {
			let thisLayout = scorelayout[scoreIdx];
			//if (thisLayout.type == 'checkbox' || thisLayout.type == 'counter' || thisLayout.type == 'badcounter') {
			if (matchDataHelper.isQuantifiableType(thisLayout.type)) {
				let roundedValAvg = (Math.round(thisAgg[thisLayout.id + 'AVG'] * 10)/10).toFixed(1);
				let roundedValMax = (Math.round(thisAgg[thisLayout.id + 'MAX'] * 10)/10).toFixed(1);
				thisAgg[thisLayout.id + 'AVG'] = roundedValAvg;
				thisAgg[thisLayout.id + 'MAX'] = roundedValMax;
			}
		}
		if(rankMap[thisAgg._id]){
			thisAgg['rank'] = rankMap[thisAgg._id].rank;
			thisAgg['value'] = rankMap[thisAgg._id].value;
			aggArray[aggIdx] = thisAgg;
		}
	}
	//logger.debug('aggArray=' + JSON.stringify(aggArray));

	// read in the current agg ranges
	// 2020-02-08, M.O'C: Tweaking agg ranges
	let currentAggRanges: AggRange[] = await utilities.find('aggranges', {'org_key': orgKey, 'event_key': eventKey});
	
	res.render('./reports/allteammetrics', {
		title: 'All Team Metrics',
		aggdata: aggArray,
		currentAggRanges: currentAggRanges,
		layout: scorelayout,
		matchDataHelper: matchDataHelper
	});
}));

//// 2020-03-07, M.O'C: TEMPORARY COPY-N-PASTE FROM /DASHBOARD SO UNAUTHENTICATED USERS CAN ACCESS
// 2020-03-07 JL: Moved driveteam back into dashboard; Preserved a redirect to avoid 404
router.get('/driveteam', wrap(async (req, res) => {
	let teamKey = req.query.team_key || '';
	
	res.redirect(`/dashboard/driveteam?team_key=${teamKey}`);
}));

//// Data exports

router.get('/exportdata', wrap(async (req, res) => {
	logger.addContext('funcName', 'exportdata[get]');
	logger.info('ENTER');

	// for later querying by event_key
	let eventKey = req.event.key;
	let eventYear = req.event.year;
	let orgKey = req._user.org_key;

	let dataType = req.query.type;
	if (typeof dataType !== 'string') {
		res.redirect('/?alert=No (or invalid) data type specified for export.');
		return;
	}
	let dataSpan = req.query.span;

	logger.info('ENTER event_key=' + eventKey + ',org_key=' + orgKey + ',data_type=' + dataType + ',dataSpan=' + dataSpan + ',req.shortagent=' + JSON.stringify(req.shortagent));

	// read in the list of form options
	let matchLayout: Layout[] = await utilities.find('layout', 
		{org_key: orgKey, year: eventYear, form_type: dataType}, 
		{sort: {'order': 1}},
		{allowCache: true}
	);

	// sanity check
	//logger.debug("layout=" + JSON.stringify(matchLayout));
	if (!matchLayout || matchLayout.length == 0) {
		res.redirect('/?alert=No data found for type \'' + dataType + '\'.');
		return;
	}
	
	//2020-03-27 JL: Fixed sortKey options (Putting an object with {sortKey: 1}) didn't insert the variable sortKey 
	let sortKey;
	switch (dataType) {
		case 'matchscouting':
			sortKey = 'time';
			break;
		case 'pitscouting':
			sortKey = 'team_key';
			break;
		default:
			sortKey = null;
			break;
	}
	
	let sortOptions: MongoDocument = {};
	if (sortKey) {
		sortOptions.sort = {};
		sortOptions.sort[sortKey] = 1;
	}
	
	// read in all data
	let queryJson: MongoDocument = {'org_key': orgKey, 'event_key': eventKey, 'data': {$exists: true} };
	if (dataSpan == 'all') {
		queryJson = {'org_key': orgKey, 'data': {$exists: true} };
		queryJson['event_key'] = {$regex: '^' + eventYear};
	}
	logger.debug('queryJson=' + JSON.stringify(queryJson));
	//var scored = await utilities.find(dataType, {'org_key': orgKey, 'event_key': eventKey, 'data': {$exists: true} }, sortOptions);
	let scored: PitScouting[]|MatchScouting[] = await utilities.find(dataType, queryJson, sortOptions);
	
	// Since team_key sort is string based, we need to manually sort by team number
	if (sortKey == 'team_key') {
		scored.sort((a, b) => {
			let aNum = parseInt(a.team_key.substring(3));
			let bNum = parseInt(b.team_key.substring(3));
			return aNum - bNum;
		});
	}
	
	// cycle through each scored match & build CSV
	let fullCSVoutput = '';
	// which 'pivot data columns' are we including?
	let pivotDataCols = '';
	switch (dataType) {
		case 'matchscouting':
			pivotDataCols = 'org_key,year,event_key,match_key,match_number,time,alliance,team_key';
			break;
		case 'pitscouting':
			pivotDataCols = 'org_key,year,event_key,team_key';
			break;
		default:
			pivotDataCols = '';
	}
	let pivotDataKeys = pivotDataCols.split(',');
	let isFirstRow = true;
	for (let i in scored) {
		if (scored[i].data) {
			let thisScored = scored[i];
			// emit header row if this is the first line of data
			if (isFirstRow) {
				isFirstRow = false;
				// initialize header row with particular columns
				let headerRow = pivotDataCols;
				// add on metric IDs
				for (let thisItem of matchLayout) {
					// 2022-04-04 JL: If the user is not logged in as a scouter, then don't include otherNotes in the export
					if (matchDataHelper.isMetric(thisItem.type) && !isOtherNotesAndUnauthorized(thisItem)) 
						headerRow += ',' + thisItem.id;
				}
				//logger.debug("headerRow=" + headerRow);
				fullCSVoutput = headerRow;
			}

			let dataRow = '';
			let thisData = thisScored.data;
			if (!thisData) throw new e.InternalDatabaseError('thisScored.data does not exist'); // this should never occur because of the DB query, but the check is necessary for TS
			
			// initialize data row with particular columns
			let isFirstColumn = true;
			//eslint-disable-next-line
			for (var k in pivotDataKeys) {
				if (isFirstColumn)
					isFirstColumn = false;
				else
					dataRow += ',';
				let thisPivotDataKey = pivotDataKeys[k];
				let thisVal = thisScored[thisPivotDataKey];
				// 2020-03-11 JL: time now exports to date stringj
				//If this value is a time, then convert it into a Date string
				if (thisPivotDataKey == 'time') {
					thisVal = new Date(thisVal * 1000).toLocaleString().replace(', ', ' ');
				}
				//Convert value into a string
				thisVal = '' + thisVal;
				//Add to dataRow
				dataRow += thisVal.replace(/(\r\n|\n|\r)/gm,'');
			}

			// cycle through the metrics
			for (let thisItem of matchLayout) {
				// 2022-04-04 JL: If the user is not logged in as a scouter, then don't include otherNotes in the export
				if (matchDataHelper.isMetric(thisItem.type) && !isOtherNotesAndUnauthorized(thisItem)) {
					dataRow += ',';
					if (!thisItem.id) throw new e.InternalDatabaseError(`Layout item does not have a layout ID! (label=${thisItem.label}, _id=${thisItem._id})`);
					if (thisData[thisItem.id] || thisData[thisItem.id] == 0) {
						let thisVal = '' + thisData[thisItem.id];
						dataRow += '"' + thisVal.replace(/(\r\n|\n|\r)/gm,'') + '"';
					}
				}
			}
			//logger.debug("dataRow=" + dataRow);
			fullCSVoutput += '\n' + dataRow;
		}
	}
	
	// If the layout item is otherNotes and the user is unauthorized to view it, return false.
	function isOtherNotesAndUnauthorized(thisItem: Layout) {
		return (thisItem.id === 'otherNotes' && req._user.role.access_level < Permissions.ACCESS_SCOUTER);
	}

	logger.info('EXIT returning ' + scored.length + ' rows of CSV');

	// Send back simple text
	res.setHeader('Content-Type', 'text/csv');
	if (dataSpan == 'all') {
		res.setHeader('Content-Disposition', 'attachment; filename="' + dataType + '_' + orgKey + '_' + eventYear + '_' + Date.now() + '.csv"');
	}
	else {
		res.setHeader('Content-Disposition', 'attachment; filename="' + dataType + '_' + orgKey + '_' + eventKey + '_' + Date.now() + '.csv"');
	}
	return res.send(fullCSVoutput);
}));

//// Choosing & setting scoring selections

router.get('/choosecolumns', wrap(async (req, res) =>  {
	
	res.redirect(301, '/user/preferences/reportcolumns');
}));

module.exports = router;