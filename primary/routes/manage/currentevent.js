const router = require('express').Router();
const logger = require('log4js').getLogger('currentevent');
const wrap = require('express-async-handler');
const utilities = require('@firstteam102/scoutradioz-utilities');
const matchDataHelper = require('@firstteam102/scoutradioz-helpers').matchData;

router.all('/*', wrap(async (req, res, next) => {
	logger.removeContext('funcName');
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate (process.env.ACCESS_TEAM_ADMIN)) {
		next();
	}
}));

router.get('/matches', wrap(async (req, res) => {
	logger.addContext('funcName', 'matches[get]');
	logger.info('ENTER');
	
	var eventKey = req.event.key;
		
	// Read matches from DB for specified event
	var matches = await utilities.find('matches', {'event_key': eventKey},{sort: {'time': 1}});
		
	res.render('./manage/currentevent/matches', {
		title: 'Matches',
		matches: matches,
	});
}));

router.get('/getcurrentteams', wrap(async (req, res) => {
	logger.addContext('funcName', 'getcurrentteams[get]');
	logger.info('ENTER');

	// 2020-02-09, M.O'C: Refactoring to just update the team_keys for the current event
	var event_key = req.event.key;

	// Get the current event
	//var thisEventData = await utilities.find("events", {"key": event_key});
	//var thisEvent = thisEventData[0];

	// Refresh the teams list from TBA
	var eventTeamsUrl = `event/${event_key}/teams/keys`;
	var thisTeamKeys = await utilities.requestTheBlueAlliance(eventTeamsUrl);
	await utilities.update( 'events', {'key': event_key}, {$set: {'team_keys': thisTeamKeys}} );

	res.redirect('/manage?alert=Updated team keys for the current event successfully.');
	
}));

router.post('/resetmatches', wrap(async (req, res) => {
	logger.addContext('funcName', 'resetmatches[post]');
	logger.info('ENTER');
	
	// Issue #45 
	// if (!await req.authenticate(process.env.ACCESS_GLOBAL_ADMIN)) {
	// 	return res.redirect('/manage/currentevent/matches?alert=Unauthorized to modify TBA data.');
	// }
	
	var eventKey = req.event.key;
	
	// update all matches - set 'actualtime' to null/"", and team scores to -1
	var writeResult = await utilities.bulkWrite('matches', [{updateMany:{
		filter: {event_key: eventKey}, 
		update: {$set: {actual_time : '', winning_alliance : '', 'alliances.blue.score': -1, 'alliances.red.score': -1 }}}
	}]);
	logger.debug(`writeResult=${JSON.stringify(writeResult)}`);
	
	res.redirect('/manage/currentevent/matches?alert=Reset matches successfully.');
}));

router.post('/resetmatch', wrap(async (req, res) => {
	logger.addContext('funcName', 'resetmatch[post]');
	
	var matchKey = req.body.matchId;
	
	if (!matchKey) return res.redirect('/manage/currentevent/matches?alert=Match not specified.&type=warn');
	logger.info(`Resetting match ${matchKey}`);
	
	var writeResult = await utilities.update('matches', 
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
	// if (!await req.authenticate(process.env.ACCESS_GLOBAL_ADMIN)) {
	// 	return res.redirect('/manage/currentevent/matches?alert=Unauthorized to modify TBA data.');
	// }
	
	var matchId = req.body.matchId;

	var event_year = req.event.year;
	var event_key = req.event.key;
	var org_key = req.user.org_key;
		
	var eventKey = req.event.key;
	
	// While we're here - Get the latest ranking (& OPR data...? maybe not?)
	// https://www.thebluealliance.com/api/v3/event/2018njfla/rankings
	// https://www.thebluealliance.com/api/v3/event/2018njfla/oprs (?)

	// Reload the rankings from TBA
	var rankingUrl = 'event/' + eventKey + '/rankings';
	logger.debug('rankingUrl=' + rankingUrl);

	var rankinfo = await utilities.requestTheBlueAlliance(rankingUrl);
	var rankArr = [];
	if (rankinfo && rankinfo.rankings && rankinfo.rankings.length > 0) {
		// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings'; enrich with event_key 
		var thisRankings = rankinfo.rankings;
		for (var thisRank of thisRankings) {
			thisRank['event_key'] = eventKey;
			rankArr.push(thisRank);
		}
	}
	//logger.debug('rankArr=' + JSON.stringify(rankArr));

	var rankMap = {};
	for (var rankIdx = 0; rankIdx < rankArr.length; rankIdx++) {
		//logger.debug('rankIdx=' + rankIdx + ', team_key=' + rankings[rankIdx].team_key + ', rank=' + rankings[rankIdx].rank);
		rankMap[rankArr[rankIdx].team_key] = rankArr[rankIdx];
	}

	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
	// Delete the current rankings
	//await utilities.remove("currentrankings", {});
	await utilities.remove('rankings', {'event_key': event_key});
	// Insert into DB
	//await utilities.insert("currentrankings", rankArr);
	await utilities.insert('rankings', rankArr);

	// Delete the matching match record
	await utilities.remove('matches', {'key': matchId});

	// Reload the match data from TBA
	var url = 'match/' + matchId;
	logger.debug('url=' + url);
	var match = await utilities.requestTheBlueAlliance(url);
	
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
	// if (!await req.authenticate(process.env.ACCESS_GLOBAL_ADMIN)) {
	// 	return res.redirect('/manage/currentevent/matches?alert=Unauthorized to modify TBA data.');
	// }
	
	//var matchId = req.body.matchId;
	var eventKey = req.event.key;
	var event_year = req.event.year;
	var org_key = req.user.org_key;

	// While we're here - Get the latest ranking (& OPR data...? maybe not?)
	// https://www.thebluealliance.com/api/v3/event/2018njfla/rankings
	// https://www.thebluealliance.com/api/v3/event/2018njfla/oprs (?)

	// Reload the rankings from TBA
	var rankingUrl = 'event/' + eventKey + '/rankings';
	logger.debug('rankingUrl=' + rankingUrl);

	var rankinfo = await utilities.requestTheBlueAlliance(rankingUrl);
	var rankArr = [];
	if (rankinfo && rankinfo.rankings && rankinfo.rankings.length > 0) {
		// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings'; enrich with event_key 
		var thisRankings = rankinfo.rankings;
		for (var thisRank of thisRankings) {
			thisRank['event_key'] = eventKey;
			rankArr.push(thisRank);
		}
	}
	logger.trace('rankArr=' + JSON.stringify(rankArr));

	// 2020-02-08, M.O'C: Change 'currentrankings' into event-specific 'rankings' 
	// Delete the current rankings
	//await utilities.remove("currentrankings", {});
	await utilities.remove('rankings', {'event_key': eventKey});
	// Insert into DB
	//await utilities.insert("currentrankings", rankArr);
	await utilities.insert('rankings', rankArr);

	// Get matches data from TBA
	var url = 'event/' + eventKey + '/matches';
	logger.debug('url=' + url);
	var matchData = await utilities.requestTheBlueAlliance(url);
	var arrayLength = matchData.length;
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

module.exports = router;
